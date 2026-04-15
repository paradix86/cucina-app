<script setup>
import { useToasts } from '../composables/useToasts.js';

const { toasts, removeToast } = useToasts();
</script>

<template>
  <div id="toast-container" class="toast-container" aria-live="polite" aria-atomic="false">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type" @click="removeToast(toast.id)">
      {{ toast.message }}
    </div>
  </div>
</template>
