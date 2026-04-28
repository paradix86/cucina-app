import { ref } from 'vue';

interface Toast {
  id: string;
  message: string;
  type: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
}

const toasts = ref<Toast[]>([]);

export function useToasts() {
  function showToast(message: string, type = 'info', options: ToastOptions = {}): void {
    const { actionLabel, onAction } = options;
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    toasts.value.push({ id, message, type, actionLabel, onAction });
    if (!actionLabel) {
      window.setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id);
      }, 3200);
    }
  }

  function removeToast(id: string): void {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  return { toasts, showToast, removeToast };
}
