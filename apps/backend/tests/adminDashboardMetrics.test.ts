import test from "node:test";
import assert from "node:assert/strict";
import { cambodiaDayRange, cambodiaYesterdayRange } from "../lib/cambodiaTime";

test("uses Cambodia calendar days for daily profit", () => {
  const { start, end } = cambodiaDayRange(new Date("2026-09-24T18:30:00.000Z"));
  assert.equal(start.toISOString(), "2026-09-24T17:00:00.000Z");
  assert.equal(end.toISOString(), "2026-09-25T17:00:00.000Z");
});

test("uses the previous Cambodia calendar day for yesterday's order totals", () => {
  const { start, end } = cambodiaYesterdayRange(new Date("2026-09-24T18:30:00.000Z"));
  assert.equal(start.toISOString(), "2026-09-23T17:00:00.000Z");
  assert.equal(end.toISOString(), "2026-09-24T17:00:00.000Z");
});
