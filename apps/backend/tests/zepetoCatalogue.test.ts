import assert from "node:assert/strict";
import test from "node:test";
import { getZepetoIconUrl } from "../lib/zepetoCatalogue";

test("maps Zepeto package names to the matching icon style", () => {
  assert.equal(getZepetoIconUrl("7 ZEMS"), "/packages/zepeto/zems-coins-single.png");
  assert.equal(getZepetoIconUrl("14 ZEMS"), "/packages/zepeto/zems-coins-double.png");
  assert.equal(getZepetoIconUrl("29 ZEMS"), "/packages/zepeto/zems-coins-triple.png");
  assert.equal(getZepetoIconUrl("60 ZEMS"), "/packages/zepeto/pack.png");
  assert.equal(getZepetoIconUrl("125 ZEMS"), "/packages/zepeto/crate.png");
  assert.equal(getZepetoIconUrl("196 ZEMS"), "/packages/zepeto/pass.png");
  assert.equal(getZepetoIconUrl("4680 Coins"), "/packages/zepeto/zems-coins-single.png");
  assert.equal(getZepetoIconUrl("10200 Coins"), "/packages/zepeto/zems-coins-double.png");
  assert.equal(getZepetoIconUrl("Premium (1M)"), "/packages/zepeto/monthly.png");
  assert.equal(getZepetoIconUrl("Weekly Pack"), "/packages/zepeto/weekly.png");
});
