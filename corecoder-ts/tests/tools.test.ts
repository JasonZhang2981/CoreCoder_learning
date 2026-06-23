import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ALL_TOOLS, changedFiles, getTool, schemaFor } from "../src/tools/index.js";

test("exports the mirrored built-in tools", () => {
  assert.equal(ALL_TOOLS.length, 7);
  assert.ok(getTool("read_file"));
});

test("tool schema mirrors OpenAI function tool shape", () => {
  const read = getTool("read_file");
  assert.ok(read);
  const schema = schemaFor(read);
  assert.equal(schema.type, "function");
  assert.equal(schema.function.name, "read_file");
});

test("read, write, and edit tools work with temporary files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "corecoder-ts-"));
  try {
    changedFiles.clear();
    const file = join(dir, "sample.txt");
    const write = getTool("write_file");
    const read = getTool("read_file");
    const edit = getTool("edit_file");
    assert.ok(write);
    assert.ok(read);
    assert.ok(edit);

    await write.execute({ file_path: file, content: "aaa\nbbb\n" });
    assert.equal(await readFile(file, "utf8"), "aaa\nbbb\n");

    const before = await read.execute({ file_path: file });
    assert.equal(before, "aaa\nbbb\n");

    await edit.execute({ file_path: file, old_string: "aaa", new_string: "zzz" });
    assert.equal(await readFile(file, "utf8"), "zzz\nbbb\n");
    assert.ok(changedFiles.has(file));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
