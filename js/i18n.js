/**
 * i18n.js — Internationalisation system (it / en / de / fr / es)
 * Must be loaded FIRST before all other JS files.
 */

const TRANSLATIONS = {
  it: {
    // Navigation
    nav_recipebook:   'Ricettario',
    nav_import:       '+ Importa',
    nav_recipes:      'Ricette',
    nav_timer:        'Timer',

    // Recipe book
    recipebook_empty:      'Il tuo ricettario è vuoto.',
    recipebook_empty_hint: 'Importa una ricetta o aggiungi quelle integrate!',
    recipebook_saved:      '{n} ricetta salvata',
    recipebook_saved_plural: '{n} ricette salvate',
    recipebook_search:     'Cerca nel tuo ricettario…',
    recipebook_notfound:   'Nessuna ricetta trovata.',

    // Import
    import_title:       'Importa una ricetta da link',
    import_desc:        'Incolla il link di un video YouTube, TikTok, Instagram o di qualsiasi sito di ricette.',
    import_placeholder: 'https://www.youtube.com/watch?v=…',
    import_btn:         'Importa ricetta',
    import_loading:     "Analizzo il link con l'AI…",
    import_success:     'Ricetta estratta! Controlla e salva.',
    import_error:       "Errore nell'analisi del link. Riprova.",
    import_invalid_url: 'Inserisci un link valido.',
    import_save:        'Salva nel ricettario',
    import_discard:     'Scarta',

    // Built-in recipes
    builtin_search:        'Cerca…',
    builtin_filter_all:    'Tutto',
    builtin_save:          'Salva nel ricettario',
    builtin_already_saved: 'Questa ricetta è già nel ricettario!',
    builtin_saved_ok:      'Ricetta salvata nel ricettario!',

    // Detail view
    detail_back:        '← Indietro',
    detail_ingredients: 'Ingredienti',
    detail_steps:       'Procedimento',
    detail_steps_bimby: 'Procedimento Bimby TM5',
    detail_open_source: 'Apri fonte originale ↗',
    detail_servings:    'Porzioni',
    detail_timer_btn:   '⏱ Timer ({t})',
    cooking_start:      'Inizia a cucinare',
    cooking_exit:       'Esci',
    cooking_step_of:    'Passo {current} di {total}',
    cooking_prev:       '← Precedente',
    cooking_next:       'Successivo →',
    cooking_done:       'Ricetta completata!',
    cooking_done_sub:   'Buon appetito!',
    cooking_step_timer: 'Timer passo',

    // Timer
    timer_name_placeholder: 'Pasta, Sugo, Arrosto…',
    timer_add:    '+ Aggiungi',
    timer_empty:  'Nessun timer attivo. Aggiungine uno sopra!',
    timer_ready:  'PRONTO!',
    timer_pause:  'Pausa',
    timer_start:  'Avvia',
    timer_reset:  'Reset',
    timer_label_name: 'Nome pietanza',
    timer_label_min:  'Min',
    timer_label_sec:  'Sec',
    timer_invalid:    'Inserisci un tempo valido!',
    toast_timer_done: '{name} pronto!',
    toast_cooking_timer_done: 'Timer del passo completato!',

    // Source badges
    source_youtube:   'YouTube',
    source_tiktok:    'TikTok',
    source_instagram: 'Instagram',
    source_bimby:     'Bimby TM5',
    source_classic:   'Classica',
    source_web:       'Web',
    source_manual:    'Manuale',

    // Filters (Point 3)
    filter_all:      'Tutto',
    filter_classic:  'Classiche',
    filter_bimby:    'Bimby TM5',
    filter_source:   'Fonte',
    filter_max_time: 'Tempo max',
    filter_any_time: 'Qualsiasi',
    filter_reset:    'Reimposta filtri',
    results_showing: 'Mostra {n} di {total}',

    // Misc
    delete_confirm: 'Eliminare questa ricetta dal ricettario?',
    app_subtitle:   'Ricette · Bimby TM5 · Timer',
    theme_label:    'Tema',
    theme_system:   'Sistema',
    theme_light:    'Chiaro',
    theme_dark:     'Scuro',
    hours_short:    'h',
    minutes_short:  'min',
  },

  en: {
    nav_recipebook:   'Recipe Book',
    nav_import:       '+ Import',
    nav_recipes:      'Recipes',
    nav_timer:        'Timer',

    recipebook_empty:      'Your recipe book is empty.',
    recipebook_empty_hint: 'Import a recipe or save one from the built-in list!',
    recipebook_saved:      '{n} recipe saved',
    recipebook_saved_plural: '{n} recipes saved',
    recipebook_search:     'Search your recipe book…',
    recipebook_notfound:   'No recipes found.',

    import_title:       'Import a recipe from a link',
    import_desc:        'Paste a YouTube, TikTok, Instagram or any recipe website link.',
    import_placeholder: 'https://www.youtube.com/watch?v=…',
    import_btn:         'Import recipe',
    import_loading:     'Analysing link with AI…',
    import_success:     'Recipe extracted! Review and save.',
    import_error:       'Error analysing the link. Please try again.',
    import_invalid_url: 'Please enter a valid link.',
    import_save:        'Save to recipe book',
    import_discard:     'Discard',

    builtin_search:        'Search…',
    builtin_filter_all:    'All',
    builtin_save:          'Save to recipe book',
    builtin_already_saved: 'This recipe is already in your book!',
    builtin_saved_ok:      'Recipe saved to recipe book!',

    detail_back:        '← Back',
    detail_ingredients: 'Ingredients',
    detail_steps:       'Instructions',
    detail_steps_bimby: 'Bimby TM5 Instructions',
    detail_open_source: 'Open original source ↗',
    detail_servings:    'Servings',
    detail_timer_btn:   '⏱ Timer ({t})',
    cooking_start:      'Start cooking',
    cooking_exit:       'Exit',
    cooking_step_of:    'Step {current} of {total}',
    cooking_prev:       '← Previous',
    cooking_next:       'Next →',
    cooking_done:       'Recipe complete!',
    cooking_done_sub:   'Enjoy your meal!',
    cooking_step_timer: 'Step timer',

    timer_name_placeholder: 'Pasta, Sauce, Roast…',
    timer_add:    '+ Add',
    timer_empty:  'No active timers. Add one above!',
    timer_ready:  'READY!',
    timer_pause:  'Pause',
    timer_start:  'Start',
    timer_reset:  'Reset',
    timer_label_name: 'Dish name',
    timer_label_min:  'Min',
    timer_label_sec:  'Sec',
    timer_invalid:    'Please enter a valid time!',
    toast_timer_done: '{name} is ready!',
    toast_cooking_timer_done: 'Step timer complete!',

    source_youtube:   'YouTube',
    source_tiktok:    'TikTok',
    source_instagram: 'Instagram',
    source_bimby:     'Bimby TM5',
    source_classic:   'Classic',
    source_web:       'Web',
    source_manual:    'Manual',

    filter_all:      'All',
    filter_classic:  'Classic',
    filter_bimby:    'Bimby TM5',
    filter_source:   'Source',
    filter_max_time: 'Max time',
    filter_any_time: 'Any',
    filter_reset:    'Reset filters',
    results_showing: 'Showing {n} of {total}',

    delete_confirm: 'Remove this recipe from your book?',
    app_subtitle:   'Recipes · Bimby TM5 · Timer',
    theme_label:    'Theme',
    theme_system:   'System',
    theme_light:    'Light',
    theme_dark:     'Dark',
    hours_short:    'h',
    minutes_short:  'min',
  },

  de: {
    nav_recipebook:   'Rezeptbuch',
    nav_import:       '+ Importieren',
    nav_recipes:      'Rezepte',
    nav_timer:        'Timer',

    recipebook_empty:      'Dein Rezeptbuch ist leer.',
    recipebook_empty_hint: 'Importiere ein Rezept oder speichere eines aus der Liste!',
    recipebook_saved:      '{n} Rezept gespeichert',
    recipebook_saved_plural: '{n} Rezepte gespeichert',
    recipebook_search:     'Im Rezeptbuch suchen…',
    recipebook_notfound:   'Keine Rezepte gefunden.',

    import_title:       'Rezept von Link importieren',
    import_desc:        'Füge einen YouTube-, TikTok-, Instagram- oder Rezeptwebsite-Link ein.',
    import_placeholder: 'https://www.youtube.com/watch?v=…',
    import_btn:         'Rezept importieren',
    import_loading:     'Link wird mit KI analysiert…',
    import_success:     'Rezept extrahiert! Prüfen und speichern.',
    import_error:       'Fehler beim Analysieren des Links. Erneut versuchen.',
    import_invalid_url: 'Bitte einen gültigen Link eingeben.',
    import_save:        'Im Rezeptbuch speichern',
    import_discard:     'Verwerfen',

    builtin_search:        'Suchen…',
    builtin_filter_all:    'Alle',
    builtin_save:          'Im Rezeptbuch speichern',
    builtin_already_saved: 'Dieses Rezept ist bereits im Buch!',
    builtin_saved_ok:      'Rezept gespeichert!',

    detail_back:        '← Zurück',
    detail_ingredients: 'Zutaten',
    detail_steps:       'Zubereitung',
    detail_steps_bimby: 'Bimby TM5 Zubereitung',
    detail_open_source: 'Originalquelle öffnen ↗',
    detail_servings:    'Portionen',
    detail_timer_btn:   '⏱ Timer ({t})',
    cooking_start:      'Kochen starten',
    cooking_exit:       'Beenden',
    cooking_step_of:    'Schritt {current} von {total}',
    cooking_prev:       '← Zurück',
    cooking_next:       'Weiter →',
    cooking_done:       'Rezept fertig!',
    cooking_done_sub:   'Guten Appetit!',
    cooking_step_timer: 'Schritt-Timer',

    timer_name_placeholder: 'Nudeln, Soße, Braten…',
    timer_add:    '+ Hinzufügen',
    timer_empty:  'Keine aktiven Timer. Füge einen hinzu!',
    timer_ready:  'FERTIG!',
    timer_pause:  'Pause',
    timer_start:  'Start',
    timer_reset:  'Reset',
    timer_label_name: 'Gerichtname',
    timer_label_min:  'Min',
    timer_label_sec:  'Sek',
    timer_invalid:    'Bitte gültige Zeit eingeben!',
    toast_timer_done: '{name} ist fertig!',
    toast_cooking_timer_done: 'Schritt-Timer beendet!',

    source_youtube:   'YouTube',
    source_tiktok:    'TikTok',
    source_instagram: 'Instagram',
    source_bimby:     'Bimby TM5',
    source_classic:   'Klassisch',
    source_web:       'Web',
    source_manual:    'Manuell',

    filter_all:      'Alle',
    filter_classic:  'Klassische',
    filter_bimby:    'Bimby TM5',
    filter_source:   'Quelle',
    filter_max_time: 'Max. Zeit',
    filter_any_time: 'Beliebig',
    filter_reset:    'Filter zurücksetzen',
    results_showing: '{n} von {total}',

    delete_confirm: 'Dieses Rezept aus dem Buch entfernen?',
    app_subtitle:   'Rezepte · Bimby TM5 · Timer',
    theme_label:    'Design',
    theme_system:   'System',
    theme_light:    'Hell',
    theme_dark:     'Dunkel',
    hours_short:    'Std',
    minutes_short:  'Min',
  },

  fr: {
    nav_recipebook:   'Livre de recettes',
    nav_import:       '+ Importer',
    nav_recipes:      'Recettes',
    nav_timer:        'Minuteur',

    recipebook_empty:      'Votre livre de recettes est vide.',
    recipebook_empty_hint: 'Importez une recette ou sauvegardez-en une depuis la liste!',
    recipebook_saved:      '{n} recette sauvegardée',
    recipebook_saved_plural: '{n} recettes sauvegardées',
    recipebook_search:     'Rechercher dans le livre…',
    recipebook_notfound:   'Aucune recette trouvée.',

    import_title:       'Importer une recette depuis un lien',
    import_desc:        'Collez un lien YouTube, TikTok, Instagram ou tout site de recettes.',
    import_placeholder: 'https://www.youtube.com/watch?v=…',
    import_btn:         'Importer la recette',
    import_loading:     "Analyse du lien avec l'IA…",
    import_success:     'Recette extraite! Vérifiez et sauvegardez.',
    import_error:       "Erreur lors de l'analyse. Réessayez.",
    import_invalid_url: 'Veuillez entrer un lien valide.',
    import_save:        'Sauvegarder dans le livre',
    import_discard:     'Abandonner',

    builtin_search:        'Rechercher…',
    builtin_filter_all:    'Tout',
    builtin_save:          'Sauvegarder dans le livre',
    builtin_already_saved: 'Cette recette est déjà dans le livre!',
    builtin_saved_ok:      'Recette sauvegardée!',

    detail_back:        '← Retour',
    detail_ingredients: 'Ingrédients',
    detail_steps:       'Préparation',
    detail_steps_bimby: 'Préparation Bimby TM5',
    detail_open_source: 'Ouvrir la source originale ↗',
    detail_servings:    'Portions',
    detail_timer_btn:   '⏱ Minuteur ({t})',
    cooking_start:      'Commencer',
    cooking_exit:       'Quitter',
    cooking_step_of:    'Étape {current} sur {total}',
    cooking_prev:       '← Précédent',
    cooking_next:       'Suivant →',
    cooking_done:       'Recette terminée !',
    cooking_done_sub:   'Bon appétit !',
    cooking_step_timer: 'Minuteur étape',

    timer_name_placeholder: 'Pâtes, Sauce, Rôti…',
    timer_add:    '+ Ajouter',
    timer_empty:  'Aucun minuteur actif. Ajoutez-en un!',
    timer_ready:  'PRÊT!',
    timer_pause:  'Pause',
    timer_start:  'Démarrer',
    timer_reset:  'Réinitialiser',
    timer_label_name: 'Nom du plat',
    timer_label_min:  'Min',
    timer_label_sec:  'Sec',
    timer_invalid:    'Veuillez entrer une durée valide!',
    toast_timer_done: '{name} est prêt !',
    toast_cooking_timer_done: 'Minuteur de l’étape terminé !',

    source_youtube:   'YouTube',
    source_tiktok:    'TikTok',
    source_instagram: 'Instagram',
    source_bimby:     'Bimby TM5',
    source_classic:   'Classique',
    source_web:       'Web',
    source_manual:    'Manuel',

    filter_all:      'Tout',
    filter_classic:  'Classiques',
    filter_bimby:    'Bimby TM5',
    filter_source:   'Source',
    filter_max_time: 'Temps max',
    filter_any_time: 'Indifférent',
    filter_reset:    'Réinitialiser les filtres',
    results_showing: '{n} sur {total}',

    delete_confirm: 'Supprimer cette recette du livre?',
    app_subtitle:   'Recettes · Bimby TM5 · Minuteur',
    theme_label:    'Thème',
    theme_system:   'Système',
    theme_light:    'Clair',
    theme_dark:     'Sombre',
    hours_short:    'h',
    minutes_short:  'min',
  },

  es: {
    nav_recipebook:   'Recetario',
    nav_import:       '+ Importar',
    nav_recipes:      'Recetas',
    nav_timer:        'Temporizador',

    recipebook_empty:      'Tu recetario está vacío.',
    recipebook_empty_hint: '¡Importa una receta o guarda una de la lista!',
    recipebook_saved:      '{n} receta guardada',
    recipebook_saved_plural: '{n} recetas guardadas',
    recipebook_search:     'Buscar en el recetario…',
    recipebook_notfound:   'No se encontraron recetas.',

    import_title:       'Importar una receta desde un enlace',
    import_desc:        'Pega un enlace de YouTube, TikTok, Instagram o cualquier sitio de recetas.',
    import_placeholder: 'https://www.youtube.com/watch?v=…',
    import_btn:         'Importar receta',
    import_loading:     'Analizando el enlace con IA…',
    import_success:     '¡Receta extraída! Revisa y guarda.',
    import_error:       'Error al analizar el enlace. Inténtalo de nuevo.',
    import_invalid_url: 'Por favor introduce un enlace válido.',
    import_save:        'Guardar en el recetario',
    import_discard:     'Descartar',

    builtin_search:        'Buscar…',
    builtin_filter_all:    'Todo',
    builtin_save:          'Guardar en el recetario',
    builtin_already_saved: '¡Esta receta ya está en el recetario!',
    builtin_saved_ok:      '¡Receta guardada en el recetario!',

    detail_back:        '← Atrás',
    detail_ingredients: 'Ingredientes',
    detail_steps:       'Preparación',
    detail_steps_bimby: 'Preparación Bimby TM5',
    detail_open_source: 'Abrir fuente original ↗',
    detail_servings:    'Porciones',
    detail_timer_btn:   '⏱ Temporizador ({t})',
    cooking_start:      'Empezar',
    cooking_exit:       'Salir',
    cooking_step_of:    'Paso {current} de {total}',
    cooking_prev:       '← Anterior',
    cooking_next:       'Siguiente →',
    cooking_done:       '¡Receta completada!',
    cooking_done_sub:   '¡Buen provecho!',
    cooking_step_timer: 'Temporizador del paso',

    timer_name_placeholder: 'Pasta, Salsa, Asado…',
    timer_add:    '+ Añadir',
    timer_empty:  'No hay temporizadores activos. ¡Añade uno!',
    timer_ready:  '¡LISTO!',
    timer_pause:  'Pausa',
    timer_start:  'Iniciar',
    timer_reset:  'Reiniciar',
    timer_label_name: 'Nombre del plato',
    timer_label_min:  'Min',
    timer_label_sec:  'Seg',
    timer_invalid:    '¡Ingresa un tiempo válido!',
    toast_timer_done: '¡{name} está listo!',
    toast_cooking_timer_done: '¡Temporizador del paso completado!',

    source_youtube:   'YouTube',
    source_tiktok:    'TikTok',
    source_instagram: 'Instagram',
    source_bimby:     'Bimby TM5',
    source_classic:   'Clásica',
    source_web:       'Web',
    source_manual:    'Manual',

    filter_all:      'Todo',
    filter_classic:  'Clásicas',
    filter_bimby:    'Bimby TM5',
    filter_source:   'Fuente',
    filter_max_time: 'Tiempo máx.',
    filter_any_time: 'Cualquiera',
    filter_reset:    'Restablecer filtros',
    results_showing: '{n} de {total}',

    delete_confirm: '¿Eliminar esta receta del recetario?',
    app_subtitle:   'Recetas · Bimby TM5 · Temporizador',
    theme_label:    'Tema',
    theme_system:   'Sistema',
    theme_light:    'Claro',
    theme_dark:     'Oscuro',
    hours_short:    'h',
    minutes_short:  'min',
  },
};

