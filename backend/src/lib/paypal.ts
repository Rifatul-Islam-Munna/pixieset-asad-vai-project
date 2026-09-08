import { BadRequestException } from '@nestjs/common';
import {
  CheckoutPaymentIntent,
  Client,
  Environment,
  OrderApplicationContextShippingPreference,
  OrderApplicationContextUserAction,
  OrdersController,
} from '@paypal/paypal-server-sdk';

export type PayPalEnvironment = 'sandbox' | 'live';
export type PayPalConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  environment: PayPalEnvironment;
  webhookId?: string;
};

export type PayPalWebhookHeaders = {
  authAlgo?: string;
  certUrl?: string;
  transmissionId?: string;
  transmissionSig?: string;
  transmissionTime?: string;
};

export function paypalBaseUrl(environment: PayPalEnvironment) {
  return environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}
function paypalClient(config: PayPalConfig) {
  if (!config.clientId || !config.clientSecret) {
    throw new BadRequestException('PayPal client ID or secret is missing');
  }
  return new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: config.clientId,
      oAuthClientSecret: config.clientSecret,
    },
    environment: config.environment === 'live' ? Environment.Production : Environment.Sandbox,
    timeout: 30000,
  });
}

function paypalFailure(error: unknown, fallback: string): never {
  const source = error as any;
  const detail =
    source?.result?.details?.[0]?.description ||
    source?.result?.message ||
    source?.message ||
    fallback;
  throw new BadRequestException(String(detail));
}

export async function paypalAccessToken(config: PayPalConfig) {
  try {
    const token = await paypalClient(config).clientCredentialsAuthManager.fetchToken();
    if (!token.accessToken) throw new Error('PayPal did not return an access token');
    return token.accessToken;
  } catch (error) {
    return paypalFailure(error, 'PayPal authentication failed');
  }
}
function legacyOrder(order: any) {
  const units = order?.purchaseUnits ?? order?.purchase_units ?? [];
  return {
    ...order,
    purchase_units: units.map((unit: any) => ({
      ...unit,
      custom_id: unit.customId ?? unit.custom_id,
      invoice_id: unit.invoiceId ?? unit.invoice_id,
      amount: unit.amount ? {
        ...unit.amount,
        currency_code: unit.amount.currencyCode ?? unit.amount.currency_code,
      } : unit.amount,
      payments: unit.payments ? {
        ...unit.payments,
        captures: (unit.payments.captures ?? []).map((capture: any) => ({
          ...capture,
          amount: capture.amount ? {
            ...capture.amount,
            currency_code: capture.amount.currencyCode ?? capture.amount.currency_code,
          } : capture.amount,
        })),
      } : unit.payments,
    })),
  };
}

export async function createPayPalOrder(config: PayPalConfig, input: {
  amount: number; currency: string; description: string; customId: string;
  invoiceId: string; returnUrl: string; cancelUrl: string;
}) {
  const currency = input.currency.toUpperCase();  try {
    const controller = new OrdersController(paypalClient(config));
    const response = await controller.createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [{
          amount: { currencyCode: currency, value: Number(input.amount).toFixed(2) },
          description: input.description.slice(0, 127),
          customId: input.customId.slice(0, 127),
          invoiceId: input.invoiceId.slice(0, 127),
        }],
        applicationContext: {
          returnUrl: input.returnUrl,
          cancelUrl: input.cancelUrl,
          userAction: OrderApplicationContextUserAction.PayNow,
          shippingPreference: OrderApplicationContextShippingPreference.NoShipping,
        },
      },
      paypalRequestId: `create-${input.invoiceId}`.slice(0, 108),
      prefer: 'return=representation',
    });
    const order = legacyOrder(response.result);
    const approveUrl = order?.links?.find((link: any) => link.rel === 'approve')?.href;
    if (!approveUrl) throw new Error('PayPal approval URL was not returned');
    return { order, approveUrl: String(approveUrl) };
  } catch (error) {
    return paypalFailure(error, 'PayPal order creation failed');
  }
}

export async function getPayPalOrder(config: PayPalConfig, orderId: string) {  try {
    const response = await new OrdersController(paypalClient(config)).getOrder({ id: orderId });
    return legacyOrder(response.result);
  } catch (error) {
    return paypalFailure(error, 'PayPal order lookup failed');
  }
}

export async function capturePayPalOrder(config: PayPalConfig, orderId: string) {
  try {
    const response = await new OrdersController(paypalClient(config)).captureOrder({
      id: orderId,
      paypalRequestId: `capture-${orderId}`.slice(0, 108),
      prefer: 'return=representation',
    });
    return legacyOrder(response.result);
  } catch (error) {
    return paypalFailure(error, 'PayPal payment capture failed');
  }
}

export function paypalCaptureCompleted(order: any) {
  return order?.status === 'COMPLETED' || order?.purchase_units?.some((unit: any) =>
    unit?.payments?.captures?.some((capture: any) => capture?.status === 'COMPLETED'),
  );
}

export async function verifyPayPalWebhookSignature(
  config: PayPalConfig,
  headers: PayPalWebhookHeaders,
  event: Record<string, unknown>,
  rawEventBody?: Buffer | string,
) {
  if (!config.webhookId) return { verified: false, reason: 'webhook-id-not-configured' };
  const required = [headers.authAlgo, headers.certUrl, headers.transmissionId, headers.transmissionSig, headers.transmissionTime];
  if (required.some((value) => !value)) {
    throw new BadRequestException('PayPal webhook signature headers are incomplete');
  }
  const token = await paypalAccessToken(config);
  const raw = Buffer.isBuffer(rawEventBody)
    ? rawEventBody.toString('utf8')
    : typeof rawEventBody === 'string' && rawEventBody.trim()
      ? rawEventBody
      : JSON.stringify(event);
  try { JSON.parse(raw); } catch { throw new BadRequestException('PayPal webhook body is invalid JSON'); }
  const verificationEnvelope = JSON.stringify({
    auth_algo: headers.authAlgo,
    cert_url: headers.certUrl,
    transmission_id: headers.transmissionId,
    transmission_sig: headers.transmissionSig,
    transmission_time: headers.transmissionTime,
    webhook_id: config.webhookId,
  });
  const body = `${verificationEnvelope.slice(0, -1)},"webhook_event":${raw}}`;
  const response = await fetch(`${paypalBaseUrl(config.environment)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body,
  });
  const data = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    throw new BadRequestException(data?.message || 'PayPal webhook verification failed');
  }
  const verified = data?.verification_status === 'SUCCESS';
  if (!verified) throw new BadRequestException('Invalid PayPal webhook signature');
  return { verified: true, reason: '' };
}
