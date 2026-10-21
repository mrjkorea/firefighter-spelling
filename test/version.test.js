import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).build;

describe("cache-bust stamps", () => {
  it("index.html ?v= values match version.json build", () => {
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    assert.equal(BUILD, "20261021-fix2");
    assert.ok(html.includes(`<meta name="mrj-build" content="${BUILD}"`));
    assert.match(html, new RegExp(`assets/index-[\\w-]+\\.js\\?v=${BUILD}`));
    assert.match(html, new RegExp(`assets/index-[\\w-]+\\.css\\?v=${BUILD}`));
    assert.ok(html.includes(`mrj-scores.js?v=${BUILD}`));
    assert.ok(html.includes("mrj-signin/mrj-auth-boot.js"));
  });
});
