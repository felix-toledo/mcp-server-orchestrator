'use client';

import { useState } from 'react';
import type { Agent } from '../../actions/list-agents';
import type { Skill } from '../../actions/list-skills';
import type { Team } from '../../actions/list-teams';
import type { VaultFolder } from '../../lib/knowledge-store-client';
import { AgentList } from './AgentList';
import { SkillList } from './SkillList';
import { TeamList } from './TeamList';

const TABS = [
  { id: 'agents', label: 'Agentes' },
  { id: 'skills', label: 'Skills' },
  { id: 'teams', label: 'Equipos' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AgentsSkillsTeamsPanel({
  agents,
  skills,
  teams,
  vaultFolders,
}: {
  agents: Agent[];
  skills: Skill[];
  teams: Team[];
  vaultFolders: VaultFolder[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>('agents');

  return (
    <div className="agents-page">
      <nav className="agents-page__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`agents-page__tab ${activeTab === tab.id ? 'agents-page__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'agents' && <AgentList initialAgents={agents} />}
      {activeTab === 'skills' && <SkillList initialSkills={skills} />}
      {activeTab === 'teams' && <TeamList initialTeams={teams} agents={agents} vaultFolders={vaultFolders} />}
    </div>
  );
}
