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
