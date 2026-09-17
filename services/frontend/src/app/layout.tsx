import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono, Newsreader } from 'next/font/google';
import './globals.css';

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
    <html
      lang="es"
      className={`${instrumentSans.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
