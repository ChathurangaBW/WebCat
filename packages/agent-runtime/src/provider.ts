import type { AppConfig } from "@webcat/core";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

export interface ModelToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ModelResult {
  content: string;
  toolCalls: ModelToolCall[];
  assistantToolCalls?: unknown[];
  raw: unknown;
}

function parseArguments(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value || "{}") as Record<string, unknown>;
  } catch {
    return { raw: value };
  }
}

export class ChatCompletionsProvider {
  public constructor(private readonly config: AppConfig["provider"]) {}

  public configured(): boolean {
    return !this.config.apiKeyRequired || Boolean(process.env[this.config.apiKeyEnv]);
  }

  public async complete(messages: ChatMessage[], tools: unknown[] = [], signal?: AbortSignal): Promise<ModelResult> {
    const key = process.env[this.config.apiKeyEnv];
    if (this.config.apiKeyRequired && !key) {
      throw new Error(`missing model API key environment variable: ${this.config.apiKeyEnv}`);
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(key ? { authorization: `Bearer ${key}` } : {})
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          ...(tools.length ? { tools, tool_choice: "auto" } : {}),
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 2000);
        throw new Error(`model request failed ${response.status}: ${body}`);
      }
      const data = await response.json() as any;
      const message = data.choices?.[0]?.message ?? {};
      const toolCalls: ModelToolCall[] = (message.tool_calls ?? []).map((call: any) => ({
        id: String(call.id),
        name: String(call.function?.name ?? ""),
        arguments: parseArguments(String(call.function?.arguments ?? "{}"))
      }));
      return {
        content: typeof message.content === "string" ? message.content : "",
        toolCalls,
        ...(message.tool_calls ? { assistantToolCalls: message.tool_calls } : {}),
        raw: data
      };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
}
