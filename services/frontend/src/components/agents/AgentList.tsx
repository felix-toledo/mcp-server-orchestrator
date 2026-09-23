'use client';

import { useState } from 'react';
import { createAgent } from '../../actions/create-agent';
import { deleteAgent } from '../../actions/delete-agent';
import { listAgents, type Agent } from '../../actions/list-agents';

export function AgentList({ initialAgents }: { initialAgents: Agent[] }) {
  const [agents, setAgents] = useState(initialAgents);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setAgents(await listAgents());
  }

  async function handleCreate() {
    if (!name.trim() || !prompt.trim()) return;
    setIsCreating(true);
    setError(null);
    const result = await createAgent(name.trim(), prompt.trim());
    setIsCreating(false);
    if (result.ok) {
      setName('');
      setPrompt('');
      await refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleDelete(id: string) {
    await deleteAgent(id);
    await refresh();
  }

  return (
    <section className="agent-list">
      <div className="agent-list__header">
        <h2 className="text-heading">Agentes</h2>
        <p className="text-caption">
          Un agente es un preset: un system prompt propio que se suma a las reglas base de ALMA, más qué tools/skills
          puede usar. Otros agentes pueden invocarlo.
        </p>
      </div>

      <div className="card agent-list__form">
        <div className="field">
          <label className="field__label" htmlFor="agent-name">
            Nombre
          </label>
          <input id="agent-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="agent-prompt">
            Instrucciones adicionales
          </label>
          <textarea
            id="agent-prompt"
            className="textarea"
            rows={4}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="alert alert--danger">
            <span className="alert__icon" aria-hidden="true">
              ⚠
            </span>
            {error}
          </p>
        )}
        <button type="button" className="btn btn--primary" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? 'Creando…' : 'Crear agente'}
        </button>
      </div>

      {agents.length === 0 ? (
        <p className="card card--empty">Todavía no configuraste ningún agente.</p>
      ) : (
        <ul className="agent-list__items">
          {agents.map((agent) => (
            <li key={agent.id} className="card agent-list__item">
              <div className="agent-list__item-info">
                <p className="text-body-strong">{agent.name}</p>
                <p className="text-body-sm">{agent.systemPromptAddendum}</p>
              </div>
              <button type="button" className="btn btn--ghost" onClick={() => handleDelete(agent.id)}>
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
