import { describe, it, expect } from 'vitest';
import { redactRawHttpHeaders, redactJsonObject, redactString, redactCookieHeader, isSensitiveKey } from './redact.js';

describe('redactRawHttpHeaders', () => {
  it('redacts Authorization header', () => {
    const raw = [
      'GET / HTTP/1.1',
      'Host: example.com',
      'Authorization: Bearer secret-token-123',
      'Accept: application/json',
      '',
      'body',
    ].join('\n');

    const result = redactRawHttpHeaders(raw);
    expect(result).toContain('Host: example.com');
    expect(result).toContain('Authorization: [REDACTED]');
    expect(result).toContain('Accept: application/json');
    expect(result).toContain('body');
    expect(result).not.toContain('secret-token-123');
  });

  it('redacts Cookie header', () => {
    const raw = [
      'GET / HTTP/1.1',
      'Cookie: session=abc123; token=xyz',
      '',
      'body',
    ].join('\n');

    const result = redactRawHttpHeaders(raw);
    expect(result).toContain('Cookie: [REDACTED]');
  });

  it('preserves request line', () => {
    const raw = 'POST /api/login HTTP/1.1\nAuthorization: Bearer tok\n\nbody';
    const result = redactRawHttpHeaders(raw);
    expect(result).toContain('POST /api/login HTTP/1.1');
  });

  it('preserves body intact', () => {
    const raw = 'GET / HTTP/1.1\n\n{"token": "secret"}';
    const result = redactRawHttpHeaders(raw);
    expect(result).toContain('{"token": "secret"}');
  });

  it('returns empty string unchanged', () => {
    expect(redactRawHttpHeaders('')).toBe('');
  });

  it('respects allowSensitiveHeaders option', () => {
    const raw = 'GET / HTTP/1.1\nAuthorization: Bearer tok\n\n';
    const result = redactRawHttpHeaders(raw, { allowSensitiveHeaders: true });
    expect(result).toContain('Authorization: Bearer tok');
  });
});

describe('redactJsonObject', () => {
  it('redacts password fields', () => {
    const obj = { username: 'user', password: 'secret123' };
    const result = redactJsonObject(obj) as Record<string, unknown>;
    expect(result.username).toBe('user');
    expect(result.password).toBe('[REDACTED]');
  });

  it('redacts nested sensitive fields', () => {
    const obj = { auth: { token: 'abc', user: 'test' } };
    const result = redactJsonObject(obj) as Record<string, unknown>;
    const auth = result.auth as Record<string, unknown>;
    expect(auth.token).toBe('[REDACTED]');
    expect(auth.user).toBe('test');
  });

  it('handles arrays', () => {
    const arr = [{ password: 'a' }, { password: 'b' }];
    const result = redactJsonObject(arr) as Record<string, unknown>[];
    expect(result[0].password).toBe('[REDACTED]');
    expect(result[1].password).toBe('[REDACTED]');
  });
});

describe('redactString', () => {
  it('redacts Bearer tokens', () => {
    const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const result = redactString(text);
    expect(result).not.toContain('eyJhbGci');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts AWS key patterns', () => {
    const text = 'key=AKIAIOSFODNN7EXAMPLE';
    const result = redactString(text);
    expect(result).not.toContain('AKIA');
  });
});

describe('redactCookieHeader', () => {
  it('redacts cookie values but preserves names and flags', () => {
    const cookie = 'session=abc123; Secure; HttpOnly; SameSite=Lax';
    const result = redactCookieHeader(cookie);
    expect(result).toContain('session=[REDACTED]');
    expect(result).toContain('Secure');
    expect(result).toContain('HttpOnly');
    expect(result).toContain('SameSite=Lax');
  });
});

describe('isSensitiveKey', () => {
  it('identifies password as sensitive', () => {
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('PASSWORD')).toBe(true);
  });

  it('identifies api_key as sensitive', () => {
    expect(isSensitiveKey('api_key')).toBe(true);
  });

  it('identifies non-sensitive keys', () => {
    expect(isSensitiveKey('username')).toBe(false);
    expect(isSensitiveKey('email')).toBe(false);
  });
});
