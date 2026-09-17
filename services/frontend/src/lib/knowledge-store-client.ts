export type Purpose = 'PERSONAL_DAILY' | 'AUTOMATION_PRODUCTIVITY' | 'PROJECTS_WORK' | 'SECOND_BRAIN_STUDY' | 'TEAM_BUSINESS';

export interface CreateUserInput {
  name: string;
  email: string;
  purpose: Purpose;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  purpose: Purpose;
}

export interface KnowledgeEntrySummary {
  id: string;
  path: string;
  title: string;
  summary: string;
  updatedAt: string;
}

export interface KnowledgeEntryDetail extends KnowledgeEntrySummary {
  content: string;
}

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export class KnowledgeStoreClient {
  constructor(private readonly baseUrl: string) {}

  async createUser(input: CreateUserInput): Promise<CurrentUser> {
    const response = await fetch(`${this.baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(`No se pudo crear el usuario: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as CurrentUser;
  }

  async getCurrentUser(): Promise<CurrentUser | null> {
    const response = await fetch(`${this.baseUrl}/users/me`, { cache: 'no-store' });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`No se pudo obtener el usuario actual: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as CurrentUser;
  }

  async createKnowledgeEntry(input: { title: string; content: string }): Promise<KnowledgeEntrySummary> {
    const response = await fetch(`${this.baseUrl}/knowledge-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(`No se pudo crear el conocimiento: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as KnowledgeEntrySummary;
  }

  async listKnowledgeEntries(): Promise<KnowledgeEntrySummary[]> {
    const response = await fetch(`${this.baseUrl}/knowledge-entries`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`No se pudo listar el conocimiento: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as KnowledgeEntrySummary[];
  }

  async getKnowledgeEntry(id: string): Promise<KnowledgeEntryDetail | null> {
    const response = await fetch(`${this.baseUrl}/knowledge-entries/${id}`, { cache: 'no-store' });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`No se pudo obtener la nota: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as KnowledgeEntryDetail;
  }

  async updateKnowledgeEntry(id: string, content: string): Promise<KnowledgeEntrySummary> {
    const response = await fetch(`${this.baseUrl}/knowledge-entries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      throw new Error(`No se pudo guardar la nota: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as KnowledgeEntrySummary;
  }
}

export const knowledgeStoreClient = new KnowledgeStoreClient(
  process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025',
);
