import type { Voice } from '../../constants/createPost/types';

/**
 * VOICE NOTES: currently switched off ("coming soon").
 *
 * The composer already calls `useVoiceNote()` and passes its values around, so turning the feature
 * on is a swap in THIS file plus the few `[VOICE-NOTES]` blocks listed in README.md:
 *
 *   1. Delete the "INERT STUB" below.
 *   2. Remove the comment markers around "REAL IMPLEMENTATION" (and its imports).
 *   3. Follow the `[VOICE-NOTES]` markers (grep for them): external.ts, CreatePost.tsx.
 */

export type VoiceNoteApi = {
  isRecording: boolean;
  seconds: number;
  voice: Voice | null;
  error: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  remove: () => void;
};

/* ============================ INERT STUB (active) ============================ */
export function useVoiceNote(): VoiceNoteApi {
  return {
    isRecording: false,
    seconds: 0,
    voice: null,
    error: '',
    start: async () => {},
    stop: async () => {},
    remove: () => {},
  };
}

/* ====================== REAL IMPLEMENTATION (commented out) ======================

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { MAX_RECORDING_SECONDS } from '../external';

export function useVoiceNote(): VoiceNoteApi {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);
  const [voice, setVoice] = useState<Voice | null>(null);
  const [error, setError] = useState('');
  const stopping = useRef(false);

  const isRecording = recState.isRecording;
  const seconds = Math.floor(recState.durationMillis / 1000);

  const start = async () => {
    setError('');
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return setError('Microphone permission denied');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      stopping.current = false;
      recorder.record();
    } catch {
      setError('Could not access microphone');
    }
  };

  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    const secs = Math.max(1, Math.round(recState.durationMillis / 1000));
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (recorder.uri) setVoice({ uri: recorder.uri, duration: secs });
    } catch {
      setError('Could not save the recording');
    }
  };

  // hard stop at the max length
  useEffect(() => {
    if (isRecording && recState.durationMillis >= MAX_RECORDING_SECONDS * 1000) stop();
  }, [isRecording, recState.durationMillis]);

  return { isRecording, seconds, voice, error, start, stop, remove: () => setVoice(null) };
}

=============================================================================== */
