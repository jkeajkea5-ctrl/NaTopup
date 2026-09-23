import test from "node:test";
import assert from "node:assert/strict";
import { prepareValorantCatalogue, VALORANT_POINTS_ICON } from "../lib/valorantCatalogue";

test("prepares Valorant Cambodia packages with shared VP artwork", () => {
  const entries = prepareValorantCatalogue([
    { id: 1, name: "475", amount: 4.5 },
    { id: 2, name: "1000", amount: 9 },
  ]);

  assert.equal(entries[0].product.name, "475 Valorant Points");
  assert.equal(entries[0].product.description, "Valorant Cambodia Server (475 VP)");
  assert.equal(entries[0].product.iconUrl, VALORANT_POINTS_ICON);
  assert.equal(entries[1].product.iconUrl, VALORANT_POINTS_ICON);
});
