import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeStoreClient } from './knowledgeStoreClient.js';

describe('KnowledgeStoreClient (orchestrator, ADR-0002)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('createChatSession resolves with the created session on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 's1', title: null, createdAt: 'x', updatedAt: 'x' }), { status: 201 }),
    );

    const client = new KnowledgeStoreClient('http://localhost:30025');
    const result = await client.createChatSession();

    expect(result.id).toBe('s1');
    expect(fetch).toHaveBeenCalledWith('http://localhost:30025/chat-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: undefined }),
    });
  });

  it('createChatSession forwards a teamId when starting a team-scoped session (team-chat amendment)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 's1', title: null, createdAt: 'x', updatedAt: 'x' }), { status: 201 }),
    );
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await client.createChatSession('t1');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:30025/chat-sessions',
      expect.objectContaining({ body: JSON.stringify({ teamId: 't1' }) }),
    );
  });

  it('createChatSession throws a descriptive error on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('server exploded', { status: 500 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.createChatSession()).rejects.toThrow(/knowledge-store request failed \(500\)/);
  });

  describe('hasCompletedOnboarding (real bug found live 2026-09-18)', () => {
    it('returns false when knowledge-store has no User row yet', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'No user yet' }), { status: 404 }));
      const client = new KnowledgeStoreClient('http://localhost:30025');
      await expect(client.hasCompletedOnboarding()).resolves.toBe(false);
      expect(fetch).toHaveBeenCalledWith('http://localhost:30025/users/me');
    });

    it('returns true once a User row exists', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'u1' }), { status: 200 }));
      const client = new KnowledgeStoreClient('http://localhost:30025');
      await expect(client.hasCompletedOnboarding()).resolves.toBe(true);
    });

    it('fails open (true) on a network error, never permanently locking out chat', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('knowledge-store unreachable'));
      const client = new KnowledgeStoreClient('http://localhost:30025');
      await expect(client.hasCompletedOnboarding()).resolves.toBe(true);
    });
  });

  it('appendChatMessage posts role/content to the right endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');

    await client.appendChatMessage('s1', 'USER', 'hola');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:30025/chat-sessions/s1/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ role: 'USER', content: 'hola' }),
      }),
    );
  });

  it('appendChatMessage throws on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.appendChatMessage('missing', 'USER', 'hola')).rejects.toThrow(
      /knowledge-store request failed \(404\)/,
    );
  });

  it('listAgents resolves with the configured agents on success', async () => {
    const agents = [{ id: 'a1', name: 'Investigador', systemPromptAddendum: 'x', allowedTools: null, allowedSkills: null, pipelineSteps: null }];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(agents), { status: 200 }));

    const client = new KnowledgeStoreClient('http://localhost:30025');
    const result = await client.listAgents();

    expect(result).toEqual(agents);
    expect(fetch).toHaveBeenCalledWith('http://localhost:30025/agents');
  });

  it('AC2: listAgents fails open to [] on a non-2xx status, never throws', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('server exploded', { status: 500 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.listAgents()).resolves.toEqual([]);
  });

  it('AC2: listAgents fails open to [] when knowledge-store is unreachable, never throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.listAgents()).resolves.toEqual([]);
  });

  it('listSkills resolves with the configured skills on success', async () => {
    const skills = [{ id: 's1', name: 'tono-formal', description: 'x', instructions: 'y' }];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(skills), { status: 200 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.listSkills()).resolves.toEqual(skills);
    expect(fetch).toHaveBeenCalledWith('http://localhost:30025/skills');
  });

  it('listSkills fails open to [] on a non-2xx status or unreachable, never throws', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('down', { status: 500 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.listSkills()).resolves.toEqual([]);
  });

  it('listTeams resolves with the configured teams on success', async () => {
    const teams = [
      { id: 't1', name: 'Marketing', memberAgentIds: ['a1'], coordinatorAgentId: 'a1', hierarchy: null, projectFolderIds: [], allowedSkillIds: null },
    ];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(teams), { status: 200 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.listTeams()).resolves.toEqual(teams);
    expect(fetch).toHaveBeenCalledWith('http://localhost:30025/teams');
  });

  it('listTeams fails open to [] on a non-2xx status or unreachable, never throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.listTeams()).resolves.toEqual([]);
  });

  it('listVaultFolders resolves with the configured folders on success', async () => {
    const folders = [{ id: 'f1', path: 'proyectos/tfg', summary: 'resumen' }];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(folders), { status: 200 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.listVaultFolders()).resolves.toEqual(folders);
    expect(fetch).toHaveBeenCalledWith('http://localhost:30025/vault-folders');
  });

  it('listVaultFolders fails open to [] on a non-2xx status or unreachable, never throws', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('down', { status: 500 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.listVaultFolders()).resolves.toEqual([]);
  });

  describe('getProfileNote (2026-09-18 addendum)', () => {
    it('resolves with the profile note on success', async () => {
      const note = { title: 'Perfil', content: '# Perfil\n\n- Mi novia: Melisa' };
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(note), { status: 200 }));
      const client = new KnowledgeStoreClient('http://localhost:30025');
      await expect(client.getProfileNote()).resolves.toEqual(note);
      expect(fetch).toHaveBeenCalledWith('http://localhost:30025/knowledge-entries/profile');
    });

    it('fails open to null on a non-2xx status (e.g. 404 — no profile note yet)', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }));
      const client = new KnowledgeStoreClient('http://localhost:30025');
      await expect(client.getProfileNote()).resolves.toBeNull();
    });

    it('fails open to null when knowledge-store is unreachable, never throws', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
      const client = new KnowledgeStoreClient('http://localhost:30025');
      await expect(client.getProfileNote()).resolves.toBeNull();
    });
  });
});
