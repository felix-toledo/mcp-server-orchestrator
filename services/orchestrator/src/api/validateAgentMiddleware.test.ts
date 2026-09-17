import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { validateAgentMiddleware } from './validateAgentMiddleware.js';

function createResponse() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('validateAgentMiddleware', () => {
  const originalKey = process.env.KEY_ALLOWED_AGENTS;

  beforeEach(() => {
    process.env.KEY_ALLOWED_AGENTS = 'test-key';
  });

  afterEach(() => {
    process.env.KEY_ALLOWED_AGENTS = originalKey;
  });

  it('rejects a request with no KAA header', () => {
    const req = { headers: {} } as Request;
    const res = createResponse();
    const next = vi.fn();

    validateAgentMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong KAA header', () => {
    const req = { headers: { kaa: 'wrong-key' } } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    validateAgentMiddleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the KAA header matches', () => {
    const req = { headers: { kaa: 'test-key' } } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    validateAgentMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('fails closed with a 500 when KEY_ALLOWED_AGENTS is not configured', () => {
    delete process.env.KEY_ALLOWED_AGENTS;
    const req = { headers: { kaa: 'anything' } } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    validateAgentMiddleware(req, res, next);

    expect(res.statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });
});
