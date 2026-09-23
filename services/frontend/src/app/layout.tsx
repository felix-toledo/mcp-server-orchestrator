import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono, Newsreader } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

// Sets [data-theme] on <html> from localStorage (falling back to the OS
// preference) before hydration, so the page never flashes the wrong theme.
const THEME_INIT_SCRIPT = `(function(){try{var k='alma-theme';var s=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(s==='light'||s==='dark')?s:(d?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['italic'],
  variable: '--font-serif',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ALMA',
  description: 'Tu asistente de conocimiento personal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. Scribe-style page
    // recorders) inject attributes like data-scribe-recorder-ready onto
    // <html> before React hydrates — a false-positive mismatch, not a real
    // SSR/client divergence. See https://react.dev/link/hydration-mismatch.
    // It also covers the theme-init script below, which sets [data-theme]
    // on <html> before hydration on purpose (never present in the SSR markup).
    <html
      lang="es"
      className={`${instrumentSans.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
