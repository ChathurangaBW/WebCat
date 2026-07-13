import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import { IDENTITY } from "./identity.mjs";
import { userPaths } from "./paths.mjs";
import { redact } from "./redact.mjs";

const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });

export class Logger {
  constructor(options = {}) {
    this.paths = options.paths ?? userPaths(options);
    this.level = normalizeLevel(options.level ?? process.env[IDENTITY.environment.logLevel]);
    this.file = options.file ?? this.paths.log;
  }

  async write(level, message, data = {}) {
    if (LEVELS[level] < LEVELS[this.level]) return;
    const record = {
      time: new Date().toISOString(),
      product: IDENTITY.productName,
      level,
      message: String(message),
      data: redact(data)
    };
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const handle = await open(this.file, "a", 0o600);
    try {
      await handle.write(`${JSON.stringify(record)}\n`);
      await handle.chmod(0o600).catch(() => undefined);
    } finally {
      await handle.close();
    }
  }

  debug(message, data) { return this.write("debug", message, data); }
  info(message, data) { return this.write("info", message, data); }
  warn(message, data) { return this.write("warn", message, data); }
  error(message, data) { return this.write("error", message, data); }
}

function normalizeLevel(value) {
  const candidate = String(value ?? "info").toLowerCase();
  return Object.hasOwn(LEVELS, candidate) ? candidate : "info";
}
