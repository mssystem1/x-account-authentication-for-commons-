import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHandle } from "../lib/utils.ts";

test("normalizes @handle", () => assert.equal(normalizeHandle("@mssystem1"), "mssystem1"));
test("normalizes X profile URL", () => assert.equal(normalizeHandle("https://x.com/mssystem1"), "mssystem1"));
test("rejects invalid handle", () => assert.throws(() => normalizeHandle("not-valid-handle!")));
