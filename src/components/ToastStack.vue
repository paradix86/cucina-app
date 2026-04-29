<script setup>
import { useToasts } from '../composables/useToasts';

const { toasts, removeToast } = useToasts();

function handleAction(toast) {
  toast.onAction?.();
  removeToast(toast.id);
}
</script>

<template>
  <div id="toast-container" class="toast-container" aria-live="polite" aria-atomic="false">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type" @click="removeToast(toast.id)">
      <span class="toast-message">{{ toast.message }}</span>
      <button v-if="toast.actionLabel" class="toast-action" @click.stop="handleAction(toast)">
        {{ toast.actionLabel }}
      </button>
      <button v-if="toast.actionLabel" class="toast-close" aria-label="Chiudi" @click.stop="removeToast(toast.id)">✕</button>
    </div>
  </div>
</template>
