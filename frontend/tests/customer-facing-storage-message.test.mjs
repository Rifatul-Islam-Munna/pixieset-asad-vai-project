import { test } from "node:test";
import assert from "node:assert/strict";
import { customerFacingStorageMessage } from "../lib/customer-facing-storage-message.ts";

const fallback = "Uploading to Gallerista server";

test("blocks legacy provider and image engine status labels", () => {
  for (const text of [
    "Imagor R2 Result Storage active",
    "Confirming uploaded files with R2",
    "Uploading directly to Cloudflare R2",
    "Image processing via imgproxy",
    "Connection to https://account.r2.cloudflarestorage.com failed",
    "S3 upload failed (503)",
  ]) {
    assert.equal(customerFacingStorageMessage(text, fallback), fallback);
  }
});

test("preserves ordinary upload statuses and useful validation", () => {
  assert.equal(customerFacingStorageMessage("Upload complete", fallback), "Upload complete");
  assert.equal(customerFacingStorageMessage("File exceeds your plan limit", fallback), "File exceeds your plan limit");
  assert.equal(customerFacingStorageMessage("  Uploading 2 photos  ", fallback), "Uploading 2 photos");
});

test("uses fallback for invalid and empty messages", () => {
  assert.equal(customerFacingStorageMessage(undefined, fallback), fallback);
  assert.equal(customerFacingStorageMessage({ message: "raw" }, fallback), fallback);
  assert.equal(customerFacingStorageMessage("  ", fallback), fallback);
});
