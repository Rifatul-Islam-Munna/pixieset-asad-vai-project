import assert from "node:assert/strict";
import test from "node:test";

import { coverFocalStyle } from "./cover-focal.ts";

test("keeps a selected off-center focal point visible in cover crops", () => {
  assert.deepEqual(coverFocalStyle(18, 82), {
    objectPosition: "18% 82%",
  });
});

test("clamps focal points to valid object-position percentages", () => {
  assert.deepEqual(coverFocalStyle(-20, 140), {
    objectPosition: "0% 100%",
  });
});

test("defaults invalid focal values to center", () => {
  assert.deepEqual(coverFocalStyle(Number.NaN, undefined), {
    objectPosition: "50% 50%",
  });
});
