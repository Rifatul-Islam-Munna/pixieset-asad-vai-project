const mockFetchToken = jest.fn();
const mockCreateOrder = jest.fn();
const mockGetOrder = jest.fn();
const mockCaptureOrder = jest.fn();

jest.mock('@paypal/paypal-server-sdk', () => ({
  CheckoutPaymentIntent: { Capture: 'CAPTURE' },
  Environment: { Sandbox: 'Sandbox', Production: 'Production' },
  OrderApplicationContextShippingPreference: { NoShipping: 'NO_SHIPPING' },
  OrderApplicationContextUserAction: { PayNow: 'PAY_NOW' },
  Client: jest.fn().mockImplementation(() => ({
    clientCredentialsAuthManager: { fetchToken: mockFetchToken },
  })),
  OrdersController: jest.fn().mockImplementation(() => ({
    createOrder: mockCreateOrder,
    getOrder: mockGetOrder,
    captureOrder: mockCaptureOrder,
  })),
}));

import {
  capturePayPalOrder,
  createPayPalOrder,
  paypalAccessToken,
  paypalCaptureCompleted,
  verifyPayPalWebhookSignature,
  type PayPalConfig,
} from './paypal';

const config: PayPalConfig = {
  enabled: true,
  environment: 'sandbox',  clientId: 'sandbox-client',
  clientSecret: 'sandbox-secret',
};

describe('PayPal SDK helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchToken.mockResolvedValue({ accessToken: 'token-123', tokenType: 'Bearer' });
  });

  it('gets OAuth through the official PayPal SDK auth manager', async () => {
    await expect(paypalAccessToken(config)).resolves.toBe('token-123');
    expect(mockFetchToken).toHaveBeenCalledTimes(1);
  });

  it('creates an Orders v2 CAPTURE order and returns approval URL', async () => {
    mockCreateOrder.mockResolvedValue({ result: {
      id: 'ORDER-123',
      status: 'CREATED',
      links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-123' }],
    } });
    const result = await createPayPalOrder(config, {
      amount: 19.99,
      currency: 'EUR',
      description: 'Test order',
      customId: 'store:abc',
      invoiceId: 'INV-123',
      returnUrl: 'https://gallery.example.test/store/success',
      cancelUrl: 'https://gallery.example.test/store/checkout',
    });    expect(result.order.id).toBe('ORDER-123');
    expect(result.approveUrl).toContain('ORDER-123');
    expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        intent: 'CAPTURE',
        purchaseUnits: [expect.objectContaining({
          amount: { currencyCode: 'EUR', value: '19.99' },
          customId: 'store:abc',
          invoiceId: 'INV-123',
        })],
        applicationContext: expect.objectContaining({
          returnUrl: 'https://gallery.example.test/store/success',
          cancelUrl: 'https://gallery.example.test/store/checkout',
          userAction: 'PAY_NOW',
        }),
      }),
    }));
  });

  it('captures with the SDK and preserves the existing payment validator shape', async () => {
    mockCaptureOrder.mockResolvedValue({ result: {
      id: 'ORDER-123',
      status: 'COMPLETED',
      purchaseUnits: [{
        customId: 'store:abc',
        amount: { currencyCode: 'EUR', value: '19.99' },
        payments: { captures: [{ id: 'CAPTURE-1', status: 'COMPLETED', amount: { currencyCode: 'EUR', value: '19.99' } }] },
      }],
    } });
    const order = await capturePayPalOrder(config, 'ORDER-123');
    expect(paypalCaptureCompleted(order)).toBe(true);
    expect(order.purchase_units[0].custom_id).toBe('store:abc');
    expect(order.purchase_units[0].payments.captures[0].amount.currency_code).toBe('EUR');
  });

  it('verifies a configured webhook through PayPal signature verification', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: jest.fn().mockResolvedValue({ verification_status: 'SUCCESS' }),
    } as any);
    const rawEvent = '{\n  "id": "EV-1",\n  "event_type": "PAYMENT.CAPTURE.COMPLETED"\n}';
    const result = await verifyPayPalWebhookSignature(
      { ...config, webhookId: 'WH-123' },
      { authAlgo: 'SHA256withRSA', certUrl: 'https://api.paypal.com/cert', transmissionId: 'T-1', transmissionSig: 'sig', transmissionTime: '2026-09-08T00:00:00Z' },
      JSON.parse(rawEvent),
      rawEvent,
    );
    expect(result.verified).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining(`"webhook_event":${rawEvent}`) }),
    );
    fetchMock.mockRestore();
  });

  it('keeps webhooks optional when no Webhook ID is configured', async () => {
    const result = await verifyPayPalWebhookSignature(
      config,
      {},
      { id: 'WH-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' },
    );
    expect(result).toEqual({ verified: false, reason: 'webhook-id-not-configured' });
  });
});
