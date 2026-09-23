import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getInquireStatusMock } = vi.hoisted(() => ({ getInquireStatusMock: vi.fn() }));

vi.mock('../../../../lib/orchestrator-client', () => ({
  orchestratorClient: { getInquireStatus: getInquireStatusMock },
}));

import { GET } from './route';

describe('GET /api/inquire-status/[requestId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the current label and partialText from the orchestrator client', async () => {
    getInquireStatusMock.mockResolvedValue({ label: 'pensando…', partialText: 'Hola, Fel' });

    const response = await GET(new Request('http://localhost/api/inquire-status/r1'), {
      params: Promise.resolve({ requestId: 'r1' }),
    });

    expect(getInquireStatusMock).toHaveBeenCalledWith('r1');
    await expect(response.json()).resolves.toEqual({ label: 'pensando…', partialText: 'Hola, Fel' });
  });

  it('returns { label: null, partialText: "" } when the request finished, is unknown, or errored', async () => {
    getInquireStatusMock.mockResolvedValue({ label: null, partialText: '' });

    const response = await GET(new Request('http://localhost/api/inquire-status/r2'), {
      params: Promise.resolve({ requestId: 'r2' }),
    });

    await expect(response.json()).resolves.toEqual({ label: null, partialText: '' });
  });
});
