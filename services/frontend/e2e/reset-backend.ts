const MOCK_BACKEND_URL = 'http://localhost:40099';

export async function resetBackend(): Promise<void> {
  await fetch(`${MOCK_BACKEND_URL}/__reset`, { method: 'POST' });
}

export async function seedUser(): Promise<void> {
  await fetch(`${MOCK_BACKEND_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Felix', email: 'felix@test.com', purpose: 'PERSONAL_DAILY' }),
  });
}

export async function seedKnowledgeEntry(title: string, content: string): Promise<void> {
  await fetch(`${MOCK_BACKEND_URL}/knowledge-entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
}
