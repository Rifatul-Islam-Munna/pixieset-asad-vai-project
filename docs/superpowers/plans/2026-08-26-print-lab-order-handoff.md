# Print Lab Order Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send configured print companies secure, complete fulfillment handoffs for enabled free print requests and paid print orders.

**Architecture:** Collection store settings own recipient and independent free/paid toggles. A focused backend notification service atomically claims eligible orders, rotates hashed access tokens, formats email, and records delivery state. Public token-protected endpoints expose a restricted order view and authorized photo downloads; Next.js proxies and renders the read-only lab page.

**Tech Stack:** NestJS 11, Mongoose, Jest, existing `MailService`, Node crypto, Next.js 16 App Router, React 19, TanStack Query, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-26-print-lab-order-handoff-design.md`

## Global Constraints

- Free requests notify after order persistence; paid orders notify only on first confirmed payment transition.
- SMTP failure must never roll back an order or payment.
- Store only SHA-256 access-token hashes; tokens expire after 30 days and rotate on resend.
- No lab login, status editing, bulk ZIP, or lab-account subsystem.
- Do not run Next.js/NestJS builds or lint. Run targeted Jest tests and non-emitting type checks only.
- Preserve unrelated dirty-worktree changes; stage only task files in commits.

## File Map

- `backend/src/store/print-lab-notification.service.ts`: eligibility, claim, token, email, status, secure reads/download authorization.
- `backend/src/store/print-lab-notification.service.spec.ts`: service behavior and security tests.
- `backend/src/store/entities/store-order.entity.ts`: lab access and notification persistence.
- `backend/src/store/store-order-create.service.ts`: free-request trigger.
- `backend/src/store/store-payment-verify.service.ts`: paid-transition triggers.
- `backend/src/store/store.module.ts`: service registration.
- `backend/src/store/public-print-store.controller.ts`: token-protected public lab endpoints.
- `backend/src/store/store.controller.ts`: authenticated resend endpoint.
- `frontend/api-hooks/use-collection-store-admin.ts`: owner config load/save.
- `frontend/components/dashboard/collection-store-settings-panel.tsx`: recipient and toggle controls.
- `frontend/api-hooks/use-store.ts`: notification fields and resend mutation.
- `frontend/components/dashboard/client-dashboard.tsx`: owner status/resend UI.
- `frontend/app/api/print-lab/orders/[orderId]/route.ts`: public order proxy.
- `frontend/app/api/print-lab/orders/[orderId]/images/[imageId]/route.ts`: authorized download proxy.
- `frontend/app/print-lab/orders/[orderId]/page.tsx`: secure lab page.

---

### Task 1: Owner print-company configuration

**Files:**
- Modify: `frontend/components/dashboard/collection-store-settings-panel.tsx`
- Modify: `frontend/api-hooks/use-collection-store-admin.ts`

**Interfaces:**
- Produces `StoreSettingsForm.printLabEmail`, `notifyPrintLabForFreeRequests`, and `notifyPrintLabForPaidOrders`.
- Persists those fields under `collection.settings.store` through existing `updateCollection.mutateAsync`.

- [ ] **Step 1: Write failing validation tests**

Create `frontend/lib/print-lab-settings.test.mjs` against a new pure helper with literal expectations:

```js
test("rejects enabled lab notifications without a valid email", () => {
  assert.equal(validatePrintLabSettings({
    printLabEmail: "bad",
    notifyPrintLabForFreeRequests: true,
    notifyPrintLabForPaidOrders: false,
  }), "Enter a valid print-company email before enabling notifications.");
});

test("accepts one recipient with both notification modes", () => {
  assert.equal(validatePrintLabSettings({
    printLabEmail: "orders@lab.test",
    notifyPrintLabForFreeRequests: true,
    notifyPrintLabForPaidOrders: true,
  }), "");
});
```

- [ ] **Step 2: Run RED test**

Run: `cd frontend && node --experimental-strip-types --test lib/print-lab-settings.test.mjs`

Expected: FAIL because `validatePrintLabSettings` does not exist.

- [ ] **Step 3: Implement helper and UI**

Create `frontend/lib/print-lab-settings.ts` exporting:

```ts
export type PrintLabSettings = {
  printLabEmail: string;
  notifyPrintLabForFreeRequests: boolean;
  notifyPrintLabForPaidOrders: boolean;
};

