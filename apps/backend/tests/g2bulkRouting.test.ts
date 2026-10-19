import assert from "node:assert/strict";
import test from "node:test";
import { g2bulkAdapter } from "../suppliers/g2bulk/client";

test("G2Bulk uses pubgm for PUBG catalogue and order routes", () => {
  const adapter = g2bulkAdapter as any;

  assert.equal(adapter.mapCatalogueGameCode("pubg-mobile"), "pubgm");
  assert.equal(adapter.mapCatalogueGameCode("pubgm"), "pubgm");
  assert.equal(adapter.mapCatalogueGameCode("pubg_mobile"), "pubgm");
});

test("G2Bulk keeps the PUBG player-verification code separate", () => {
  assert.equal((g2bulkAdapter as any).mapPlayerCheckGameCode("pubg-mobile"), "pubg_mobile");
});
