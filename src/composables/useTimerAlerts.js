import { ref } from 'vue';
import { t } from '../lib/i18n.js';

const timerAlert = ref({
  open: false,
  title: '',
  message: '',
});

let audioContext = null;
let closeTimeout = null;

function playAlarmTone() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioContext) audioContext = new Ctx();
    audioContext.resume().catch(() => {});

    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.connect(audioContext.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.35);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.75);
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
    playAlarmTone();
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

  return {
    timerAlert,
    triggerTimerAlert,
    dismissTimerAlert,
  };
}
