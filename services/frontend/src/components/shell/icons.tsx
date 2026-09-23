// Outline SVG icons — the only file that should author raw <svg> markup.
// Every icon uses the shared `.icon` class (globals.css) for size/stroke,
// so swapping to an icon library later only touches this file.

export function ChatIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 4.5h14v9H8l-3.5 3v-3H3v-9Z" />
    </svg>
  );
}

export function ProjectsIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 6.5 8 3l5 3.5M3 6.5v9h10v-9M3 6.5 8 10l5-3.5" />
    </svg>
  );
}

export function ExplorerIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 5.5a1 1 0 0 1 1-1h3.5l1.5 2H16a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8.5Z" />
    </svg>
  );
}

export function AgendaIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3.5" y="4" width="13" height="12" rx="1.5" />
      <path d="M3.5 8h13M7 2.5v3M13 2.5v3" />
    </svg>
  );
}

export function AgentsIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="14" cy="8.5" r="2" />
      <path d="M2.5 16c.5-3 2-4.5 4.5-4.5s4 1.5 4.5 4.5M12.5 16c.3-2 1.3-3.3 3-3.3s2.7 1.3 3 3.3" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 3v2M10 15v2M17 10h-2M5 10H3M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4M14.9 14.9l-1.4-1.4M6.5 6.5 5.1 5.1" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="3" />
      <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M15.5 12.3A6 6 0 0 1 7.7 4.5a6.3 6.3 0 1 0 7.8 7.8Z" />
    </svg>
  );
}

export function SystemIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="9" rx="1" />
      <path d="M7 16h6M10 13.5V16" />
    </svg>
  );
}
