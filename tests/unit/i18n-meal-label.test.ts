import { describe, it, expect } from 'vitest';
import { TRANSLATIONS } from '../../src/lib/i18nData';

describe('i18n: recipe_add_to_meal label', () => {
  it('should have "Aggiungi al pasto" for Italian', () => {
    expect(TRANSLATIONS.it.recipe_add_to_meal).toBe('Aggiungi al pasto');
  });

  it('should have "Add to meal" for English', () => {
    expect(TRANSLATIONS.en.recipe_add_to_meal).toBe('Add to meal');
  });

  it('should have "Zur Mahlzeit hinzufügen" for German', () => {
    expect(TRANSLATIONS.de.recipe_add_to_meal).toBe('Zur Mahlzeit hinzufügen');
  });

  it('should have "Ajouter au repas" for French', () => {
    expect(TRANSLATIONS.fr.recipe_add_to_meal).toBe('Ajouter au repas');
  });

  it('should have "Añadir a la comida" for Spanish', () => {
    expect(TRANSLATIONS.es.recipe_add_to_meal).toBe('Añadir a la comida');
  });

  it('should have consistent meal_composer_calc_nutrition key across all languages', () => {
    expect(TRANSLATIONS.it.meal_composer_calc_nutrition).toBeDefined();
    expect(TRANSLATIONS.en.meal_composer_calc_nutrition).toBeDefined();
    expect(TRANSLATIONS.de.meal_composer_calc_nutrition).toBeDefined();
    expect(TRANSLATIONS.fr.meal_composer_calc_nutrition).toBeDefined();
    expect(TRANSLATIONS.es.meal_composer_calc_nutrition).toBeDefined();
  });

  it('should have consistent meal_composer_excluding_note key across all languages', () => {
    expect(TRANSLATIONS.it.meal_composer_excluding_note).toBeDefined();
    expect(TRANSLATIONS.en.meal_composer_excluding_note).toBeDefined();
    expect(TRANSLATIONS.de.meal_composer_excluding_note).toBeDefined();
    expect(TRANSLATIONS.fr.meal_composer_excluding_note).toBeDefined();
    expect(TRANSLATIONS.es.meal_composer_excluding_note).toBeDefined();
  });

  it('should have consistent nutrition_missing_label key across all languages', () => {
    expect(TRANSLATIONS.it.nutrition_missing_label).toBeDefined();
    expect(TRANSLATIONS.en.nutrition_missing_label).toBeDefined();
    expect(TRANSLATIONS.de.nutrition_missing_label).toBeDefined();
    expect(TRANSLATIONS.fr.nutrition_missing_label).toBeDefined();
    expect(TRANSLATIONS.es.nutrition_missing_label).toBeDefined();
  });
});
