import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROGRAM,
  bindAuthProgress,
  mergeProgressRows,
  migrateRecordsStorage,
  passedIdsFromProgress,
  itemPassed,
} from "../src/auth-progress.js";

describe("mergeProgressRows", () => {
  it("ignores rows from other programs", () => {
    const rows = [
      { program: "day4-speak", itemId: "x", scoreValue: 1, scoreMax: 1 },
      { program: PROGRAM, itemId: "one", scoreValue: 1, scoreMax: 1 },
    ];
    const merged = mergeProgressRows([], rows, PROGRAM);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].itemId, "one");
  });

  it("unions more than 20 rows and keeps pass over fail", () => {
    const batch = [];
    for (let i = 0; i < 25; i++) {
      batch.push({ program: PROGRAM, itemId: `w${i}`, scoreValue: 0, scoreMax: 1 });
    }
    batch.push({ program: PROGRAM, itemId: "w3", scoreValue: 1, scoreMax: 1 });
    const merged = mergeProgressRows(batch.slice(0, 20), batch.slice(20), PROGRAM);
    assert.equal(merged.length, 25);
    assert.equal(itemPassed(merged.find((r) => r.itemId === "w3")), true);
  });

  it("never un-completes: fail after pass keeps pass", () => {
    const pass = { program: PROGRAM, itemId: "two", scoreValue: 1, scoreMax: 1 };
    const fail = { program: PROGRAM, itemId: "two", scoreValue: 0, scoreMax: 1 };
    const merged = mergeProgressRows([pass], [fail], PROGRAM);
    assert.equal(passedIdsFromProgress(merged, PROGRAM).has("two"), true);
  });
});

describe("bindAuthProgress", () => {
  it("applies ready progress then paged load with union", async () => {
    const applied = [];
    let student = "";
    const calls = [];
    const auth = {
      progressError: () => "",
      loadProgressForApp: (prog) => {
        calls.push(prog);
        return Promise.resolve({
          ok: true,
          progress: [
            { program: PROGRAM, itemId: "five", scoreValue: 1, scoreMax: 1 },
            { program: "ski-jump", itemId: "skip", scoreValue: 1, scoreMax: 1 },
          ],
        });
      },
    };
    const binding = bindAuthProgress({
      getAuth: () => auth,
      onProgressApplied(rows) {
        applied.push(rows);
      },
      onStudentReady(id) {
        student = id;
      },
    });
    binding.onAuthReady({
      detail: {
        id: "Student A",
        progress: [{ program: PROGRAM, itemId: "one", scoreValue: 1, scoreMax: 1 }],
      },
    });
    assert.equal(student, "Student A");
    assert.equal(applied.length, 1);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.length, 1);
    assert.equal(calls[0], PROGRAM);
    assert.equal(applied.length, 2);
    const allIds = passedIdsFromProgress(
      mergeProgressRows(applied[0], applied[1], PROGRAM),
      PROGRAM
    );
    assert.ok(allIds.has("one"));
    assert.ok(allIds.has("five"));
    assert.ok(!allIds.has("skip"));
  });

  it("keeps ready progress on first sign-in when loadProgressForApp fails", async () => {
    const readyRows = [];
    for (let i = 0; i < 5; i++) {
      readyRows.push({ program: PROGRAM, itemId: `w${i}`, scoreValue: 1, scoreMax: 1 });
    }
    let authProgress = [];
    const binding = bindAuthProgress({
      getAuth: () => ({
        progressError: () => "",
        loadProgressForApp: () => Promise.resolve({ ok: false, progress: [] }),
      }),
      onStudentReady() {
        authProgress = [];
      },
      onProgressApplied(rows) {
        authProgress = mergeProgressRows(authProgress, rows, PROGRAM);
      },
    });
    binding.onAuthReady({ detail: { id: "newkid", progress: readyRows } });
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(authProgress.length, 5);
  });

  it("merges a second ready event without calling onStudentReady again", () => {
    let readyCount = 0;
    let authProgress = [];
    const binding = bindAuthProgress({
      getAuth: () => ({ progressError: () => "" }),
      onStudentReady() {
        readyCount += 1;
      },
      onProgressApplied(rows) {
        authProgress = mergeProgressRows(authProgress, rows, PROGRAM);
      },
    });
    binding.onAuthReady({
      detail: {
        id: "kid1",
        progress: [{ program: PROGRAM, itemId: "one", scoreValue: 1, scoreMax: 1 }],
      },
    });
    binding.onAuthReady({
      detail: {
        id: "kid1",
        progress: [{ program: PROGRAM, itemId: "two", scoreValue: 1, scoreMax: 1 }],
      },
    });
    assert.equal(readyCount, 1);
    const ids = passedIdsFromProgress(authProgress, PROGRAM);
    assert.ok(ids.has("one"));
    assert.ok(ids.has("two"));
  });
});

describe("migrateRecordsStorage", () => {
  it("copies legacy records into student key without deleting legacy", () => {
    const store = new Map();
    const storage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
    };
    storage.setItem("mrj.firefighter_spelling.records", JSON.stringify([{ item_id: "legacy" }]));
    const merged = migrateRecordsStorage(storage, "kid1");
    assert.equal(merged.length, 1);
    assert.ok(store.has("mrj.firefighter_spelling.records.kid1"));
    assert.ok(store.has("mrj.firefighter_spelling.records"));
  });

  it("does not grow the record list across five reloads", () => {
    const store = new Map();
    const storage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
    };
    const dup = { item_id: "legacy", ended_at: "2026-01-01", started_at: "2026-01-01" };
    storage.setItem(
      "mrj.firefighter_spelling.records",
      JSON.stringify([dup, dup, { item_id: "other", ended_at: "2026-01-02" }])
    );
    let size = 0;
    for (let i = 0; i < 5; i++) {
      const merged = migrateRecordsStorage(storage, "kid1");
      if (i === 0) size = merged.length;
      assert.equal(merged.length, size);
    }
    assert.equal(size, 2);
  });
});
