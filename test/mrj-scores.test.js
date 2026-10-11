import assert from "node:assert/strict";
import { describe, it } from "node:test";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scoresPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "mrj-scores.js");
const scoresSource = fs.readFileSync(scoresPath, "utf8");

function loadScores(mocks) {
  const fetchCalls = [];
  const noteCalls = [];
  const storage = new Map();
  const localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, v),
  };
  const root = {
    MRJ_AUTH: mocks.auth,
    fetch: (url, init) => {
      fetchCalls.push({ url, init, body: JSON.parse(init.body) });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });
    },
    addEventListener: () => {},
    localStorage,
  };
  root.window = root;
  vm.runInNewContext(scoresSource, root, { filename: "mrj-scores.js" });
  return { root, fetchCalls, noteCalls, trackNote() {
    if (root.MRJ_AUTH && typeof root.MRJ_AUTH.noteScore === "function") {
      const orig = root.MRJ_AUTH.noteScore;
      root.MRJ_AUTH.noteScore = (arg) => {
        noteCalls.push(arg);
        return orig(arg);
      };
    }
  } };
}

describe("mrj-scores.post", () => {
  it("skips when no signed-in student", async () => {
    const { root, fetchCalls } = loadScores({ auth: { student: () => "" } });
    const res = await root.MRJ_SCORES.post({
      program: "firefighter-spelling",
      itemId: "numbers-en-v1:num-one",
      scoreValue: 1,
      scoreMax: 1,
    });
    assert.equal(res.status, "skipped");
    assert.equal(fetchCalls.length, 0);
  });

  it("uses id_key for student_email when student has no @", async () => {
    const noteCalls = [];
    const { root, fetchCalls } = loadScores({
      auth: {
        student: () => "zz_test_mrjmetrics",
        noteScore: (arg) => noteCalls.push(arg),
      },
    });
    await root.MRJ_SCORES.post({
      program: "firefighter-spelling",
      itemId: "numbers-en-v1:num-one",
      scoreValue: 1,
      scoreMax: 1,
    });
    assert.equal(fetchCalls.length, 1);
    const body = fetchCalls[0].body;
    assert.equal(body.student_email, "zz_test_mrjmetrics");
    assert.ok(body.session_id.includes("zz_test_mrjmetrics"));
    assert.equal(body.events[0].identity_method, "mrj_signin");
    assert.equal(body.events[0].identity_confidence, "high");
    assert.match(body.events[0].local_date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(noteCalls.length, 1);
    assert.equal(noteCalls[0].itemId, "numbers-en-v1:num-one");
    assert.match(noteCalls[0].localDate, /^\d{4}-\d{2}-\d{2}$/);
  });
});
