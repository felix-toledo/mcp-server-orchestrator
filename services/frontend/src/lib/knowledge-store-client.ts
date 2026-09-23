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
  folderId: string | null;
  updatedAt: string;
}

export interface KnowledgeEntryDetail extends KnowledgeEntrySummary {
  content: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

export interface ChatSessionDetail extends ChatSessionSummary {
  createdAt: string;
  messages: Array<{ id: string; role: 'USER' | 'ASSISTANT' | 'TOOL'; content: string; createdAt: string }>;
}

export interface VaultFolder {
  id: string;
  path: string;
  parentId: string | null;
  summary: string;
}

export type VoiceProfileStatus = 'NOT_TRAINED' | 'TRAINED';

export interface VoiceProfile {
  status: VoiceProfileStatus;
  trainedAt: string | null;
  enrollmentAudioPath: string | null;
  currentSessionId: string | null;
}

export interface VoiceProfileEnrollResult {
  status: VoiceProfileStatus;
  trainedAt: string | null;
  enrollmentAudioPath: string | null;
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

  async createKnowledgeEntry(input: {
    title: string;
    content: string;
    folderPath?: string;
  }): Promise<KnowledgeEntrySummary> {
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

  async listChatSessions(): Promise<ChatSessionSummary[]> {
    const response = await fetch(`${this.baseUrl}/chat-sessions`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`No se pudieron listar las sesiones: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as ChatSessionSummary[];
  }

  async getChatSession(id: string): Promise<ChatSessionDetail | null> {
    const response = await fetch(`${this.baseUrl}/chat-sessions/${id}`, { cache: 'no-store' });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`No se pudo obtener la sesión: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as ChatSessionDetail;
  }

  async deleteChatSession(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat-sessions/${id}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`No se pudo borrar la sesión: ${await parseErrorBody(response)}`);
    }
  }

  async listVaultFolders(): Promise<VaultFolder[]> {
    const response = await fetch(`${this.baseUrl}/vault-folders`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`No se pudieron listar las carpetas: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as VaultFolder[];
  }

  async createVaultFolder(path: string): Promise<VaultFolder> {
    const response = await fetch(`${this.baseUrl}/vault-folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) {
      throw new Error(`No se pudo crear la carpeta: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as VaultFolder;
  }

  async deleteVaultFolder(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/vault-folders/${id}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`No se pudo borrar la carpeta: ${await parseErrorBody(response)}`);
    }
  }

  async getVoiceProfile(): Promise<VoiceProfile | null> {
    const response = await fetch(`${this.baseUrl}/voice-profile`, { cache: 'no-store' });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`No se pudo obtener el perfil de voz: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as VoiceProfile;
  }

  async enrollVoiceProfile(formData: FormData): Promise<VoiceProfileEnrollResult> {
    const response = await fetch(`${this.baseUrl}/voice-profile/enroll`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`No se pudo entrenar el perfil de voz: ${await parseErrorBody(response)}`);
    }
    return (await response.json()) as VoiceProfileEnrollResult;
  }
}

export const knowledgeStoreClient = new KnowledgeStoreClient(
  process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025',
);
