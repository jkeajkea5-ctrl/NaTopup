import assert from "node:assert/strict";
import test from "node:test";
import { parseMaintenanceMode } from "../lib/maintenanceSettings";

test("maintenance mode defaults to disabled", () => {
  assert.equal(parseMaintenanceMode(), false);
  assert.equal(parseMaintenanceMode(""), false);
  assert.equal(parseMaintenanceMode("invalid"), false);
});

test("maintenance mode accepts stored boolean values", () => {
  assert.equal(parseMaintenanceMode("true"), true);
  assert.equal(parseMaintenanceMode(" true "), true);
  assert.equal(parseMaintenanceMode("false"), false);
});
