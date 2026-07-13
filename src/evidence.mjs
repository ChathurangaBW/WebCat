import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { redact } from "./redact.mjs";

export class EvidenceStore {
  constructor(directory, options = {}) {
    this.directory = directory;
    this.maxBodyBytes = options.maxBodyBytes ?? 262144;
  }

  async add(input) {
    const id = `evidence_${randomUUID()}`;
    const body = truncate(redact(input.body ?? input.data ?? {}), this.maxBodyBytes);
    const core = {
      id,
      createdAt: new Date().toISOString(),
      source: input.source ?? "webcat",
      target: input.target,
      contentType: input.contentType ?? "application/json",
      body
    };
    const record = { ...core, sha256: digest(core) };
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await writeFile(join(this.directory, `${id}.json`), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    return record;
  }

  async list() {
    try {
      const names = (await readdir(this.directory)).filter((name) => /^evidence_[a-f0-9-]+\.json$/i.test(name));
      return await Promise.all(names.map(async (name) => JSON.parse(await readFile(join(this.directory, name), "utf8"))));
    } catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  }

  async verify() {
    const values = await this.list();
    return values.map(({ sha256, ...core }) => ({ id: core.id, valid: digest(core) === sha256 }));
  }
}

function truncate(value, maxBytes) {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) <= maxBytes) return value;
  return { truncated: true, preview: text.slice(0, Math.max(0, maxBytes - 100)) };
}
function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
