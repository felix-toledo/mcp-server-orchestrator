'use client';

import { useState } from 'react';
import { saveTelegramToken } from '../../actions/save-telegram-token';
import type { TelegramStatus } from '../../actions/get-telegram-status';
import { updateTelegramAllowlist } from '../../actions/update-telegram-allowlist';
import { VoiceEnrollmentSection } from './VoiceEnrollmentSection';

function parseUsernames(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((u) => u.trim())
    .filter(Boolean);
}

export function SettingsPanel({
  telegramStatus,
  botLink,
  qrSvg,
}: {
  telegramStatus: TelegramStatus;
  botLink: string | null;
  qrSvg: string | null;
}) {
  const [token, setToken] = useState('');
  const [usernamesText, setUsernamesText] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(telegramStatus.configured);
  const [chatId] = useState(telegramStatus.chatId);
  const [allowedUsernames, setAllowedUsernames] = useState(telegramStatus.allowedUsernames);
  const [allowlistText, setAllowlistText] = useState(telegramStatus.allowedUsernames.join(', '));
  const [allowlistStatus, setAllowlistStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handleSaveTelegram() {
    if (!token.trim()) return;
    setStatus('saving');
    setError(null);
    const usernames = parseUsernames(usernamesText);
    const result = await saveTelegramToken(token.trim(), usernames);
    if (result.ok) {
      setStatus('saved');
      setIsConfigured(true);
      setAllowedUsernames(usernames);
      setAllowlistText(usernames.join(', '));
    } else {
      setStatus('error');
      setError(result.error);
    }
  }

  async function handleUpdateAllowlist() {
    setAllowlistStatus('saving');
    const usernames = parseUsernames(allowlistText);
    const result = await updateTelegramAllowlist(usernames);
    if (result.ok) {
      setAllowlistStatus('saved');
      setAllowedUsernames(usernames);
    } else {
      setAllowlistStatus('error');
    }
  }

  return (
    <section className="settings-panel">
      <div className="settings-panel__header">
        <h2 className="text-heading">Settings</h2>
      </div>

      <div className="settings-panel__section card">
        <h3 className="text-body-strong">Telegram</h3>

        {!isConfigured ? (
          <>
            <p className="text-caption">
              Creá un bot con @BotFather y pegá el token acá. Solo van a poder hablarle los usuarios de Telegram que
              listes abajo — nadie más queda vinculado, ni aunque te escriba primero.
            </p>
            <div className="field">
              <label className="field__label" htmlFor="telegram-token">
                Token del bot
              </label>
              <input
                id="telegram-token"
                className="input"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="123456:ABC-token-de-telegram"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="telegram-usernames">
                Usuarios permitidos
              </label>
              <input
                id="telegram-usernames"
                className="input"
                value={usernamesText}
                onChange={(event) => setUsernamesText(event.target.value)}
                placeholder="@felix"
              />
              <p className="field__hint">Usernames de Telegram (con o sin @), separados por coma.</p>
            </div>
            <button type="button" className="btn btn--primary" onClick={handleSaveTelegram} disabled={status === 'saving'}>
              {status === 'saving' ? 'Guardando…' : 'Conectar'}
            </button>
            {status === 'error' && (
              <p role="alert" className="alert alert--danger">
                <span className="alert__icon" aria-hidden="true">
                  ⚠
                </span>
                {error}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="field__hint">
              {chatId ? 'Conectado — ' : 'Token guardado, esperando el primer mensaje de un usuario permitido — '}
              escribile a tu bot desde Telegram para empezar.
            </p>

            {botLink && (
              <div className="settings-panel__bot-link">
                {qrSvg && (
                  <div className="settings-panel__qr" dangerouslySetInnerHTML={{ __html: qrSvg }} aria-hidden="true" />
                )}
                <a href={botLink} target="_blank" rel="noreferrer" className="text-mono-sm">
                  {botLink}
                </a>
              </div>
            )}

            <div className="field">
              <label className="field__label" htmlFor="telegram-usernames-edit">
                Usuarios permitidos
              </label>
              <input
                id="telegram-usernames-edit"
                className="input"
                value={allowlistText}
                onChange={(event) => setAllowlistText(event.target.value)}
                placeholder="@felix"
              />
              <p className="field__hint">Usernames de Telegram (con o sin @), separados por coma.</p>
            </div>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleUpdateAllowlist}
              disabled={allowlistStatus === 'saving'}
            >
              {allowlistStatus === 'saving' ? 'Guardando…' : 'Actualizar usuarios permitidos'}
            </button>
            {allowlistStatus === 'error' && (
              <p role="alert" className="alert alert--danger">
                <span className="alert__icon" aria-hidden="true">
                  ⚠
                </span>
                No pude actualizar la lista. Intentá de nuevo.
              </p>
            )}
            {allowedUsernames.length === 0 && (
              <p className="field__hint">Sin usuarios permitidos todavía — nadie puede hablarle al bot.</p>
            )}
          </>
        )}
      </div>

      <VoiceEnrollmentSection />

      <div className="settings-panel__section card card--empty">
        <p>WhatsApp — próximamente.</p>
      </div>

      <div className="settings-panel__section card card--empty">
        <p>Notificaciones — próximamente.</p>
      </div>
    </section>
  );
}
