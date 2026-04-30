<script setup>
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  dismissLabel: { type: String, default: 'OK' },
  snoozeLabel: { type: String, default: '' },
});

const emit = defineEmits(['dismiss', 'snooze']);

function onBackdropClick(event) {
  if (event.target === event.currentTarget) emit('dismiss');
}
</script>

<template>
  <div
    v-if="props.open"
    class="timer-alert-overlay"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="timer-alert-title"
    aria-describedby="timer-alert-message"
    @click="onBackdropClick"
  >
    <div class="timer-alert-modal card">
      <div class="timer-alert-icon" aria-hidden="true">⏰</div>
      <h3 id="timer-alert-title" class="timer-alert-title">{{ props.title }}</h3>
      <p id="timer-alert-message" class="timer-alert-message">{{ props.message }}</p>
      <div class="timer-alert-actions">
        <button v-if="props.snoozeLabel" class="btn-primary timer-alert-snooze" @click="emit('snooze')">{{ props.snoozeLabel }}</button>
        <button class="timer-alert-dismiss" :class="props.snoozeLabel ? '' : 'btn-primary'" @click="emit('dismiss')">{{ props.dismissLabel }}</button>
      </div>
    </div>
  </div>
</template>
