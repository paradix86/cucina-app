<script setup>
import { computed } from 'vue';
import { useShoppingList } from '../composables/useShoppingList.js';
import { t } from '../lib/i18n.js';

const emit = defineEmits(['toast']);

const { items, groupedSections, toggleItem, removeItem, toggleGroup, removeMany, clearAll, parseIngredient, formatQuantity } = useShoppingList();

const countLabel = computed(() => items.value.length === 1 ? t('shopping_count', { n: items.value.length }) : t('shopping_count_plural', { n: items.value.length }));

function clearList() {
  if (!items.value.length) return;
  if (!window.confirm(t('shopping_clear_confirm'))) return;
  clearAll();
  emit('toast', t('shopping_cleared_toast'), 'info');
}
</script>

<template>
  <section class="panel active">
    <div class="shopping-card card">
      <div class="shopping-header">
        <div>
          <h2>{{ t('shopping_title') }}</h2>
          <p id="shopping-count" class="muted-label">{{ countLabel }}</p>
        </div>
        <button v-if="items.length" class="btn-ghost" id="shopping-clear-btn" @click="clearList">{{ t('shopping_clear') }}</button>
      </div>

      <div v-if="!items.length" id="shopping-list">
        <p class="empty">{{ t('shopping_empty') }}</p>
      </div>
      <div v-else id="shopping-list">
        <div class="shopping-list-rows">
          <div v-for="section in groupedSections" :key="section.id" class="shopping-section">
            <div class="shopping-section-heading">
              <span class="shopping-section-name">{{ t(section.labelKey) }}</span>
              <span class="shopping-section-count">({{ section.grouped.length + section.ungrouped.length }})</span>
            </div>

            <div v-for="group in section.grouped" :key="group.groupKey" class="shopping-grouped-item">
              <label class="shopping-item-main">
                <input
                  type="checkbox"
                  class="shopping-group-checkbox"
                  :checked="!group.items.some(item => !item.checked)"
                  @change="toggleGroup(group.items.map(item => item.id), $event.target.checked)"
                />
                <span class="shopping-item-text shopping-item-total">
                  {{ group.groupType === 'numeric' ? `${group.baseName} — ${group.displayQty} ${group.unit}` : (group.displayName || group.baseName) }}
                </span>
              </label>
              <button class="shopping-remove" :aria-label="t('shopping_remove')" @click="removeMany(group.items.map(item => item.id))">✕</button>
              <div class="shopping-group-breakdown">
                <div v-for="item in group.items" :key="item.id" class="shopping-group-contribution" :class="{ 'is-checked': item.checked }">
                  <div class="shopping-group-contribution-main">
                    <span class="contrib-qty">
                      {{ group.groupType === 'numeric' && parseIngredient(item.text).parsedQty ? `${formatQuantity(parseIngredient(item.text).parsedQty)} ${parseIngredient(item.text).parsedUnit}` : item.text }}
                    </span>
                    <span class="contrib-recipe">{{ item.sourceRecipeName || t('shopping_recipe_unknown') }}</span>
                  </div>
                  <button class="shopping-contrib-remove" :aria-label="t('shopping_remove')" @click="removeItem(item.id)">✕</button>
                </div>
              </div>
            </div>

            <div v-for="item in section.ungrouped" :key="item.id" class="shopping-item" :class="{ 'is-checked': item.checked }">
              <label class="shopping-item-main">
                <input type="checkbox" :checked="item.checked" @change="toggleItem(item.id)" />
                <span class="shopping-item-text">{{ item.text }}</span>
              </label>
              <button class="shopping-remove" :aria-label="t('shopping_remove')" @click="removeItem(item.id)">✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
