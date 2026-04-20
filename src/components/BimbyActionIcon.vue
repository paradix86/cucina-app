<script setup>
import { computed } from 'vue';
import { BIMBY_ICONS } from '../lib/bimbyIcons.js';

const props = defineProps({
  action: {
    type: String,
    default: null,
  },
});

const iconSvg = computed(() => {
  if (!props.action || !(props.action in BIMBY_ICONS)) return null;
  return BIMBY_ICONS[props.action];
});
</script>

<template>
  <span v-if="iconSvg" class="bimby-action-icon" :title="action" v-html="iconSvg"></span>
</template>

<style scoped>
.bimby-action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 8px;
  color: var(--orange);
  flex-shrink: 0;
}

.bimby-action-icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
