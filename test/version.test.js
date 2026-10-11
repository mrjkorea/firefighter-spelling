import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const BUILD = "1.14";

describe("cache-bust stamps", () => {
  it("index.html ?v= values match engine VERSION", () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    const engine = fs.readFileSync(path.join(root, "src/engine.js"), "utf8");
    const versionMatch = engine.match(/const VERSION = "([^"]+)"/);
    assert.ok(versionMatch);
    assert.equal(versionMatch[1], BUILD);
    assert.ok(html.includes(`src/style.css?v=${BUILD}`));
    assert.ok(html.includes(`src/engine.js?v=${BUILD}`));
    assert.ok(html.includes(`mrj-scores.js?v=${BUILD}`));
  });
});
