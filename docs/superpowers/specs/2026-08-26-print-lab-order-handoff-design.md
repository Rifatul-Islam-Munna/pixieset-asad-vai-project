# Print Lab Order Handoff Design

## Goal

Let each gallery owner configure a print-company email and independently enable automatic lab notifications for free print requests and paid print orders. Each notification links to a secure, no-login order page containing the selected original photos and complete fulfillment details.

## Existing Behavior

- Free print requests already support owner-defined size and paper lists, client-selected quantity, customer details, and notes.
- Paid orders already store selected images, product variants, option values, quantities, crop data, and payment state.
- Free requests complete when the order is created; paid orders complete only after Stripe payment verification.
- A global SMTP mail service already exists.

## Owner Configuration

Extend each collection's `settings.store` object with:

- `printLabEmail`: validated company email address.
- `notifyPrintLabForFreeRequests`: boolean.
- `notifyPrintLabForPaidOrders`: boolean.

The collection Store Settings UI exposes the email and both toggles beside Free Print Requests. Saving uses the existing collection settings mutation. A notification toggle cannot be enabled without a valid company email.

Free request sizes and papers remain price-sheet fields because that behavior already exists. Paid print sizes and papers remain product/variant options. The notification formatter reads the final normalized order items, so both systems produce one consistent lab handoff.

## Order Notification State

Extend store orders with:

- `printLabAccessTokenHash`: SHA-256 hash of the current access token.
- `printLabAccessExpiresAt`: token expiry, 30 days after generation.
- `printLabNotificationStatus`: `not-requested`, `pending`, `sent`, or `failed`.
- `printLabNotificationSentAt`: successful send time.
- `printLabNotificationError`: sanitized last failure message.
- `printLabNotificationRecipient`: recipient used for the latest attempt.

Only the raw token sent in the email can open the lab page; the database stores its hash. Resending rotates the token and expiry. Existing orders require no migration because all fields are optional/defaulted.

## Notification Timing

### Free print requests

After the order is persisted, send only when `notifyPrintLabForFreeRequests` is true and `printLabEmail` is valid.

### Paid print orders

Send only after a payment transition from unpaid to paid, and only when `notifyPrintLabForPaidOrders` is true and `printLabEmail` is valid. Checkout creation never sends the lab notification.

### Idempotency

Before sending, atomically claim an eligible order by moving notification state to `pending`. A sent order cannot be claimed again by duplicate Stripe verification or webhook delivery. Manual resend explicitly creates a new attempt and rotates the token.

## Email

The print-company email contains:

- gallery and order names/numbers;
- free-request or paid-order label;
- customer name and email;
- compact item table with filename/product, size, paper, other selected options, quantity, and notes;
- one secure "Open print order" link;
- token expiry date.

No raw storage URLs or SMTP secrets appear in the email.

## Secure Lab Page

Add a public backend read endpoint that accepts an order ID and raw token. It hashes the token, compares it using timing-safe equality, checks expiry, and returns a restricted lab-order view. It never returns payment credentials, internal activity IDs, owner IDs, or the stored token hash.

Add token-protected download endpoints for individual order images. Each endpoint verifies that the requested image belongs to an item in the authorized order, then returns or redirects to the original asset through the existing media mechanism.

The frontend page displays:

- gallery and order summary;
- customer fulfillment details and notes;
- photo thumbnail and filename;
- product, size, paper, other options, crop note, and quantity;
- per-photo download action.

No lab login, status editing, bulk ZIP generation, or print-company account system is included.

## Owner Order UI

Print orders show the lab-notification state and recipient. Failed or sent notifications expose a "Resend to print company" action. Resend uses an authenticated owner endpoint, verifies order ownership and current valid gallery configuration, rotates the token, and sends again.

## Failure Handling

- Invalid owner configuration blocks enabling notification and returns a clear validation error.
- SMTP failure does not roll back an order or paid payment state.
- Failed sends store sanitized error state for the owner; secrets and full SMTP responses are not persisted.
- Invalid, expired, rotated, or mismatched tokens return a generic unavailable response.
- Missing/deleted order photos show as unavailable without exposing another asset.

## Components and Boundaries

- `PrintLabNotificationService`: eligibility, idempotent claim, secure-token lifecycle, email view model, delivery state.
- Store order creation: invokes notification service after free-request persistence.
- Payment verification: invokes notification service only on the first paid transition.
- Public lab controller/service: token validation, restricted order view, authorized downloads.
- Collection Store Settings UI: email and two notification toggles.
- Lab order page: read-only fulfillment view.
- Owner order UI: delivery status and resend action.

## Testing

Backend tests cover:

- free-only, paid-only, both, and neither toggle routing;
- free request sends after persistence;
- paid order sends only after confirmed payment;
- duplicate payment verification does not duplicate email;
- invalid/missing recipient skips delivery;
- SMTP failure preserves order/payment and records failed state;
- resend rotates tokens and can recover a failed attempt;
- valid, invalid, expired, and rotated token access;
- cross-order image-download rejection;
- email model contains filenames, product/options, size, paper, quantity, notes, and secure link.

Frontend verification covers owner configuration validation, notification status/resend states, and complete lab-page rendering.

Per workspace instruction, implementation verification will not run Next.js/NestJS builds or lint. Targeted automated tests and non-emitting type checks may run.
