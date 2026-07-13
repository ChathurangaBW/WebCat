import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export async function readJsonArray(path) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(value)) throw new Error(`${path} must contain an array`);
    return value;
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export class RecordStore {
  constructor(path, prefix) { this.path = path; this.prefix = prefix; }
  list() { return readJsonArray(this.path); }
  async add(input) {
    const values = await this.list();
    const record = {
      id: `${this.prefix}_${randomUUID()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...input
    };
    values.push(record);
    await writeJson(this.path, values);
    return record;
  }
  async update(id, patch) {
    const values = await this.list();
    const index = values.findIndex((value) => value.id === id);
    if (index < 0) throw new Error(`${this.prefix} ${id} not found`);
    values[index] = { ...values[index], ...patch, updatedAt: new Date().toISOString() };
    await writeJson(this.path, values);
    return values[index];
  }
  async get(id) { return (await this.list()).find((value) => value.id === id); }
}

export class SessionStore {
  constructor(directory) { this.directory = directory; }
  async create(objective) {
    const record = {
      id: `session_${randomUUID()}`,
      objective,
      state: "NEW",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      agentRuns: []
    };
    await this.write(record);
    return record;
  }
  async write(session) {
    session.updatedAt = new Date().toISOString();
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await writeFile(join(this.directory, `${session.id}.json`), `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
    return session;
  }
  async get(id) {
    try { return JSON.parse(await readFile(join(this.directory, `${id}.json`), "utf8")); }
    catch (error) { if (error?.code === "ENOENT") return undefined; throw error; }
  }
  async list() {
    try {
      const names = (await readdir(this.directory)).filter((name) => /^session_[a-f0-9-]+\.json$/i.test(name));
      const sessions = await Promise.all(names.map(async (name) => JSON.parse(await readFile(join(this.directory, name), "utf8"))));
      return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  }
  async latest() { return (await this.list())[0]; }
}
