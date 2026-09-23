'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AgendaIcon, AgentsIcon, ChatIcon, ExplorerIcon, ProjectsIcon, SettingsIcon } from './icons';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { href: '/', label: 'Chat', icon: ChatIcon },
  { href: '/projects', label: 'Proyectos', icon: ProjectsIcon },
  { href: '/explorer', label: 'Explorar archivos', icon: ExplorerIcon },
  { href: '/agendas', label: 'Agendas', icon: AgendaIcon },
  { href: '/agents', label: 'Agentes y skills', icon: AgentsIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <span className="app-sidebar__mark">Alma</span>
      <nav className="app-nav">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`app-nav__item ${pathname === item.href ? 'app-nav__item--active' : ''}`}
          >
            <item.icon />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="app-sidebar__footer">
        <ThemeToggle />
      </div>
    </aside>
  );
}
