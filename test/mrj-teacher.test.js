import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { it } from "node:test";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

it("mrj-teacher helper uses server isTeacher", () => {
  const src = fs.readFileSync(path.join(root, "app/src/mrj-teacher.js"), "utf8");
  assert.match(src, /isTeacher\(\)/);
});
