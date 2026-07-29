import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { redact } from "./redact.mjs";

export class AuditLog {
  #queue = Promise.resolve();
  #head;
  constructor(path) { this.path = path; }

  append(event, actor, data = {}) {
    // Serialize appends, but never let one failure poison the queue for later callers.
    const result = this.#queue.then(() => this.#append(event, actor, data));
    this.#queue = result.catch(() => undefined);
    return result;
  }

  // The chain head is cached after the first read so that appends stay O(1): each record is
  // appended as a single line instead of rewriting the whole file, which also means a crash
  // or a full disk can cost at most the record being written rather than the entire chain.
  async #append(event, actor, data) {
    if (!this.#head) this.#head = await this.#readHead();
    const core = {
      id: `audit_${randomUUID()}`,
      sequence: this.#head.sequence + 1,
      time: new Date().toISOString(),
      event,
      actor,
      data: redact(data),
      previousHash: this.#head.hash
    };
    const entry = { ...core, hash: digest(core) };
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    await appendFile(this.path, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
    this.#head = { sequence: entry.sequence, hash: entry.hash };
    return entry;
  }

  async #readHead() {
    const entries = await this.read();
    const last = entries.at(-1);
    return { sequence: last?.sequence ?? 0, hash: last?.hash ?? "0".repeat(64) };
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
