/**
 * Structured error types for WebCat.
 */

export class WebCatError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'WebCatError';
  }
}

export class ScopeDeniedError extends WebCatError {
  constructor(
    message: string,
    public readonly target: string,
    public readonly reason: string,
  ) {
    super('SCOPE_DENIED', message, { target, reason });
    this.name = 'ScopeDeniedError';
  }
}

export class ApprovalRequiredError extends WebCatError {
  constructor(
    message: string,
    public readonly approvalId: string,
  ) {
    super('APPROVAL_REQUIRED', message, { approvalId });
    this.name = 'ApprovalRequiredError';
  }
}

export class AuthorizationError extends WebCatError {
  constructor(message: string, details?: unknown) {
    super('UNAUTHORIZED', message, details);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends WebCatError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends WebCatError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} not found: ${id}`, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class McpConnectionError extends WebCatError {
  constructor(
    message: string,
    public readonly serverName: string,
  ) {
    super('MCP_CONNECTION_ERROR', message, { serverName });
    this.name = 'McpConnectionError';
  }
}

export class RateLimitError extends WebCatError {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
  ) {
    super('RATE_LIMITED', message, { retryAfterMs });
    this.name = 'RateLimitError';
  }
}
