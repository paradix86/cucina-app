<script setup>
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { parseIngredient, formatQuantity } from '../lib/storage';
import { useShoppingListStore } from '../stores/shoppingList';
import { t } from '../lib/i18n.js';

const emit = defineEmits(['toast']);
const router = useRouter();

const store = useShoppingListStore();
const { items, groupedSections } = storeToRefs(store);
const { toggleItem, removeItem, toggleGroup, removeMany, clearAll } = store;
const expandedGroups = ref({});

const countLabel = computed(() => items.value.length === 1 ? t('shopping_count', { n: items.value.length }) : t('shopping_count_plural', { n: items.value.length }));
const completedCount = computed(() => items.value.filter(item => item.checked).length);
const remainingCount = computed(() => Math.max(0, items.value.length - completedCount.value));

function clearList() {
  if (!items.value.length) return;
  if (!window.confirm(t('shopping_clear_confirm'))) return;
  clearAll();
  emit('toast', t('shopping_cleared_toast'), 'info');
}

function contributionLabel(group, item) {
  if (group.groupType !== 'numeric') return item.text;
  const parsed = parseIngredient(item.text);
  if (!parsed.parsedQty || !parsed.parsedUnit) return item.text;
  return `${formatQuantity(parsed.parsedQty)} ${parsed.parsedUnit}`;
}

function checkedCount(group) {
  return group.items.reduce((total, item) => total + (item.checked ? 1 : 0), 0);
}

function isGroupChecked(group) {
  return group.items.length > 0 && checkedCount(group) === group.items.length;
}

function isGroupPartial(group) {
  const checked = checkedCount(group);
  return checked > 0 && checked < group.items.length;
}

function isGroupExpanded(group) {
  if (group.items.length <= 1) return false;
  return Boolean(expandedGroups.value[group.groupKey]);
}

function toggleGroupExpanded(group) {
  if (group.items.length <= 1) return;
  const next = { ...expandedGroups.value };
  next[group.groupKey] = !isGroupExpanded(group);
  expandedGroups.value = next;
}
</script>

<template>
  <section class="panel active">
    <div class="shopping-card card">
      <div class="shopping-header">
        <div>
          <h2>{{ t('shopping_title') }}</h2>
          <p id="shopping-count" class="muted-label">{{ countLabel }}</p>
          <div v-if="items.length" class="shopping-summary">
            <span class="shopping-summary-chip">{{ t('shopping_done') }} {{ completedCount }}</span>
            <span class="shopping-summary-chip">{{ t('shopping_left') }} {{ remainingCount }}</span>
          </div>
        </div>
        <button v-if="items.length" class="btn-ghost" id="shopping-clear-btn" @click="clearList">{{ t('shopping_clear') }}</button>
      </div>

      <div v-if="!items.length" id="shopping-list">
        <div class="empty-state-shell shopping-empty-state">
          <span class="empty-kicker">{{ t('shopping_empty_kicker') }}</span>
          <p class="empty">{{ t('shopping_empty') }}</p>
          <p class="empty-next muted-label">{{ t('shopping_empty_hint') }}</p>
          <ol class="empty-steps">
            <li>{{ t('shopping_empty_step_open') }}</li>
            <li>{{ t('shopping_empty_step_add') }}</li>
            <li>{{ t('shopping_empty_step_manage') }}</li>
          </ol>
          <div class="empty-state-actions">
            <button class="btn-primary" @click="router.push({ name: 'recipe-book' })">{{ t('shopping_empty_cta') }}</button>
          </div>
        </div>
      </div>
      <div v-else id="shopping-list">
        <div class="shopping-list-rows">
          <div v-for="section in groupedSections" :key="section.id" class="shopping-section">
            <div class="shopping-section-heading">
              <span class="shopping-section-name">{{ t(section.labelKey) }}</span>
              <span class="shopping-section-count">({{ section.grouped.length + section.ungrouped.length }})</span>
            </div>

            <div
              v-for="group in section.grouped"
              :key="group.groupKey"
              class="shopping-grouped-item"
              :class="{ 'is-checked': isGroupChecked(group), 'is-partial': isGroupPartial(group), 'is-expanded': isGroupExpanded(group) }"
            >
              <div class="shopping-group-header">
                <label class="shopping-item-main">
                  <input
                    type="checkbox"
                    class="shopping-group-checkbox"
                    :checked="isGroupChecked(group)"
                    @change="toggleGroup(group.items.map(item => item.id), $event.target.checked)"
                  />
                  <span class="shopping-item-text shopping-item-total">
                    {{ group.groupType === 'numeric' ? `${group.baseName} — ${group.displayQty} ${group.unit}` : (group.displayName || group.baseName) }}
                  </span>
                  <span v-if="group.items.length === 1" class="shopping-item-sub">
                    {{ group.items[0].sourceRecipeName || t('shopping_recipe_unknown') }}
                  </span>
                </label>
                <div class="shopping-group-side">
                  <span class="shopping-group-progress">{{ checkedCount(group) }}/{{ group.items.length }}</span>
                  <button
                    v-if="group.items.length > 1"
                    class="shopping-group-toggle"
                    :aria-label="isGroupExpanded(group) ? t('shopping_hide_details') : t('shopping_show_details')"
                    @click="toggleGroupExpanded(group)"
                  >
                    {{ isGroupExpanded(group) ? t('shopping_hide_details') : t('shopping_show_details') }}
                  </button>
                  <button class="shopping-remove" :aria-label="t('shopping_remove')" @click="removeMany(group.items.map(item => item.id))">✕</button>
                </div>
              </div>
              <div v-if="isGroupExpanded(group)" class="shopping-group-breakdown">
                <div class="shopping-group-meta">{{ checkedCount(group) }}/{{ group.items.length }}</div>
                <div v-for="item in group.items" :key="item.id" class="shopping-group-contribution" :class="{ 'is-checked': item.checked }">
                  <div class="shopping-group-contribution-main">
                    <span class="contrib-qty">
                      {{ contributionLabel(group, item) }}
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
