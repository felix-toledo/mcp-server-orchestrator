'use client';

import { useEffect, useState } from 'react';
import { getVoiceProfileStatus, type VoiceProfileStatusResult } from '../../actions/get-voice-profile-status';
import type { VoiceProfileStatus } from '../../lib/knowledge-store-client';
import { VoiceRecorder } from './VoiceRecorder';

function RetrainConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-scrim" role="presentation" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="retrain-voice-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h4 id="retrain-voice-title" className="text-heading">
          ¿volver a entrenar tu voz?
        </h4>
        <p className="text-body-sm">
          Esto va a reemplazar la muestra de voz anterior en cuanto confirmes una nueva grabación.
        </p>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            cancelar
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm}>
            volver a entrenar
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ isLoading, isTrained, trainedAt }: { isLoading: boolean; isTrained: boolean; trainedAt: string | null }) {
  return (
    <span className={`chip chip--state${isTrained ? ' chip--success' : ''}`}>
      <span className="chip__dot" aria-hidden="true" />
      {isLoading ? 'cargando…' : isTrained ? 'entrenada' : 'no entrenada'}
      {isTrained && trainedAt && <span className="text-mono-sm">{new Date(trainedAt).toLocaleString()}</span>}
    </span>
  );
}

/**
 * Status Chip + entry-point Button (AC1-AC3) and the retrain confirmation
 * Modal gate (AC7). Fetches its own status on mount (same client-side
 * server-action-call shape `ChatPanel` already uses for `getChatSession`)
 * rather than threading it through `settings/page.tsx` as a prop.
 */
export function VoiceEnrollmentSection() {
  const [status, setStatus] = useState<VoiceProfileStatusResult | null>(null);
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [showRetrainConfirm, setShowRetrainConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getVoiceProfileStatus().then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isLoading = status === null;
  const isTrained = status?.status === 'TRAINED';

  function handleEntryClick() {
    if (isTrained) {
      setShowRetrainConfirm(true);
    } else {
      setIsRecorderOpen(true);
    }
  }

  function handleConfirmRetrain() {
    setShowRetrainConfirm(false);
    setIsRecorderOpen(true);
  }

  function handleEnrolled(result: { status: VoiceProfileStatus; trainedAt: string }) {
    setStatus(result);
    setIsRecorderOpen(false);
  }

  return (
    <div className="settings-panel__section card">
      <h3 className="text-body-strong">Voz</h3>
      <p className="text-caption">Grabá una muestra de 10 a 15 segundos para que ALMA reconozca tu voz.</p>

      <StatusChip isLoading={isLoading} isTrained={isTrained} trainedAt={status?.trainedAt ?? null} />

      {!isRecorderOpen && (
        <button
          type="button"
          className={isTrained ? 'btn btn--secondary' : 'btn btn--primary'}
          onClick={handleEntryClick}
          disabled={isLoading}
        >
          {isTrained ? 'volver a entrenar' : 'grabar muestra de voz'}
        </button>
      )}

      {isRecorderOpen && <VoiceRecorder onEnrolled={handleEnrolled} onCancel={() => setIsRecorderOpen(false)} />}

      {showRetrainConfirm && (
        <RetrainConfirmModal onCancel={() => setShowRetrainConfirm(false)} onConfirm={handleConfirmRetrain} />
      )}
    </div>
  );
}
