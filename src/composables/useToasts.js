import { ref } from 'vue';

const toasts = ref([]);

export function useToasts() {
  function showToast(message, type = 'info') {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    toasts.value.push({ id, message, type });
    window.setTimeout(() => {
      toasts.value = toasts.value.filter(toast => toast.id !== id);
    }, 3200);
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter(toast => toast.id !== id);
  }

  return {
    toasts,
    showToast,
    removeToast,
  };
}
