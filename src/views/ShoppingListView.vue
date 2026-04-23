<script setup>
import { computed, inject, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { parseIngredient, formatQuantity } from '../lib/ingredientUtils';
import { useShoppingListStore } from '../stores/shoppingList';
import { t } from '../lib/i18n.js';

const emit = defineEmits(['toast']);
const router = useRouter();

const store = useShoppingListStore();
const { items, groupedSections } = storeToRefs(store);
const { toggleItem, removeItem, toggleGroup, removeMany, clearAll } = store;
const expandedGroups = ref({});
const requestConfirm = inject('requestConfirm', null);
const shareSupported = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

const countLabel = computed(() => items.value.length === 1 ? t('shopping_count', { n: items.value.length }) : t('shopping_count_plural', { n: items.value.length }));
const completedCount = computed(() => items.value.filter(item => item.checked).length);
const remainingCount = computed(() => Math.max(0, items.value.length - completedCount.value));
const exportableItems = computed(() => {
  const remaining = items.value.filter(item => !item.checked);
  return remaining.length ? remaining : items.value;
});

function localizedShoppingUnit(unit, qty) {
  if (unit === 'pieces') return t(Math.abs(qty) === 1 ? 'shopping_unit_piece_one' : 'shopping_unit_piece_many');
  if (unit === 'eggs') return t(Math.abs(qty) === 1 ? 'shopping_unit_egg_one' : 'shopping_unit_egg_many');
  return unit;
}

async function clearList() {
  if (!items.value.length) return;
  const confirmed = requestConfirm
    ? await requestConfirm({
        message: t('shopping_clear_confirm'),
        confirmLabel: t('confirm_confirm'),
        cancelLabel: t('confirm_cancel'),
      })
    : false;
  if (!confirmed) return;
  clearAll();
  emit('toast', t('shopping_cleared_toast'), 'info');
}

function contributionLabel(group, item) {
  if (group.groupType !== 'numeric') return item.text;
  const parsed = parseIngredient(item.text);
  if (!parsed.parsedQty || !parsed.parsedUnit) return item.text;
  return `${formatQuantity(parsed.parsedQty)} ${localizedShoppingUnit(parsed.parsedUnit, parsed.parsedQty)}`;
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

function groupPrimaryLabel(group) {
  return group.displayName || group.baseName;
}

function groupQuantityLabel(group) {
  if (group.groupType !== 'numeric') return '';
  return `${group.displayQty} ${localizedShoppingUnit(group.unit, Number(group.totalQty || group.displayQty || 0))}`.trim();
}

function groupCompletionPercent(group) {
  if (!group.items.length) return 0;
  return Math.round((checkedCount(group) / group.items.length) * 100);
}

function uniqueSourceNames(list) {
  return [ ...new Set(
    (list || [])
      .map(item => item?.sourceRecipeName || '')
      .filter(Boolean),
  ) ];
}

function summarizeSources(list) {
  const names = uniqueSourceNames(list);
  if (!names.length) return '';
  if (names.length === 1) return t('shopping_from_recipe', { recipe: names[ 0 ] });
  if (names.length === 2) return t('shopping_from_two_recipes', { first: names[ 0 ], second: names[ 1 ] });
  return t('shopping_from_many_recipes', { first: names[ 0 ], n: names.length - 1 });
}

function sourceSummaryForGroup(group) {
  return summarizeSources(group.items);
}

function sourceSummaryForItem(item) {
  return item.sourceRecipeName
    ? t('shopping_from_recipe', { recipe: item.sourceRecipeName })
    : '';
}

function groupStateLabel(group) {
  if (isGroupChecked(group)) return t('shopping_state_done');
  if (isGroupPartial(group)) return t('shopping_state_partial');
  return t('shopping_state_open');
}

function groupBreakdownMeta(group) {
  return t('shopping_group_meta', {
    checked: checkedCount(group),
    total: group.items.length,
    recipes: uniqueSourceNames(group.items).length,
  });
}

function filteredGroupQuantityLabel(group) {
  if (group.groupType !== 'numeric') return '';
  let total = 0;
  group.items.forEach(item => {
    const parsed = parseIngredient(item.text);
    if (parsed.parsedQty == null || parsed.parsedUnit == null) return;
    switch (parsed.parsedUnit) {
      case 'kg':
        total += parsed.parsedQty * 1000;
        break;
      case 'g':
        total += parsed.parsedQty;
        break;
      case 'l':
        total += parsed.parsedQty * 1000;
        break;
      case 'ml':
        total += parsed.parsedQty;
        break;
      default:
        total += parsed.parsedQty;
        break;
    }
  });
  if (!total) return '';

  if ([ 'g', 'kg' ].includes(group.unit)) {
    return total >= 1000 ? `${formatQuantity(total / 1000)} kg` : `${formatQuantity(total)} g`;
  }
  if ([ 'ml', 'l' ].includes(group.unit)) {
    return total >= 1000 ? `${formatQuantity(total / 1000)} l` : `${formatQuantity(total)} ml`;
  }
  return `${formatQuantity(total)} ${localizedShoppingUnit(group.unit, total)}`.trim();
}

function linesForExportGroup(group) {
  const quantityLabel = filteredGroupQuantityLabel(group);
  const mainLine = group.groupType === 'numeric' && quantityLabel
    ? `- ${groupPrimaryLabel(group)} — ${quantityLabel}`
    : `- ${groupPrimaryLabel(group)}`;
  const sourceText = summarizeSources(group.items);
  const lines = [mainLine];
  if (sourceText) lines.push(`  ${sourceText}`);
  return lines;
}

function buildExportText() {
  const selectedIds = new Set(exportableItems.value.map(item => item.id));
  const lines = [ t('shopping_export_title') ];
  if (!selectedIds.size) return lines.join('\n');

  groupedSections.value.forEach(section => {
    const sectionLines = [ t(section.labelKey) ];
    section.grouped
      .filter(group => group.items.some(item => selectedIds.has(item.id)))
      .forEach(group => {
        sectionLines.push(...linesForExportGroup({
          ...group,
          items: group.items.filter(item => selectedIds.has(item.id)),
        }));
      });
    section.ungrouped
      .filter(item => selectedIds.has(item.id))
      .forEach(item => {
        sectionLines.push(`- ${item.text}`);
        const sourceText = sourceSummaryForItem(item);
        if (sourceText) sectionLines.push(`  ${sourceText}`);
      });
    if (sectionLines.length > 1) lines.push('', ...sectionLines);
  });

  return lines.join('\n').trim();
}

async function copyExportText() {
  const text = buildExportText();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    emit('toast', t('shopping_copy_toast'), 'info');
  } catch {
    emit('toast', t('shopping_copy_error'), 'error');
  }
}

async function shareExportText() {
  const text = buildExportText();
  if (!shareSupported) {
    await copyExportText();
    return;
  }
  try {
    await navigator.share({
      title: t('shopping_export_title'),
      text,
    });
  } catch (error) {
    if (error && error.name === 'AbortError') return;
    await copyExportText();
  }
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
        <div class="shopping-toolbar">
          <p class="shopping-toolbar-note">
            {{ exportableItems.length === items.length ? t('shopping_export_all_hint') : t('shopping_export_remaining_hint') }}
          </p>
          <div class="shopping-toolbar-actions">
            <button class="btn-ghost shopping-toolbar-btn" @click="copyExportText">{{ t('shopping_copy') }}</button>
            <button v-if="shareSupported" class="btn-ghost shopping-toolbar-btn" @click="shareExportText">{{ t('shopping_share') }}</button>
          </div>
        </div>
        <div class="shopping-list-rows">
          <div v-for="section in groupedSections" :key="section.id" class="shopping-section">
            <div class="shopping-section-heading">
              <div class="shopping-section-title-wrap">
                <span class="shopping-section-name">{{ t(section.labelKey) }}</span>
                <span class="shopping-section-rule" aria-hidden="true"></span>
              </div>
              <span class="shopping-section-count">{{ section.grouped.length + section.ungrouped.length }}</span>
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
                    class="shopping-item-checkbox shopping-group-checkbox"
                    :checked="isGroupChecked(group)"
                    @change="toggleGroup(group.items.map(item => item.id), $event.target.checked)"
                  />
                  <span class="shopping-item-text shopping-item-total">
                    <span class="shopping-item-total-name">{{ groupPrimaryLabel(group) }}</span>
                    <span v-if="groupQuantityLabel(group)" class="shopping-item-total-qty">{{ groupQuantityLabel(group) }}</span>
                  </span>
                  <span v-if="sourceSummaryForGroup(group)" class="shopping-item-sub">
                    {{ sourceSummaryForGroup(group) }}
                  </span>
                </label>
                <div class="shopping-group-side">
                  <span class="shopping-state-pill" :class="{ 'is-checked': isGroupChecked(group), 'is-partial': isGroupPartial(group) }">
                    {{ groupStateLabel(group) }}
                  </span>
                  <span class="shopping-group-progress">
                    <span class="shopping-group-progress-value">{{ checkedCount(group) }}/{{ group.items.length }}</span>
                    <span class="shopping-group-progress-track" aria-hidden="true">
                      <span class="shopping-group-progress-fill" :style="{ width: `${groupCompletionPercent(group)}%` }"></span>
                    </span>
                  </span>
                  <button
                    v-if="group.items.length > 1"
                    class="shopping-group-toggle"
                    :aria-label="isGroupExpanded(group) ? t('shopping_hide_details') : t('shopping_show_details')"
                    @click="toggleGroupExpanded(group)"
                  >
                    <span>{{ isGroupExpanded(group) ? t('shopping_hide_details') : t('shopping_show_details') }}</span>
                    <span class="shopping-group-toggle-icon" aria-hidden="true">{{ isGroupExpanded(group) ? '▾' : '▸' }}</span>
                  </button>
                  <button class="shopping-remove" :aria-label="t('shopping_remove')" @click="removeMany(group.items.map(item => item.id))">✕</button>
                </div>
              </div>
              <div v-if="isGroupExpanded(group)" class="shopping-group-breakdown">
                <div class="shopping-group-meta">{{ groupBreakdownMeta(group) }}</div>
                <div v-for="item in group.items" :key="item.id" class="shopping-group-contribution" :class="{ 'is-checked': item.checked }">
                  <span class="shopping-contrib-state" aria-hidden="true"></span>
                  <div class="shopping-group-contribution-main">
                    <span class="contrib-qty">
                      {{ contributionLabel(group, item) }}
                    </span>
                    <span v-if="sourceSummaryForItem(item)" class="contrib-recipe">{{ sourceSummaryForItem(item) }}</span>
                  </div>
                  <button class="shopping-contrib-remove" :aria-label="t('shopping_remove')" @click="removeItem(item.id)">✕</button>
                </div>
              </div>
            </div>

            <div v-for="item in section.ungrouped" :key="item.id" class="shopping-item" :class="{ 'is-checked': item.checked }">
              <label class="shopping-item-main">
                <input type="checkbox" class="shopping-item-checkbox" :checked="item.checked" @change="toggleItem(item.id)" />
                <span class="shopping-item-copy">
                  <span class="shopping-item-text">{{ item.text }}</span>
                  <span v-if="sourceSummaryForItem(item)" class="shopping-item-sub">{{ sourceSummaryForItem(item) }}</span>
                </span>
              </label>
              <button class="shopping-remove" :aria-label="t('shopping_remove')" @click="removeItem(item.id)">✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
