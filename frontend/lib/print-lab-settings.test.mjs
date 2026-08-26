import assert from "node:assert/strict";
import test from "node:test";
import { validatePrintLabSettings } from "./print-lab-settings.ts";

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
