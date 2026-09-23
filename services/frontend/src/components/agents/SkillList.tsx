'use client';

import { useState } from 'react';
import { createSkill } from '../../actions/create-skill';
import { deleteSkill } from '../../actions/delete-skill';
import { listSkills, type Skill } from '../../actions/list-skills';

export function SkillList({ initialSkills }: { initialSkills: Skill[] }) {
  const [skills, setSkills] = useState(initialSkills);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setSkills(await listSkills());
  }

  async function handleCreate() {
    if (!name.trim() || !description.trim() || !instructions.trim()) return;
    setIsCreating(true);
    setError(null);
    const result = await createSkill(name.trim(), description.trim(), instructions.trim());
    setIsCreating(false);
    if (result.ok) {
      setName('');
      setDescription('');
      setInstructions('');
      await refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleDelete(id: string) {
    await deleteSkill(id);
    await refresh();
  }

  return (
    <section className="agent-list">
      <div className="agent-list__header">
        <h2 className="text-heading">Skills</h2>
        <p className="text-caption">
          Un skill es conocimiento reusable: una descripción (para que ALMA decida solo cuándo aplicarlo) más
          instrucciones concretas. Cualquier agente o equipo puede combinar varios.
        </p>
      </div>

      <div className="card agent-list__form">
        <div className="field">
          <label className="field__label" htmlFor="skill-name">
            Nombre
          </label>
          <input id="skill-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="skill-description">
            Descripción
          </label>
          <textarea
            id="skill-description"
            className="textarea"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <p className="field__hint">Cuándo usarlo — esto es lo que ALMA compara contra cada mensaje.</p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="skill-instructions">
            Instrucciones
          </label>
          <textarea
            id="skill-instructions"
            className="textarea"
            rows={4}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
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
          {isCreating ? 'Creando…' : 'Crear skill'}
        </button>
      </div>

      {skills.length === 0 ? (
        <p className="card card--empty">Todavía no configuraste ningún skill.</p>
      ) : (
        <ul className="agent-list__items">
          {skills.map((skill) => (
            <li key={skill.id} className="card agent-list__item">
              <div className="agent-list__item-info">
                <p className="text-body-strong">{skill.name}</p>
                <p className="text-body-sm">{skill.description}</p>
              </div>
              <button type="button" className="btn btn--ghost" onClick={() => handleDelete(skill.id)}>
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