export function validatePrintLabSettings(value: PrintLabSettings): string;
```

Use a trimmed, simple email check. Extend defaults/load/save in `use-collection-store-admin.ts`. Add one email input and two switches to `CollectionStoreSettingsPanel`; call validation before save and show the existing toast error path.

- [ ] **Step 4: Run GREEN test and scoped type check**

Run: `cd frontend && node --experimental-strip-types --test lib/print-lab-settings.test.mjs`

Run: `cd frontend && npx tsc --noEmit --pretty false 2>&1 | Select-String 'print-lab-settings|collection-store-settings-panel|use-collection-store-admin'`

Expected: 2 tests PASS; no changed-file type errors.

- [ ] **Step 5: Commit task files only**

```bash
git add frontend/lib/print-lab-settings.ts frontend/lib/print-lab-settings.test.mjs frontend/components/dashboard/collection-store-settings-panel.tsx frontend/api-hooks/use-collection-store-admin.ts
git commit -m "feat: configure print lab notifications"
```

### Task 2: Notification state, token, email, and secure view

**Files:**
- Create: `backend/src/store/print-lab-notification.service.ts`
- Create: `backend/src/store/print-lab-notification.service.spec.ts`
- Modify: `backend/src/store/entities/store-order.entity.ts`
- Modify: `backend/src/store/store.module.ts`

**Interfaces:**
- Produces `notify(orderId: string, mode: "free" | "paid", force?: boolean): Promise<PrintLabDeliveryResult>`.
- Produces `getPublicOrder(orderId: string, token: string): Promise<PrintLabPublicOrder>`.
- Produces `authorizeImage(orderId: string, imageId: string, token: string): Promise<{ url: string; filename: string }>`.
- Produces `resend(userId: string, orderId: string): Promise<PrintLabDeliveryResult>`.

- [ ] **Step 1: Write failing service tests**

Build model/mail/catalog fakes around real service methods. Cover these literal outcomes:

```ts
it('routes free and paid modes through independent toggles', async () => {
  collection.settings.store = {
    printLabEmail: 'orders@lab.test',
    notifyPrintLabForFreeRequests: true,
    notifyPrintLabForPaidOrders: false,
  };
  await service.notify(order.id, 'free');
  await service.notify(order.id, 'paid');
  expect(mail.send).toHaveBeenCalledTimes(1);
});

it('stores only a token hash and returns a restricted public order', async () => {
  const result = await service.notify(order.id, 'free');
  expect(order.printLabAccessTokenHash).toMatch(/^[a-f0-9]{64}$/);
  expect(order.printLabAccessTokenHash).not.toContain(result.token);
  const view = await service.getPublicOrder(order.id, result.token);
  expect(view).not.toHaveProperty('userId');
  expect(view.items[0]).toMatchObject({ quantity: 2, options: { Size: '8 x 10', Paper: 'Matte' } });
});
```

Also test invalid, expired, rotated tokens; SMTP failed state; item ownership in `authorizeImage`; HTML escaping; filenames, options, quantity, notes, and secure link in email.

- [ ] **Step 2: Run RED tests**

Run: `cd backend && npm test -- --runInBand src/store/print-lab-notification.service.spec.ts`

Expected: FAIL because service/schema fields do not exist.

- [ ] **Step 3: Add schema fields and minimal service**

Add optional/default fields from the spec to `StoreOrder`. Implement token generation using `randomBytes(32).toString('base64url')`, hashing with `createHash('sha256')`, 30-day expiry, timing-safe token comparison, escaped email HTML/text, restricted view mapping, and recipient/toggle lookup from the order collection.

Atomic claim must use `findOneAndUpdate` with `_id`, eligible status, and force rules; set `pending` before mail delivery. Update to `sent` or `failed` after `MailService.send` resolves. `FRONTEND_URL ?? 'http://localhost:3000'` forms `/print-lab/orders/{id}?token={encodedToken}`.

- [ ] **Step 4: Register service and run GREEN tests**

Add `PrintLabNotificationService` to `StoreModule.providers` and exports if controller injection needs it.

Run: `cd backend && npm test -- --runInBand src/store/print-lab-notification.service.spec.ts`

Expected: all service tests PASS.

- [ ] **Step 5: Commit task files only**

```bash
git add backend/src/store/print-lab-notification.service.ts backend/src/store/print-lab-notification.service.spec.ts backend/src/store/entities/store-order.entity.ts backend/src/store/store.module.ts
git commit -m "feat: add secure print lab notifications"
```

### Task 3: Free and paid lifecycle integration

**Files:**
- Modify: `backend/src/store/store-order-create.service.ts`
- Modify: `backend/src/store/store-payment-verify.service.ts`
- Create: `backend/src/store/store-order-notification.integration.spec.ts`

**Interfaces:**
- Consumes `PrintLabNotificationService.notify(orderId, mode)` from Task 2.
- Guarantees checkout result/payment verification never fails because SMTP fails.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it('notifies only after a free request order is saved', async () => {
  await orderCreate.checkout('gallery', { printRequest: true, customer, items });
  expect(notification.notify).toHaveBeenCalledWith(order.id, 'free');
});

it('notifies paid order once on unpaid-to-paid transition', async () => {
  await paymentVerify.checkoutSession('session');
  await paymentVerify.checkoutSession('session');
  expect(notification.notify).toHaveBeenCalledTimes(1);
  expect(notification.notify).toHaveBeenCalledWith(order.id, 'paid');
});
```

