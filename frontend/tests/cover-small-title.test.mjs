import assert from "node:assert/strict";
import test from "node:test";
import { resolveCoverSmallTitle } from "../lib/cover-small-title.ts";

test("new collections show the configured studio name", () => {
  assert.equal(resolveCoverSmallTitle(undefined, "Rifat Photo Studio"), "Rifat Photo Studio");
  assert.equal(resolveCoverSmallTitle("Avery Studio", "Rifat Photo Studio"), "Rifat Photo Studio");
  assert.equal(resolveCoverSmallTitle("Your Studio", "Rifat Photo Studio"), "Rifat Photo Studio");
});

test("customised cover small titles remain unchanged", () => {
  assert.equal(resolveCoverSmallTitle("Our memories", "Rifat Photo Studio"), "Our memories");
  assert.equal(resolveCoverSmallTitle(" Studio X ", "Other Studio"), "Studio X");
});

test("missing studio branding has a readable fallback", () => {
  assert.equal(resolveCoverSmallTitle("", undefined), "Your Studio");
});
