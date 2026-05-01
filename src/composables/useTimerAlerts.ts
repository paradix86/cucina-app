import { computed, ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { t } from '../lib/i18n';

interface TimerAlert {
  open: boolean;
  title: string;
  message: string;
  onSnooze: (() => void) | null;
}

interface OscillatorStepOptions {
  startAt: number;
  duration: number;
  frequency: number;
  endFrequency?: number;
  type?: OscillatorType;
  gain?: number;
}

const timerAlert = ref<TimerAlert>({
  open: false,
  title: '',
  message: '',
  onSnooze: null,
});

const TIMER_SOUND_STORAGE_KEY = 'cucina_timer_sound';
const TIMER_VOLUME_STORAGE_KEY = 'cucina_timer_volume';
const TIMER_DURATION_STORAGE_KEY = 'cucina_timer_duration';
const VALID_TIMER_SOUNDS: string[] = ['beep', 'bell', 'kitchen', 'chime', 'alarm', 'digital', 'doublebell', 'siren', 'phone', 'buzzer', 'retro', 'clockradio', 'silent', 'classic_bell', 'digital_alarm', 'pro_timer', 'industrial_buzzer', 'emergency_beep', 'classic_panic'];
const selectedTimerSound = useLocalStorage(TIMER_SOUND_STORAGE_KEY, 'beep');
const selectedTimerVolume = useLocalStorage(TIMER_VOLUME_STORAGE_KEY, 70);
const selectedTimerDuration = useLocalStorage(TIMER_DURATION_STORAGE_KEY, 5);
const VALID_TIMER_DURATIONS = [2, 5, 10];

let audioContext: AudioContext | null = null;
let closeTimeout: ReturnType<typeof window.setTimeout> | null = null;
const scheduledOscillators: OscillatorNode[] = [];

function stopAllScheduledSounds(): void {
  for (const osc of scheduledOscillators) {
    try { osc.stop(); } catch (_) { /* already stopped */ }
  }
  scheduledOscillators.length = 0;
}

function getAudioContext(): AudioContext | null {
  const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  audioContext.resume().catch(() => { });
  return audioContext;
}

function playOscillatorStep(ctx: AudioContext, destination: AudioNode, options: OscillatorStepOptions): void {
  const {
    startAt,
    duration,
    frequency,
    endFrequency = frequency,
    type = 'sine',
    gain = 0.28,
  } = options;
  const gainNode = ctx.createGain();
  gainNode.connect(destination);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  osc.frequency.exponentialRampToValueAtTime(endFrequency, startAt + duration);
  osc.connect(gainNode);
  scheduledOscillators.push(osc);
  osc.addEventListener('ended', () => {
    const idx = scheduledOscillators.indexOf(osc);
    if (idx !== -1) scheduledOscillators.splice(idx, 1);
  });
  osc.start(startAt);
  osc.stop(startAt + duration);
}

function schedulePatternRepeats(ctx: AudioContext, cycleSeconds: number, totalSeconds: number, patternFn: (offset: number) => void): void {
  const repeats = Math.max(1, Math.ceil(totalSeconds / cycleSeconds));
  for (let index = 0; index < repeats; index += 1) {
    patternFn(index * cycleSeconds);
  }
}

function playSelectedTimerSound(
  soundId = selectedTimerSound.value,
  volume = Number(selectedTimerVolume.value) / 100,
  durationSeconds = Number(selectedTimerDuration.value),
): void {
  try {
    stopAllScheduledSounds();
    if (soundId === 'silent') return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.01;
    const gainScale = Math.max(0, Math.min(1, Number(volume) || 0));
    const totalDuration = VALID_TIMER_DURATIONS.includes(Number(durationSeconds))
      ? Number(durationSeconds)
      : 5;
    const gainOf = (base: number) => Math.max(0.0001, base * gainScale);

    switch (soundId) {
      case 'bell':
        schedulePatternRepeats(ctx, 1.25, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 1.1, frequency: 1046, endFrequency: 784, type: 'square', gain: gainOf(0.26) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.08, duration: 0.95, frequency: 1568, endFrequency: 1174, type: 'triangle', gain: gainOf(0.14) });
        });
        break;
      case 'kitchen':
        schedulePatternRepeats(ctx, 0.72, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 0.13, frequency: 1240, endFrequency: 1080, type: 'square', gain: gainOf(0.28) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.2, duration: 0.13, frequency: 1240, endFrequency: 1080, type: 'square', gain: gainOf(0.28) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.4, duration: 0.16, frequency: 1480, endFrequency: 1320, type: 'square', gain: gainOf(0.30) });
        });
        break;
      case 'chime':
        schedulePatternRepeats(ctx, 1.1, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 0.55, frequency: 880, endFrequency: 1174, type: 'triangle', gain: gainOf(0.26) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.24, duration: 0.7, frequency: 1174, endFrequency: 1568, type: 'triangle', gain: gainOf(0.22) });
        });
        break;
      case 'alarm':
        schedulePatternRepeats(ctx, 0.82, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 0.22, frequency: 740, endFrequency: 940, type: 'sawtooth', gain: gainOf(0.32) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.26, duration: 0.22, frequency: 940, endFrequency: 740, type: 'sawtooth', gain: gainOf(0.32) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.52, duration: 0.22, frequency: 740, endFrequency: 940, type: 'sawtooth', gain: gainOf(0.32) });
        });
        break;
      case 'digital':
        schedulePatternRepeats(ctx, 0.84, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 0.1, frequency: 1680, endFrequency: 1500, type: 'square', gain: gainOf(0.28) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.14, duration: 0.1, frequency: 1680, endFrequency: 1500, type: 'square', gain: gainOf(0.28) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.28, duration: 0.1, frequency: 1680, endFrequency: 1500, type: 'square', gain: gainOf(0.28) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.5, duration: 0.16, frequency: 1220, endFrequency: 980, type: 'square', gain: gainOf(0.24) });
        });
        break;
      case 'doublebell':
        schedulePatternRepeats(ctx, 1.9, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 0.82, frequency: 988, endFrequency: 740, type: 'square', gain: gainOf(0.26) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.07, duration: 0.72, frequency: 1480, endFrequency: 1046, type: 'triangle', gain: gainOf(0.16) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.92, duration: 0.82, frequency: 988, endFrequency: 740, type: 'square', gain: gainOf(0.26) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.99, duration: 0.72, frequency: 1480, endFrequency: 1046, type: 'triangle', gain: gainOf(0.16) });
        });
        break;
      case 'siren':
        schedulePatternRepeats(ctx, 1.02, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 0.32, frequency: 620, endFrequency: 1180, type: 'sawtooth', gain: gainOf(0.30) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.32, duration: 0.32, frequency: 1180, endFrequency: 620, type: 'sawtooth', gain: gainOf(0.30) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.64, duration: 0.32, frequency: 620, endFrequency: 1180, type: 'sawtooth', gain: gainOf(0.30) });
        });
        break;
      case 'phone':
        schedulePatternRepeats(ctx, 1.14, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 0.18, frequency: 1320, endFrequency: 1180, type: 'square', gain: gainOf(0.26) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.22, duration: 0.18, frequency: 1568, endFrequency: 1320, type: 'square', gain: gainOf(0.26) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.62, duration: 0.18, frequency: 1320, endFrequency: 1180, type: 'square', gain: gainOf(0.26) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.84, duration: 0.18, frequency: 1568, endFrequency: 1320, type: 'square', gain: gainOf(0.26) });
        });
        break;
      case 'buzzer':
        schedulePatternRepeats(ctx, 0.86, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 0.14, frequency: 980, endFrequency: 920, type: 'square', gain: gainOf(0.32) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.18, duration: 0.14, frequency: 980, endFrequency: 920, type: 'square', gain: gainOf(0.32) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.36, duration: 0.14, frequency: 980, endFrequency: 920, type: 'square', gain: gainOf(0.32) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.54, duration: 0.14, frequency: 980, endFrequency: 920, type: 'square', gain: gainOf(0.32) });
        });
        break;
      case 'retro':
        schedulePatternRepeats(ctx, 1.02, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 0.16, frequency: 784, endFrequency: 784, type: 'square', gain: gainOf(0.27) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.18, duration: 0.16, frequency: 988, endFrequency: 988, type: 'square', gain: gainOf(0.27) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.36, duration: 0.16, frequency: 1174, endFrequency: 1174, type: 'square', gain: gainOf(0.27) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.62, duration: 0.22, frequency: 988, endFrequency: 784, type: 'square', gain: gainOf(0.28) });
        });
        break;
      case 'clockradio':
        schedulePatternRepeats(ctx, 1.48, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 0.2, frequency: 720, endFrequency: 720, type: 'square', gain: gainOf(0.32) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.24, duration: 0.2, frequency: 960, endFrequency: 960, type: 'square', gain: gainOf(0.32) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.48, duration: 0.2, frequency: 720, endFrequency: 720, type: 'square', gain: gainOf(0.32) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 0.72, duration: 0.2, frequency: 960, endFrequency: 960, type: 'square', gain: gainOf(0.32) });
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset + 1.02, duration: 0.32, frequency: 1320, endFrequency: 1120, type: 'sawtooth', gain: gainOf(0.30) });
        });
        break;
      case 'classic_bell':
        schedulePatternRepeats(ctx, 1.0, totalDuration, offset => {
          for (let i = 0; i < 8; i++) {
            playOscillatorStep(ctx, ctx.destination, {
              startAt: now + offset + (i * 0.05),
              duration: 0.04,
              frequency: 2500,
              type: 'triangle',
              gain: gainOf(0.30)
            });
          }
        });
        break;
      case 'digital_alarm':
        schedulePatternRepeats(ctx, 0.6, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, {
            startAt: now + offset,
            duration: 0.1,
            frequency: 2048,
            type: 'square',
            gain: gainOf(0.26)
          });
          playOscillatorStep(ctx, ctx.destination, {
            startAt: now + offset + 0.15,
            duration: 0.1,
            frequency: 2048,
            type: 'square',
            gain: gainOf(0.26)
          });
        });
        break;
      case 'pro_timer':
        schedulePatternRepeats(ctx, 0.8, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, {
            startAt: now + offset,
            duration: 0.08,
            frequency: 1800,
            type: 'square',
            gain: gainOf(0.26)
          });
          playOscillatorStep(ctx, ctx.destination, {
            startAt: now + offset + 0.1,
            duration: 0.08,
            frequency: 1800,
            type: 'square',
            gain: gainOf(0.26)
          });
          playOscillatorStep(ctx, ctx.destination, {
            startAt: now + offset + 0.2,
            duration: 0.2,
            frequency: 2200,
            type: 'square',
            gain: gainOf(0.26)
          });
        });
        break;
      case 'industrial_buzzer':
        schedulePatternRepeats(ctx, 0.4, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, {
            startAt: now + offset,
            duration: 0.25,
            frequency: 2800,
            type: 'sawtooth',
            gain: gainOf(0.34),
          });
        });
        break;
      case 'emergency_beep':
        schedulePatternRepeats(ctx, 0.6, totalDuration, offset => {
          ([0, 0.1, 0.2, 0.3] as number[]).forEach(tOffset => {
            playOscillatorStep(ctx, ctx.destination, {
              startAt: now + offset + tOffset,
              duration: 0.05,
              frequency: 3500,
              type: 'square',
              gain: gainOf(0.38),
            });
          });
        });
        break;
      case 'classic_panic':
        schedulePatternRepeats(ctx, 0.5, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, {
            startAt: now + offset,
            duration: 0.2,
            frequency: 2000,
            type: 'square',
            gain: gainOf(0.30),
          });
          playOscillatorStep(ctx, ctx.destination, {
            startAt: now + offset + 0.2,
            duration: 0.2,
            frequency: 2500,
            type: 'square',
            gain: gainOf(0.30),
          });
        });
        break;
      case 'beep':
      default:
        schedulePatternRepeats(ctx, 0.95, totalDuration, offset => {
          playOscillatorStep(ctx, ctx.destination, { startAt: now + offset, duration: 0.75, frequency: 880, endFrequency: 1320, type: 'square', gain: gainOf(0.30) });
        });
        break;
    }
  } catch (_) {
    // Best effort: unsupported/blocked audio should not break timers.
  }
}

