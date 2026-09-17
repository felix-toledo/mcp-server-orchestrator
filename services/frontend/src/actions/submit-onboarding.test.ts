import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUserMock, createKnowledgeEntryMock } = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  createKnowledgeEntryMock: vi.fn(),
}));

vi.mock('../lib/knowledge-store-client', () => ({
  knowledgeStoreClient: {
    createUser: createUserMock,
    createKnowledgeEntry: createKnowledgeEntryMock,
  },
}));

import { submitOnboarding, type OnboardingFormState } from './submit-onboarding';

const initialOnboardingFormState: OnboardingFormState = { status: 'idle' };

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

describe('submitOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC2: creates the user then the first knowledge entry, in order, on valid input', async () => {
    createUserMock.mockResolvedValue({ id: 'u1' });
    createKnowledgeEntryMock.mockResolvedValue({ id: 'k1' });

    const result = await submitOnboarding(
      initialOnboardingFormState,
      formData({ name: 'Felix', email: 'felix@x.com', purpose: 'PERSONAL_DAILY' }),
    );

    expect(result.status).toBe('success');
    expect(createUserMock).toHaveBeenCalledWith({
      name: 'Felix',
      email: 'felix@x.com',
      purpose: 'PERSONAL_DAILY',
    });
    expect(createKnowledgeEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Conocimientos', content: expect.stringContaining('Felix') }),
    );
    const userCallOrder = createUserMock.mock.invocationCallOrder[0];
    const entryCallOrder = createKnowledgeEntryMock.mock.invocationCallOrder[0];
    expect(userCallOrder).toBeLessThan(entryCallOrder);
  });

  it('AC4: rejects an invalid email without calling knowledge-store', async () => {
    const result = await submitOnboarding(
      initialOnboardingFormState,
      formData({ name: 'Felix', email: 'not-an-email', purpose: 'PERSONAL_DAILY' }),
    );

    expect(result.status).toBe('error');
    expect(createUserMock).not.toHaveBeenCalled();
    expect(createKnowledgeEntryMock).not.toHaveBeenCalled();
  });

  it('AC4: rejects a missing purpose without calling knowledge-store', async () => {
    const result = await submitOnboarding(
      initialOnboardingFormState,
      formData({ name: 'Felix', email: 'felix@x.com', purpose: '' }),
    );

    expect(result.status).toBe('error');
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('surfaces a knowledge-store failure as a form error instead of throwing', async () => {
    createUserMock.mockRejectedValue(new Error('A user already exists'));

    const result = await submitOnboarding(
      initialOnboardingFormState,
      formData({ name: 'Felix', email: 'felix@x.com', purpose: 'PERSONAL_DAILY' }),
    );

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/already exists/);
  });
});
