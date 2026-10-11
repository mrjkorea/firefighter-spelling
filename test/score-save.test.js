import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROGRAM } from "../src/auth-progress.js";
import {
  packFinishPostOptions,
  packResultItemId,
  scopedWordItemId,
  signedInStudent,
  wordRoundPostOptions,
} from "../src/score-save.js";

describe("pack-scoped score payloads", () => {
  const pack = { title: "Numbers", items: [{}, {}, {}] };

  it("postRoundScore sends numbers-en-v1:num-one", () => {
    const opts = wordRoundPostOptions({
      program: PROGRAM,
      packId: "numbers-en-v1",
      pack,
      itemId: "num-one",
      word: "one",
      timerMs: 2500,
      passed: true,
    });
    assert.equal(opts.itemId, scopedWordItemId("numbers-en-v1", "num-one"));
    assert.equal(opts.itemId, "numbers-en-v1:num-one");
    assert.equal(opts.itemType, "word");
    assert.equal(opts.correctness, "correct");
    assert.equal(opts.scoreValue, 1);
    assert.equal(opts.scoreMax, 1);
    assert.equal(opts.metadata.word, "one");
    assert.equal(opts.metadata.seconds_left, 3);
  });

  it("finishPack sends pack:numbers-en-v1 with right/tried counts", () => {
    const opts = packFinishPostOptions({
      program: PROGRAM,
      packId: "numbers-en-v1",
      pack,
      packRight: 2,
      packTried: 3,
      score: 450,
    });
    assert.equal(opts.itemId, packResultItemId("numbers-en-v1"));
    assert.equal(opts.itemId, "pack:numbers-en-v1");
    assert.equal(opts.itemType, "pack");
    assert.equal(opts.scoreValue, 2);
    assert.equal(opts.scoreMax, 3);
    assert.equal(opts.metadata.points, 450);
    assert.equal(opts.metadata.pack_items, 3);
  });

  it("signed out student is empty", () => {
    assert.equal(signedInStudent(() => ""), "");
    assert.equal(signedInStudent(() => "   "), "");
    assert.equal(signedInStudent(() => {
      throw new Error("no auth");
    }), "");
  });
});