const SUPPORTED_LANGUAGES = ['it', 'en', 'de', 'fr', 'es'];
const LANG_STORAGE_KEY    = 'cucina_lang';

let currentLang = 'it';

function initI18n() {
  const saved   = localStorage.getItem(LANG_STORAGE_KEY);
  const browser = (navigator.language || '').slice(0, 2);
  currentLang   = SUPPORTED_LANGUAGES.includes(saved)   ? saved
                : SUPPORTED_LANGUAGES.includes(browser) ? browser
                : 'it';
  const sel = document.getElementById('lang-select');
  if (sel) sel.value = currentLang;
  applyLanguage();
}

function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  applyLanguage();
  renderRecipeBook();
  renderBuiltinCategories();
  renderBuiltinRecipes();
  renderTimers();
}

/**
 * Translate a key. Supports {n}, {t}, {total} placeholders.
 * Falls back to Italian, then to the key itself.
 */
function t(key, vars) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS['it'];
  let str = dict[key] !== undefined ? dict[key]
          : (TRANSLATIONS['it'][key] !== undefined ? TRANSLATIONS['it'][key] : key);
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.split('{' + k + '}').join(String(v));
    });
  }
  return str;
}

/**
 * Update all elements with data-i18n / data-i18n-placeholder attributes.
 */
function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.setAttribute('lang', currentLang);
}
