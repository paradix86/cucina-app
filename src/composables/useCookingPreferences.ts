import { computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';

const COOKING_KEEP_AWAKE_STORAGE_KEY = 'cucina_cooking_keep_awake';

export function useCookingPreferences() {
  const storedKeepAwake = useLocalStorage(COOKING_KEEP_AWAKE_STORAGE_KEY, false);
  const keepScreenAwake = computed(() => Boolean(storedKeepAwake.value));
  function setKeepScreenAwake(value: boolean): void {
    storedKeepAwake.value = Boolean(value);
  }
  return { keepScreenAwake, setKeepScreenAwake };
}