Add an SMTP rejection case proving checkout/payment still returns success.

- [ ] **Step 2: Run RED tests**

Run: `cd backend && npm test -- --runInBand src/store/store-order-notification.integration.spec.ts`

Expected: FAIL because services do not invoke notification.

- [ ] **Step 3: Integrate triggers**

Inject `PrintLabNotificationService`. After free-order `save()`, call `notify(..., 'free').catch(...)`. In both `checkoutSession` and `verifyPublicIntent`, call `notify(..., 'paid').catch(...)` only inside `if (becamePaid)` after order save. Log sanitized failures; do not throw.

- [ ] **Step 4: Run GREEN lifecycle and service tests**

Run: `cd backend && npm test -- --runInBand src/store/store-order-notification.integration.spec.ts src/store/print-lab-notification.service.spec.ts`

Expected: all tests PASS; duplicate verification produces one notification claim.

- [ ] **Step 5: Commit task files only**

```bash
git add backend/src/store/store-order-create.service.ts backend/src/store/store-payment-verify.service.ts backend/src/store/store-order-notification.integration.spec.ts
git commit -m "feat: notify print lab from order lifecycle"
```

### Task 4: Public secure lab API and Next.js page

**Files:**
- Modify: `backend/src/store/public-print-store.controller.ts`
- Create: `frontend/app/api/print-lab/orders/[orderId]/route.ts`
- Create: `frontend/app/api/print-lab/orders/[orderId]/images/[imageId]/route.ts`
- Create: `frontend/app/print-lab/orders/[orderId]/page.tsx`

**Interfaces:**
- Backend `GET /public/print-lab/orders/:orderId?token=...` returns `{ data: PrintLabPublicOrder }`.
- Backend `GET /public/print-lab/orders/:orderId/images/:imageId?token=...` redirects to authorized original asset with safe filename headers where supported.
- Next page consumes only the restricted public view.

- [ ] **Step 1: Add failing controller tests**

Extend the service spec or create `public-print-store.controller.spec.ts` verifying missing token rejection, service delegation, and no internal fields in returned data.

- [ ] **Step 2: Run RED controller test**

Run: `cd backend && npm test -- --runInBand src/store/public-print-store.controller.spec.ts`

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Add backend routes and frontend proxies**

Inject `PrintLabNotificationService` into public controller. Create GET methods with required `token`. Proxies forward encoded order/image IDs and token to `BASE_URL ?? NEXT_PUBLIC_BASE_URL ?? 'http://localhost:4000'`, preserve non-OK status, and never cache.

- [ ] **Step 4: Build read-only lab page**

