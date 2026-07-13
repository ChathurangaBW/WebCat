import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { redact } from "./redact.mjs";

export class AuditLog {
  #queue = Promise.resolve();
  constructor(path) { this.path = path; }

  append(event, actor, data = {}) {
    this.#queue = this.#queue.then(() => this.#append(event, actor, data));
    return this.#queue;
  }

  async #append(event, actor, data) {
    const entries = await this.read();
    const previousHash = entries.at(-1)?.hash ?? "0".repeat(64);
    const core = {
      id: `audit_${randomUUID()}`,
      sequence: entries.length + 1,
      time: new Date().toISOString(),
      event,
      actor,
      data: redact(data),
      previousHash
    };
    const entry = { ...core, hash: digest(core) };
    entries.push(entry);
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    await writeFile(this.path, `${entries.map((item) => JSON.stringify(item)).join("\n")}\n`, { mode: 0o600 });
    return entry;
  }

  async read() {
    try {
      const text = await readFile(this.path, "utf8");
      return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  }

  async verify() {
    const entries = await this.read();
    let previous = "0".repeat(64);
    for (let index = 0; index < entries.length; index += 1) {
      const { hash, ...core } = entries[index];
      if (core.sequence !== index + 1) return { valid: false, index, reason: "sequence" };
      if (core.previousHash !== previous) return { valid: false, index, reason: "previousHash" };
      if (digest(core) !== hash) return { valid: false, index, reason: "hash" };
      previous = hash;
    }
    return { valid: true, entries: entries.length, head: previous };
  }
}

function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
