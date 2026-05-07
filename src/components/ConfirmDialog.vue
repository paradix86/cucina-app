<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: '' },
  cancelLabel: { type: String, default: '' },
  tertiaryLabel: { type: String, default: '' },
});

const emit = defineEmits(['confirm', 'cancel', 'tertiary']);
const dialogEl = ref(null);

watch(() => props.open, async (open) => {
  if (!open) return;
  await nextTick();
  const focusable = dialogEl.value?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable?.length) focusable[0].focus();
});

function onKeydown(event) {
  if (event.key === 'Escape') {
    emit('cancel');
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = Array.from(
    dialogEl.value?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) ?? []
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

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
    aria-describedby="confirm-msg"
    @click="onBackdropClick"
    @keydown="onKeydown"
  >
    <div ref="dialogEl" class="confirm-dialog card">
      <h3 v-if="props.title" class="confirm-title">{{ props.title }}</h3>
      <p id="confirm-msg" class="confirm-message">{{ props.message }}</p>
      <div class="confirm-actions">
        <button class="btn-ghost confirm-cancel" @click="emit('cancel')">{{ props.cancelLabel }}</button>
        <button
          v-if="props.tertiaryLabel"
          class="btn-secondary confirm-tertiary"
          @click="emit('tertiary')"
        >{{ props.tertiaryLabel }}</button>
        <button class="btn-danger confirm-ok" @click="emit('confirm')">{{ props.confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>
