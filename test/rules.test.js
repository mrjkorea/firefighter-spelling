import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePack, packFromLines, packFromWordsParam, lettersForFloor, layoutFloors, letterBudgetMs, winPoints, recordPoints, nextOpenIndex, WINDOWS } from "../app/src/rules.js";

describe("rules (unchanged from v1.15)", () => {
  it("normalizes packs: lowercase letters only, default 5 s per letter", () => {
    const p = normalizePack({ pack_id: "zz_test", items: [{ item_id: "a", word: "Ice-Cream" }, "Dog", { word: "!!" }] }, "x");
    assert.deepEqual(p.items.map((i) => i.word), ["icecream", "dog"]);
    assert.equal(p.items[1].item_id, "x-1-dog");
    assert.equal(p.seconds_per_letter, 5);
    assert.equal(letterBudgetMs(p), 5000);
    assert.equal(letterBudgetMs({ seconds_per_letter: 0.2 }), 1000);
  });
  it("keeps Word Master item audio", () => {
    const p = normalizePack({ items: [{ item_id: "cat", word: "cat", audio: "../../packs/p/audio/us_m/cat.mp3" }] }, "session");
    assert.equal(p.items[0].audio, "../../packs/p/audio/us_m/cat.mp3");
    const u = packFromWordsParam("cat, dog", "zz_test", "us_f");
    assert.equal(u.items[1].audio, "../../packs/zz_test/audio/us_f/dog.mp3");
  });
  it("paste list ignores comments", () => {
    assert.deepEqual(packFromLines("# hi\ncat\n\nDog", "zz").items.map((i) => i.word), ["cat", "dog"]);
  });
  it("five distinct windows, one is the needed letter", () => {
    for (const L of "AEQZ") {
      const row = lettersForFloor(L, 7);
      assert.equal(row.length, WINDOWS);
      assert.equal(new Set(row).size, WINDOWS);
      assert.ok(row.includes(L));
    }
    const rows = layoutFloors("three", 2);
    assert.equal(rows.length, 5);
    rows.forEach((r, f) => assert.ok(r.includes("THREE"[f])));
  });
  it("scoring", () => {
    assert.equal(winPoints(5000), 200);
    assert.equal(winPoints(0), 100);
    assert.equal(recordPoints(true, 4, 2), 370);
    assert.equal(recordPoints(false, 4, 0), 0);
  });
  it("skips passed words", () => {
    const items = [{ item_id: "a" }, { item_id: "b" }, { item_id: "c" }];
    assert.equal(nextOpenIndex(items, 0, new Set(["a"])), 1);
    assert.equal(nextOpenIndex(items, 0, new Set(["a", "b", "c"])), -1);
  });
});
