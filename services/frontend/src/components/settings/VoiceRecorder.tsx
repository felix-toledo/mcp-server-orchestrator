'use client';

import { useEffect, useRef, useState } from 'react';
import { enrollVoiceProfile } from '../../actions/enroll-voice-profile';
import type { VoiceProfileStatus } from '../../lib/knowledge-store-client';

type RecorderState = 'requesting-permission' | 'recording' | 'preview' | 'uploading' | 'permission-denied';

interface VoiceRecorderProps {
  onEnrolled: (result: { status: VoiceProfileStatus; trainedAt: string }) => void;
  onCancel: () => void;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

/**
 * Mic capture → elapsed timer → stop → playback preview → discard/re-record
 * → upload confirm (AC4-AC6). Built from the skill's "Control de grabación
 * (voz)" entry: Card container, `danger` pulsing indicator, `mono-sm`
 * counter, ghost/secondary Buttons for the preview controls.
 */
export function VoiceRecorder({ onEnrolled, onCancel }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('requesting-permission');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [captureAttempt, setCaptureAttempt] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startCapture() {
      setPermissionError(null);
      setState('requesting-permission');

      if (!navigator.mediaDevices?.getUserMedia) {
        setPermissionError('Este navegador no permite grabar audio desde el micrófono.');
        setState('permission-denied');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        chunksRef.current = [];

        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          blobRef.current = blob;
          setPreviewUrl(URL.createObjectURL(blob));
          setState('preview');
          stream.getTracks().forEach((track) => track.stop());
        };
        mediaRecorderRef.current = recorder;
        setElapsedSeconds(0);
        recorder.start();
        setState('recording');
      } catch {
        setPermissionError('No se pudo acceder al micrófono — revisá los permisos del navegador para este sitio.');
        setState('permission-denied');
      }
    }

    startCapture();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [captureAttempt]);

  useEffect(() => {
    if (state !== 'recording') return;
    const interval = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleStop() {
    mediaRecorderRef.current?.stop();
  }

  function handleDiscard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setUploadError(null);
    setCaptureAttempt((attempt) => attempt + 1);
  }

  function handleRetryPermission() {
    setCaptureAttempt((attempt) => attempt + 1);
  }

  async function handleConfirmUpload() {
    if (!blobRef.current) return;
    setState('uploading');
    setUploadError(null);

    const formData = new FormData();
    formData.append('audio', blobRef.current, `voice-enrollment.${extensionForMimeType(blobRef.current.type)}`);

    const result = await enrollVoiceProfile(formData);
    if (result.ok) {
      onEnrolled({ status: result.status, trainedAt: result.trainedAt });
    } else {
      setUploadError(result.error);
      setState('preview');
    }
  }

  return (
    <div className="voice-recorder card">
      {state === 'requesting-permission' && <p className="text-caption">pidiendo acceso al micrófono…</p>}

      {state === 'permission-denied' && (
        <>
          <p role="alert" className="field__hint field__hint--danger">
            {permissionError}
          </p>
          <div className="voice-recorder__actions">
            <button type="button" className="btn btn--secondary" onClick={handleRetryPermission}>
              reintentar
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              cancelar
            </button>
          </div>
        </>
      )}

      {state === 'recording' && (
        <>
          <div className="voice-recorder__indicator">
            <span className="voice-recorder__dot" aria-hidden="true" />
            <span className="text-body-sm">grabando</span>
            <span className="text-mono-sm">{formatElapsed(elapsedSeconds)}</span>
          </div>
          <p className="text-caption">grabá entre 10 y 15 segundos hablando con normalidad.</p>
          <div className="voice-recorder__actions">
            <button type="button" className="btn btn--secondary" onClick={handleStop}>
              detener
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              cancelar
            </button>
          </div>
        </>
      )}

      {(state === 'preview' || state === 'uploading') && previewUrl && (
        <>
          <p className="text-caption">escuchá la muestra antes de confirmarla.</p>
          <audio controls src={previewUrl} />
          {uploadError && (
            <p role="alert" className="alert alert--danger">
              <span className="alert__icon" aria-hidden="true">
                ⚠
              </span>
              {uploadError}
            </p>
          )}
          <div className="voice-recorder__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleConfirmUpload}
              disabled={state === 'uploading'}
            >
              {state === 'uploading' ? 'subiendo…' : 'usar esta grabación'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleDiscard}
              disabled={state === 'uploading'}
            >
              descartar y volver a grabar
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={state === 'uploading'}>
              cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
