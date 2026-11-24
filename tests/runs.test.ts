// Recorded runs replay with zero keys: every one re-derives from today's corpus and code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
// @ts-expect-error: plain ESM script without type declarations
import { verifyRuns } from "../scripts/lib/runs.mjs";
import { read } from "./helpers.ts";

test("all recorded runs verify, including the hero contract", async () => {
  const { errors, summary } = (await verifyRuns(join(import.meta.dirname, ".."))) as { errors: string[]; summary: unknown[] };
  assert.deepEqual(errors, []);
  assert.equal(summary.length, read<{ runs: unknown[] }>("runs/index.json").runs.length);
  assert.ok(summary.length >= 6);
});
