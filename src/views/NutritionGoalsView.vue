<script setup>
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '../lib/i18n';
import { useNutritionGoalsStore } from '../stores/nutritionGoalsStore';
import { useToasts } from '../composables/useToasts';
import { parseGoalInput } from '../lib/nutritionGoals';

const goalsStore = useNutritionGoalsStore();
const { goals } = storeToRefs(goalsStore);
const { showToast } = useToasts();

const FIELDS = [
  { key: 'kcal',     labelKey: 'nutrition_goals_kcal_label',    unit: 'kcal', placeholder: '2000' },
  { key: 'proteinG', labelKey: 'nutrition_goals_protein_label', unit: 'g',    placeholder: '50'   },
  { key: 'carbsG',   labelKey: 'nutrition_goals_carbs_label',   unit: 'g',    placeholder: '250'  },
  { key: 'fatG',     labelKey: 'nutrition_goals_fat_label',     unit: 'g',    placeholder: '70'   },
  { key: 'fiberG',   labelKey: 'nutrition_goals_fiber_label',   unit: 'g',    placeholder: '25'   },
];

const form = ref({
  kcal:     goals.value.kcal     != null ? String(goals.value.kcal)     : '',
  proteinG: goals.value.proteinG != null ? String(goals.value.proteinG) : '',
  carbsG:   goals.value.carbsG   != null ? String(goals.value.carbsG)   : '',
  fatG:     goals.value.fatG     != null ? String(goals.value.fatG)     : '',
  fiberG:   goals.value.fiberG   != null ? String(goals.value.fiberG)   : '',
});

watch(goals, (g) => {
  form.value = {
    kcal:     g.kcal     != null ? String(g.kcal)     : '',
    proteinG: g.proteinG != null ? String(g.proteinG) : '',
    carbsG:   g.carbsG   != null ? String(g.carbsG)   : '',
    fatG:     g.fatG     != null ? String(g.fatG)     : '',
    fiberG:   g.fiberG   != null ? String(g.fiberG)   : '',
  };
}, { deep: true });

function save() {
  const updated = {};
  for (const field of FIELDS) {
    const val = parseGoalInput(form.value[field.key]);
    if (val !== undefined) updated[field.key] = val;
  }
  goalsStore.update(updated);
  showToast(t('nutrition_goals_saved'), 'success');
}
</script>

<template>
  <div class="view-container nutrition-goals-view">
    <h2 class="view-title">{{ t('nutrition_goals_title') }}</h2>
    <form class="nutrition-goals-form card" @submit.prevent="save">
      <div v-for="field in FIELDS" :key="field.key" class="nutrition-goals-field">
        <label :for="'ng-' + field.key" class="nutrition-goals-label">
          {{ t(field.labelKey) }}
          <span class="nutrition-goals-unit">{{ field.unit }}</span>
        </label>
        <input
          :id="'ng-' + field.key"
          v-model="form[field.key]"
          class="nutrition-goals-input"
          type="text"
          inputmode="decimal"
          :placeholder="field.placeholder"
          autocomplete="off"
        />
      </div>
      <button type="submit" class="btn-primary nutrition-goals-save">
        {{ t('nutrition_goals_save') }}
      </button>
    </form>
  </div>
</template>
