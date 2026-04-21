import { computed, ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { t } from '../lib/i18n.js';

const timerAlert = ref({
  open: false,
  title: '',
  message: '',
});

const TIMER_SOUND_STORAGE_KEY = 'cucina_timer_sound';
const VALID_TIMER_SOUNDS = ['beep', 'bell', 'kitchen', 'chime', 'alarm', 'digital', 'doublebell', 'siren', 'phone', 'buzzer', 'retro', 'clockradio', 'silent'];
const selectedTimerSound = useLocalStorage(TIMER_SOUND_STORAGE_KEY, 'beep');

let audioContext = null;
let closeTimeout = null;

function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  audioContext.resume().catch(() => {});
  return audioContext;
}

function playOscillatorStep(ctx, destination, options) {
  const {
    startAt,
    duration,
    frequency,
    endFrequency = frequency,
    type = 'sine',
    gain = 0.18,
  } = options;
  const gainNode = ctx.createGain();
  gainNode.connect(destination);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  osc.frequency.exponentialRampToValueAtTime(endFrequency, startAt + duration);
  osc.connect(gainNode);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

function playSelectedTimerSound(soundId = selectedTimerSound.value) {
  try {
    if (soundId === 'silent') return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.01;

    switch (soundId) {
      case 'bell':
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 1.1, frequency: 1046, endFrequency: 784, type: 'triangle', gain: 0.16 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.08, duration: 0.95, frequency: 1568, endFrequency: 1174, type: 'sine', gain: 0.08 });
        break;
      case 'kitchen':
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 0.13, frequency: 1240, endFrequency: 1080, type: 'square', gain: 0.18 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.2, duration: 0.13, frequency: 1240, endFrequency: 1080, type: 'square', gain: 0.18 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.4, duration: 0.16, frequency: 1480, endFrequency: 1320, type: 'square', gain: 0.2 });
        break;
      case 'chime':
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 0.55, frequency: 880, endFrequency: 1174, type: 'sine', gain: 0.14 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.24, duration: 0.7, frequency: 1174, endFrequency: 1568, type: 'sine', gain: 0.12 });
        break;
      case 'alarm':
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 0.22, frequency: 740, endFrequency: 940, type: 'sawtooth', gain: 0.22 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.26, duration: 0.22, frequency: 940, endFrequency: 740, type: 'sawtooth', gain: 0.22 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.52, duration: 0.22, frequency: 740, endFrequency: 940, type: 'sawtooth', gain: 0.22 });
        break;
      case 'digital':
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 0.1, frequency: 1680, endFrequency: 1500, type: 'square', gain: 0.18 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.14, duration: 0.1, frequency: 1680, endFrequency: 1500, type: 'square', gain: 0.18 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.28, duration: 0.1, frequency: 1680, endFrequency: 1500, type: 'square', gain: 0.18 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.5, duration: 0.16, frequency: 1220, endFrequency: 980, type: 'square', gain: 0.16 });
        break;
      case 'doublebell':
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 0.82, frequency: 988, endFrequency: 740, type: 'triangle', gain: 0.14 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.07, duration: 0.72, frequency: 1480, endFrequency: 1046, type: 'sine', gain: 0.08 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.92, duration: 0.82, frequency: 988, endFrequency: 740, type: 'triangle', gain: 0.14 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.99, duration: 0.72, frequency: 1480, endFrequency: 1046, type: 'sine', gain: 0.08 });
        break;
      case 'siren':
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 0.32, frequency: 620, endFrequency: 1180, type: 'sawtooth', gain: 0.18 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.32, duration: 0.32, frequency: 1180, endFrequency: 620, type: 'sawtooth', gain: 0.18 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.64, duration: 0.32, frequency: 620, endFrequency: 1180, type: 'sawtooth', gain: 0.18 });
        break;
      case 'phone':
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 0.18, frequency: 1320, endFrequency: 1180, type: 'triangle', gain: 0.16 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.22, duration: 0.18, frequency: 1568, endFrequency: 1320, type: 'triangle', gain: 0.16 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.62, duration: 0.18, frequency: 1320, endFrequency: 1180, type: 'triangle', gain: 0.16 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.84, duration: 0.18, frequency: 1568, endFrequency: 1320, type: 'triangle', gain: 0.16 });
        break;
      case 'buzzer':
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 0.14, frequency: 980, endFrequency: 920, type: 'square', gain: 0.22 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.18, duration: 0.14, frequency: 980, endFrequency: 920, type: 'square', gain: 0.22 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.36, duration: 0.14, frequency: 980, endFrequency: 920, type: 'square', gain: 0.22 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.54, duration: 0.14, frequency: 980, endFrequency: 920, type: 'square', gain: 0.22 });
        break;
      case 'retro':
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 0.16, frequency: 784, endFrequency: 784, type: 'square', gain: 0.17 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.18, duration: 0.16, frequency: 988, endFrequency: 988, type: 'square', gain: 0.17 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.36, duration: 0.16, frequency: 1174, endFrequency: 1174, type: 'square', gain: 0.17 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.62, duration: 0.22, frequency: 988, endFrequency: 784, type: 'square', gain: 0.18 });
        break;
      case 'clockradio':
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 0.2, frequency: 720, endFrequency: 720, type: 'square', gain: 0.24 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.24, duration: 0.2, frequency: 960, endFrequency: 960, type: 'square', gain: 0.24 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.48, duration: 0.2, frequency: 720, endFrequency: 720, type: 'square', gain: 0.24 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 0.72, duration: 0.2, frequency: 960, endFrequency: 960, type: 'square', gain: 0.24 });
        playOscillatorStep(ctx, ctx.destination, { startAt: now + 1.02, duration: 0.32, frequency: 1320, endFrequency: 1120, type: 'sawtooth', gain: 0.22 });
        break;
      case 'beep':
      default:
        playOscillatorStep(ctx, ctx.destination, { startAt: now, duration: 0.75, frequency: 880, endFrequency: 1320, type: 'sine', gain: 0.2 });
        break;
    }
  } catch (_) {
    // Best effort: unsupported/blocked audio should not break timers.
  }
}

function vibrateIfAvailable() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([180, 80, 180]);
    }
  } catch (_) {
    // Ignore unsupported vibration calls.
  }
}

export function useTimerAlerts() {
  const timerSound = computed(() => (
    VALID_TIMER_SOUNDS.includes(selectedTimerSound.value) ? selectedTimerSound.value : 'beep'
  ));

  function dismissTimerAlert() {
    if (closeTimeout) {
      window.clearTimeout(closeTimeout);
      closeTimeout = null;
    }
    timerAlert.value = {
      open: false,
      title: '',
      message: '',
    };
  }

  function triggerTimerAlert(message, title = t('timer_alarm_title')) {
    playSelectedTimerSound(timerSound.value);
    vibrateIfAvailable();
    timerAlert.value = {
      open: true,
      title,
      message,
    };
    if (closeTimeout) window.clearTimeout(closeTimeout);
    closeTimeout = window.setTimeout(() => {
      dismissTimerAlert();
    }, 10000);
  }

  function setTimerSound(value) {
    selectedTimerSound.value = VALID_TIMER_SOUNDS.includes(value) ? value : 'beep';
  }

  function previewTimerSound() {
    playSelectedTimerSound(timerSound.value);
  }

  return {
    timerAlert,
    timerSound,
    timerSoundOptions: VALID_TIMER_SOUNDS,
    triggerTimerAlert,
    dismissTimerAlert,
    setTimerSound,
    previewTimerSound,
  };
}
