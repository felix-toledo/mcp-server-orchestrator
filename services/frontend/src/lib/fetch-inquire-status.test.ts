import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchInquireStatus } from './fetch-inquire-status';

describe('fetchInquireStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('resolves with the current label and partialText on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ label: 'revisando tu bóveda…', partialText: '' }), { status: 200 }),
    );

    await expect(fetchInquireStatus('r1')).resolves.toEqual({ label: 'revisando tu bóveda…', partialText: '' });
    expect(fetch).toHaveBeenCalledWith('/api/inquire-status/r1', { cache: 'no-store' });
  });

  it('resolves with the growing partialText once the final answer starts streaming in', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ label: 'pensando…', partialText: 'Hola, Fel' }), { status: 200 }));

    await expect(fetchInquireStatus('r1')).resolves.toEqual({ label: 'pensando…', partialText: 'Hola, Fel' });
  });

  it('fails open to { label: null, partialText: "" } on a non-2xx status, never throws', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('down', { status: 500 }));
    await expect(fetchInquireStatus('r1')).resolves.toEqual({ label: null, partialText: '' });
  });

  it('fails open to { label: null, partialText: "" } when the fetch itself throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));
    await expect(fetchInquireStatus('r1')).resolves.toEqual({ label: null, partialText: '' });
  });
});
