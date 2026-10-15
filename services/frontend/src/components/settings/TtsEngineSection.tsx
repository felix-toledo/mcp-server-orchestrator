'use client';

import { useEffect, useRef, useState } from 'react';
import { getTtsPreference } from '../../actions/get-tts-preference';
import { updateTtsPreference } from '../../actions/update-tts-preference';
import type { TtsEngine } from '../../lib/knowledge-store-client';
import { PauseIcon, PlayIcon } from '../shell/icons';

interface ElevenLabsVoiceOption {
  id: string;
  name: string;
  gender: string | null;
  accent: string | null;
  sampleUrl: string;
}

const GENDER_LABELS: Record<string, string> = {
  male: 'masculina',
  female: 'femenina',
  neutral: 'neutra',
};

function describeVoice(voice: ElevenLabsVoiceOption): string {
  const gender = voice.gender ? (GENDER_LABELS[voice.gender] ?? voice.gender) : null;
  return [gender, voice.accent].filter(Boolean).join(' · ');
}

/**
 * Settings > Voz's engine/voice picker (ALMA's *output* voice, orthogonal
 * to VoiceEnrollmentSection's speaker-recognition *input* sample above it).
 * `voices.json` + the mp3 samples are static files under `public/` —
 * generated once by `services/voice-assistant/scripts/generate_voice_samples.py`,
 * not fetched live — so this needs no new backend endpoint just to list them.
 */
export function TtsEngineSection() {
  const [voices, setVoices] = useState<ElevenLabsVoiceOption[] | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<TtsEngine>('KOKORO');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/voice-samples/voices.json')
      .then((res) => (res.ok ? (res.json() as Promise<ElevenLabsVoiceOption[]>) : []))
      .then((data) => {
        if (!cancelled) setVoices(data);
      })
      .catch(() => {
        if (!cancelled) setVoices([]);
      });

    getTtsPreference().then((preference) => {
      if (!cancelled) {
        setSelectedEngine(preference.ttsEngine);
        setSelectedVoiceId(preference.ttsVoiceId);
      }
    });

    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, []);

  function playSample(voice: ElevenLabsVoiceOption) {
    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(voice.sampleUrl);
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    void audio.play();
    setPlayingId(voice.id);
  }

  async function selectKokoro() {
    setSelectedEngine('KOKORO');
    setSelectedVoiceId(null);
    setStatus('saving');
    const result = await updateTtsPreference('KOKORO', null);
    setStatus(result.ok ? 'saved' : 'error');
  }

  async function selectElevenLabsVoice(voice: ElevenLabsVoiceOption) {
    setSelectedEngine('ELEVENLABS');
    setSelectedVoiceId(voice.id);
    setStatus('saving');
    const result = await updateTtsPreference('ELEVENLABS', voice.id);
    setStatus(result.ok ? 'saved' : 'error');
  }

  const isLoading = voices === null;

  return (
    <div className="settings-panel__section card">
      <h3 className="text-body-strong">Voz de ALMA</h3>
      <p className="text-caption">
        Elegí con qué voz te contesta ALMA al hablarle — la gratis (local) o una de ElevenLabs.
      </p>

      {isLoading ? (
        <p className="text-caption">cargando voces…</p>
      ) : (
        <div className="voice-picker" role="radiogroup" aria-label="Voz de ALMA">
          <label className={`voice-picker__option${selectedEngine === 'KOKORO' ? ' voice-picker__option--selected' : ''}`}>
            <input
              type="radio"
              name="tts-voice"
              className="voice-picker__radio"
              checked={selectedEngine === 'KOKORO'}
              onChange={selectKokoro}
            />
            <div className="voice-picker__info">
              <span className="text-body-strong">Voz gratis</span>
              <span className="text-caption">Local, sin costo — la voz &quot;fea&quot; de siempre.</span>
            </div>
          </label>

          {voices.map((voice) => {
            const isSelected = selectedEngine === 'ELEVENLABS' && selectedVoiceId === voice.id;
            const isPlaying = playingId === voice.id;
            const description = describeVoice(voice);
            return (
              <label
                key={voice.id}
                className={`voice-picker__option${isSelected ? ' voice-picker__option--selected' : ''}`}
              >
                <input
                  type="radio"
                  name="tts-voice"
                  className="voice-picker__radio"
                  checked={isSelected}
                  onChange={() => selectElevenLabsVoice(voice)}
                />
                <div className="voice-picker__info">
                  <span className="text-body-strong">{voice.name}</span>
                  {description && <span className="text-caption">{description}</span>}
                </div>
                <button
                  type="button"
                  className="btn btn--ghost voice-picker__play"
                  onClick={(event) => {
                    event.preventDefault();
                    playSample(voice);
                  }}
                  aria-label={isPlaying ? `Pausar muestra de ${voice.name}` : `Escuchar muestra de ${voice.name}`}
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
              </label>
            );
          })}
        </div>
      )}

      {status === 'error' && (
        <p role="alert" className="alert alert--danger">
          <span className="alert__icon" aria-hidden="true">
            ⚠
          </span>
          No pude guardar la voz elegida. Intentá de nuevo.
        </p>
      )}
    </div>
  );
}