Server page awaits `params`/`searchParams`, fetches its local/public API with `cache: 'no-store'`, renders unavailable state on non-OK, and shows order number, gallery, customer, note, per-item thumbnail, filename/product, all options, quantity, and authenticated download link. Do not render raw token except inside download URLs.

- [ ] **Step 5: Verify routes and types**

Run: `cd backend && npm test -- --runInBand src/store/public-print-store.controller.spec.ts src/store/print-lab-notification.service.spec.ts`

Run: `cd frontend && npx tsc --noEmit --pretty false 2>&1 | Select-String 'app/(api/)?print-lab'`

Expected: backend tests PASS; no changed-route type errors.

- [ ] **Step 6: Commit task files only**

```bash
git add backend/src/store/public-print-store.controller.ts backend/src/store/public-print-store.controller.spec.ts frontend/app/api/print-lab frontend/app/print-lab
git commit -m "feat: add secure print lab order page"
```

### Task 5: Owner delivery status and resend

**Files:**
- Modify: `backend/src/store/store.controller.ts`
- Modify: `frontend/api-hooks/use-store.ts`
- Modify: `frontend/components/dashboard/client-dashboard.tsx`

**Interfaces:**
- Authenticated `POST /store/orders/:orderId/print-lab/resend` consumes current owner identity.
- `useStoreOrders().resendPrintLabOrder.mutate(orderId)` invalidates `store-orders`.

- [ ] **Step 1: Write failing resend ownership tests**

```ts
it('resends only an order owned by the authenticated gallery owner', async () => {
  await expect(service.resend('other-user', order.id)).rejects.toThrow('Order not found');
  await service.resend(order.userId, order.id);
  expect(mail.send).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run RED resend test**

Run: `cd backend && npm test -- --runInBand src/store/print-lab-notification.service.spec.ts -t resend`

Expected: FAIL until ownership/resend behavior exists.

- [ ] **Step 3: Add endpoint, mutation, and UI**

Add controller route calling `notification.resend(req.user.id, orderId)`. Extend `StoreOrderRecord` with recipient/status/sent/error fields. Add TanStack mutation using `PostRequestAxios`, invalidate order queries, show status badge/recipient in order details, and show “Resend to print company” for `sent` or `failed` states with busy/error toast feedback.

- [ ] **Step 4: Run GREEN tests and scoped type check**

Run: `cd backend && npm test -- --runInBand src/store/print-lab-notification.service.spec.ts`

Run: `cd frontend && npx tsc --noEmit --pretty false 2>&1 | Select-String 'api-hooks/use-store|components/dashboard/client-dashboard'`

Expected: backend tests PASS; no new errors in edited order UI areas.

- [ ] **Step 5: Commit task files only**

```bash
git add backend/src/store/store.controller.ts frontend/api-hooks/use-store.ts frontend/components/dashboard/client-dashboard.tsx
git commit -m "feat: show and resend print lab delivery"
```

### Task 6: Final targeted verification

**Files:**
- Modify only if verification finds task-caused defects.

**Interfaces:**
- Confirms all spec behaviors without build/lint.

- [ ] **Step 1: Run complete targeted backend suite**

Run: `cd backend && npm test -- --runInBand src/store/print-lab-notification.service.spec.ts src/store/store-order-notification.integration.spec.ts src/store/public-print-store.controller.spec.ts`

Expected: all tests PASS, zero failures.

- [ ] **Step 2: Run frontend pure tests**

Run: `cd frontend && node --experimental-strip-types --test lib/print-lab-settings.test.mjs`

Expected: all tests PASS, zero failures.

- [ ] **Step 3: Run non-emitting type checks and isolate baseline errors**

Run: `cd backend && npx tsc --noEmit --pretty false`

Run: `cd frontend && npx tsc --noEmit --pretty false`

Expected: no task-caused errors. Existing unrelated baseline errors must be reported, not fixed.

- [ ] **Step 4: Check scope and whitespace**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; only intended task files plus pre-existing user changes.

- [ ] **Step 5: Report verification evidence**

Report exact pass/fail counts, any baseline type errors, and confirm no Next.js/NestJS build or lint command ran.