function vibrateIfAvailable(): void {
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
  const timerVolume = computed(() => {
    const next = Number(selectedTimerVolume.value);
    return Number.isFinite(next) ? Math.min(100, Math.max(0, next)) : 70;
  });
  const timerDuration = computed(() => (
    VALID_TIMER_DURATIONS.includes(Number(selectedTimerDuration.value))
      ? Number(selectedTimerDuration.value)
      : 5
  ));

  function dismissTimerAlert(): void {
    stopAllScheduledSounds();
    if (closeTimeout) {
      window.clearTimeout(closeTimeout);
      closeTimeout = null;
    }
    timerAlert.value = {
      open: false,
      title: '',
      message: '',
      onSnooze: null,
    };
  }

  function snoozeTimerAlert(): void {
    const cb = timerAlert.value.onSnooze;
    dismissTimerAlert();
    cb?.();
  }

  function triggerTimerAlert(message: string, title = t('timer_alarm_title'), onSnooze: (() => void) | null = null): void {
    playSelectedTimerSound(timerSound.value, timerVolume.value / 100, timerDuration.value);
    vibrateIfAvailable();
    timerAlert.value = {
      open: true,
      title,
      message,
      onSnooze,
    };
    if (closeTimeout) window.clearTimeout(closeTimeout);
    closeTimeout = window.setTimeout(() => {
      dismissTimerAlert();
    }, 10000);
  }

  function setTimerSound(value: string): void {
    selectedTimerSound.value = VALID_TIMER_SOUNDS.includes(value) ? value : 'beep';
  }

  function setTimerVolume(value: number): void {
    const next = Number(value);
    selectedTimerVolume.value = Number.isFinite(next) ? Math.min(100, Math.max(0, next)) : 70;
  }

  function setTimerDuration(value: number): void {
    const next = Number(value);
    selectedTimerDuration.value = VALID_TIMER_DURATIONS.includes(next) ? next : 5;
  }

  function previewTimerSound(): void {
    playSelectedTimerSound(timerSound.value, timerVolume.value / 100, timerDuration.value);
  }

  return {
    timerAlert,
    timerSound,
    timerVolume,
    timerDuration,
    timerSoundOptions: VALID_TIMER_SOUNDS,
    timerDurationOptions: VALID_TIMER_DURATIONS,
    triggerTimerAlert,
    dismissTimerAlert,
    snoozeTimerAlert,
    setTimerSound,
    setTimerVolume,
    setTimerDuration,
    previewTimerSound,
  };
}
