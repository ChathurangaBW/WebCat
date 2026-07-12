import type { AppConfig } from "@webcat/core";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface ModelResult {
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  raw: any;
}

export class ChatCompletionsProvider {
  public constructor(private readonly config: AppConfig["provider"], private readonly retries = 2) {}
  public configured(): boolean { return Boolean(this.config.baseUrl && this.config.model); }
  public hasCredential(): boolean { return !this.config.apiKeyEnv || Boolean(process.env[this.config.apiKeyEnv]); }

  public async complete(messages: ChatMessage[], tools: any[] = []): Promise<ModelResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try { return await this.request(messages, tools); }
      catch (error) {
        lastError = error;
        if (attempt >= this.retries) break;
        await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
      }
    }
    throw lastError;
  }

  private async request(messages: ChatMessage[], tools: any[]): Promise<ModelResult> {
    const key = this.config.apiKeyEnv ? process.env[this.config.apiKeyEnv] : undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          ...(tools.length ? { tools, tool_choice: "auto" } : {}),
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`model request failed ${response.status}: ${await response.text()}`);
      const data = await response.json();
      const message = data.choices?.[0]?.message ?? {};
      const calls = (message.tool_calls ?? []).map((call: any) => ({
        id: String(call.id),
        name: String(call.function?.name ?? ""),
        arguments: parseArguments(String(call.function?.arguments ?? "{}"))
      }));
      return { content: typeof message.content === "string" ? message.content : "", toolCalls: calls, raw: data };
    } finally { clearTimeout(timer); }
  }
}

function parseArguments(value: string): Record<string, unknown> {
  try { return JSON.parse(value || "{}"); }
  catch { return { raw: value, parseError: true }; }
}
