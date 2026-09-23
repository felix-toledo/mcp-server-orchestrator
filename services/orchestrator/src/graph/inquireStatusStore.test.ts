import { afterEach, describe, expect, it } from 'vitest';
import {
  appendPartialText,
  clearInquireStatus,
  getInquireStatus,
  labelForNode,
  resetPartialText,
  setInquireStatus,
} from './inquireStatusStore.js';

describe('inquireStatusStore (live-status amendment)', () => {
  afterEach(() => {
    clearInquireStatus('r1');
  });

  it('returns null for a requestId that was never set', () => {
    expect(getInquireStatus('never-set')).toBeNull();
  });

  it('returns the last label set for a requestId', () => {
    setInquireStatus('r1', 'pensando…');
    expect(getInquireStatus('r1')?.label).toBe('pensando…');

    setInquireStatus('r1', 'usando herramientas o consultando a otros agentes…');
    expect(getInquireStatus('r1')?.label).toBe('usando herramientas o consultando a otros agentes…');
  });

  it('clearInquireStatus makes a subsequent read return null', () => {
    setInquireStatus('r1', 'pensando…');
    clearInquireStatus('r1');
    expect(getInquireStatus('r1')).toBeNull();
  });

  it('labelForNode maps every real graph node to a label, and an unknown node to undefined', () => {
    expect(labelForNode('callLlm')).toBeTruthy();
    expect(labelForNode('finalizeResponse')).toBeTruthy();
    expect(labelForNode('not-a-real-node')).toBeUndefined();
  });

  describe('partialText (2026-09-18 web live-typing addendum)', () => {
    it('accumulates chunks in order', () => {
      resetPartialText('r1');
      appendPartialText('r1', 'Hola');
      appendPartialText('r1', ', ');
      appendPartialText('r1', 'Felix');
      expect(getInquireStatus('r1')?.partialText).toBe('Hola, Felix');
    });

    it('resetPartialText clears previous text without touching the current label', () => {
      setInquireStatus('r1', 'pensando…');
      appendPartialText('r1', 'texto viejo');
      resetPartialText('r1');
      expect(getInquireStatus('r1')).toEqual(expect.objectContaining({ label: 'pensando…', partialText: '' }));
    });

    it('setInquireStatus never wipes out partialText already accumulated', () => {
      appendPartialText('r1', 'Hola');
      setInquireStatus('r1', 'usando herramientas o consultando a otros agentes…');
      expect(getInquireStatus('r1')?.partialText).toBe('Hola');
    });
  });
});
