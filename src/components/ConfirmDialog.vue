<script setup>
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: '' },
  cancelLabel: { type: String, default: '' },
});

const emit = defineEmits(['confirm', 'cancel']);

function onBackdropClick(event) {
  if (event.target === event.currentTarget) {
    emit('cancel');
  }
}
</script>

<template>
  <div
    v-if="props.open"
    class="confirm-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="props.title || props.message"
    @click="onBackdropClick"
  >
    <div class="confirm-dialog card">
      <h3 v-if="props.title" class="confirm-title">{{ props.title }}</h3>
      <p class="confirm-message">{{ props.message }}</p>
      <div class="confirm-actions">
        <button class="btn-ghost confirm-cancel" @click="emit('cancel')">{{ props.cancelLabel }}</button>
        <button class="btn-danger confirm-ok" @click="emit('confirm')">{{ props.confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>
