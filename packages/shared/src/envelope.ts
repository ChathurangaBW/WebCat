/**
 * Standard API response envelope types.
 * All REST responses use a uniform { ok, data, error, meta } shape.
 */

export interface Envelope<T = unknown> {
  ok: boolean;
  data: T | null;
  error: ErrorPayload | null;
  meta: MetaPayload;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface MetaPayload {
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export function okEnvelope<T>(data: T, meta: Partial<MetaPayload> = {}): Envelope<T> {
  return {
    ok: true,
    data,
    error: null,
    meta: {
      requestId: meta.requestId ?? crypto.randomUUID(),
      timestamp: meta.timestamp ?? new Date().toISOString(),
      ...meta,
    },
  };
}

export function errEnvelope(
  code: string,
  message: string,
  details?: unknown,
  meta: Partial<MetaPayload> = {},
): Envelope<null> {
  return {
    ok: false,
    data: null,
    error: { code, message, details },
    meta: {
      requestId: meta.requestId ?? crypto.randomUUID(),
      timestamp: meta.timestamp ?? new Date().toISOString(),
      ...meta,
    },
  };
}

export function paginatedEnvelope<T>(
  data: T[],
  pagination: PaginationMeta,
  meta: Partial<MetaPayload> = {},
): Envelope<T[]> {
  return {
    ok: true,
    data,
    error: null,
    meta: {
      requestId: meta.requestId ?? crypto.randomUUID(),
      timestamp: meta.timestamp ?? new Date().toISOString(),
      pagination,
      ...meta,
    },
  };
}
