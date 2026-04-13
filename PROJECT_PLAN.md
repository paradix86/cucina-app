# Cucina App Project Plan

Questo file serve come backlog operativo e riferimento rapido per sviluppo umano o con Codex.

## Goals

- Rendere l'app piu utile durante la cucina reale su tablet/touchscreen.
- Migliorare UX, persistenza locale e affidabilita offline.
- Aggiungere funzioni organizzative senza introdurre dipendenze o build step.

## Constraints

- Vanilla JS, HTML, CSS.
- Nessuna dipendenza esterna.
- Nessun build step.
- Tutte le stringhe UI devono passare da `t('key')` in [js/i18n.js](/mnt/c/Sources/cucina-app/js/i18n.js).
- Se cambia un asset cached dal service worker, aggiornare `CACHE_NAME` in [sw.js](/mnt/c/Sources/cucina-app/sw.js).
- Persistenza solo via `localStorage` salvo decisione esplicita diversa.

## Release Order

### Milestone 1 - Cooking Core

- [ ] `Step-by-step cooking mode` - `M`
- [ ] `Toast notifications` - `S`
- [ ] `Dark mode toggle manuale` - `S`

### Milestone 2 - Personal Recipe Book

- [ ] `Note personali sulle ricette` - `S`
- [ ] `Export / Import backup JSON (UI)` - `S`
- [ ] `Import manuale (form)` - `M`

### Milestone 3 - Planning

- [ ] `Lista della spesa` - `M`
- [ ] `Pianificatore settimanale` - `L`

### Milestone 4 - Project Hygiene

- [ ] `AGENTS.md` - `S`
- [ ] `CONTRIBUTING.md` - `S`

### Milestone 5 - Smart Features

- [ ] `Preferiti` - `S`
- [ ] `Tag personalizzati` - `M`
- [ ] `Ricette recenti` - `S`
- [ ] `Filtri avanzati` - `M`
- [ ] `Meal prep / batch cooking` - `M`
- [ ] `Suggerimenti da dispensa` - `L`

## Prioritized Backlog

### P0

1. Step-by-step cooking mode
2. Toast notifications
3. Dark mode toggle manuale
4. Note personali sulle ricette
5. Export / Import backup JSON (UI)

### P1

1. Import manuale (form)
2. Lista della spesa
3. Pianificatore settimanale
4. AGENTS.md + CONTRIBUTING.md

### P2

1. Preferiti
2. Tag personalizzati
3. Filtri avanzati
4. Recenti
5. Dispensa
6. Meal prep

## Feature Specs

### 1. Step-by-step Cooking Mode

Outcome:
- Modalita full-screen o quasi full-screen per cucinare.
- Un passo alla volta.
- Timer del passo separato dal timer globale.
- Pulsanti touch-friendly.

Files likely involved:
- [js/ui.js](/mnt/c/Sources/cucina-app/js/ui.js)
- [js/i18n.js](/mnt/c/Sources/cucina-app/js/i18n.js)
- [css/style.css](/mnt/c/Sources/cucina-app/css/style.css)
- [sw.js](/mnt/c/Sources/cucina-app/sw.js)

Acceptance criteria:
- Bottone `Start cooking` in ogni detail view.
- `Prev`/`Next` funzionano.
- Ultimo step mostra stato completato.
- Exit ripristina la detail view integra.
- Nessun errore console.

### 2. Note Personali Sulle Ricette

Outcome:
- Ogni ricetta salvata puo avere note private editabili.

Suggested model:
- `recipe.notes = string`

Files likely involved:
- [js/storage.js](/mnt/c/Sources/cucina-app/js/storage.js)
- [js/ui.js](/mnt/c/Sources/cucina-app/js/ui.js)
- [js/i18n.js](/mnt/c/Sources/cucina-app/js/i18n.js)

Acceptance criteria:
- L'utente puo scrivere, salvare e rileggere note.
- Le note persistono dopo reload.

### 3. Import Manuale

Outcome:
- Creazione ricetta senza URL.

Suggested MVP fields:
- nome
- categoria
- porzioni
- emoji facoltativa
- tempo
- ingredienti dinamici
- steps dinamici
- timer principale facoltativo

Files likely involved:
- [index.html](/mnt/c/Sources/cucina-app/index.html)
- [js/ui.js](/mnt/c/Sources/cucina-app/js/ui.js)
- [js/storage.js](/mnt/c/Sources/cucina-app/js/storage.js)
- [js/i18n.js](/mnt/c/Sources/cucina-app/js/i18n.js)

Acceptance criteria:
- Form validato.
- Ricetta salvata in `Ricettario`.
- Nessun backend richiesto.

### 4. Export / Import Backup JSON

Outcome:
- Backup e restore accessibili da UI.

Files likely involved:
- [js/storage.js](/mnt/c/Sources/cucina-app/js/storage.js)
- [js/ui.js](/mnt/c/Sources/cucina-app/js/ui.js)
- [js/i18n.js](/mnt/c/Sources/cucina-app/js/i18n.js)

Acceptance criteria:
- Export scarica JSON valido.
- Import gestisce JSON non valido con errore UX pulito.
- Restore non rompe ricette esistenti.

### 5. Toast Notifications

Outcome:
- Feedback non bloccante al posto di `alert()`.

Use cases:
- ricetta salvata
- import riuscito/fallito
- backup importato
- timer finito

Files likely involved:
- [js/ui.js](/mnt/c/Sources/cucina-app/js/ui.js) o nuovo `js/toast.js`
- [css/style.css](/mnt/c/Sources/cucina-app/css/style.css)
- [index.html](/mnt/c/Sources/cucina-app/index.html) se serve container fisso

Acceptance criteria:
- Toast visibili, accessibili, auto-dismiss.
- Nessun `alert()` nei flussi principali.

### 6. Dark Mode Toggle Manuale

Outcome:
- Override persistente su tema.

Suggested storage:
- `localStorage['cucina_theme'] = 'system' | 'light' | 'dark'`

Files likely involved:
- [index.html](/mnt/c/Sources/cucina-app/index.html)
- [css/style.css](/mnt/c/Sources/cucina-app/css/style.css)
- [js/app.js](/mnt/c/Sources/cucina-app/js/app.js) o [js/ui.js](/mnt/c/Sources/cucina-app/js/ui.js)
- [js/i18n.js](/mnt/c/Sources/cucina-app/js/i18n.js)

Acceptance criteria:
- Toggle chiaro/scuro/sistema.
- Persistenza dopo reload.

### 7. Lista Della Spesa

Outcome:
- Estrarre ingredienti da una o piu ricette in una lista unica.

Suggested MVP:
- aggiungi ingredienti da detail recipe
- check item completato
- remove item
- clear list

Suggested v2:
- deduplica ingredienti simili
- grouping per categoria

Files likely involved:
- [js/storage.js](/mnt/c/Sources/cucina-app/js/storage.js)
- [js/ui.js](/mnt/c/Sources/cucina-app/js/ui.js)
- [index.html](/mnt/c/Sources/cucina-app/index.html)
- [css/style.css](/mnt/c/Sources/cucina-app/css/style.css)
- [js/i18n.js](/mnt/c/Sources/cucina-app/js/i18n.js)

Acceptance criteria:
- Lista persistente.
- Aggiunta ingredienti da ricetta.

### 8. Pianificatore Settimanale

Outcome:
- Assegnare ricette a giorni/settimana.

Suggested MVP:
- vista lun-dom
- slot pranzo/cena
- selezione ricetta da planner

Suggested v2:
- genera lista spesa dalla settimana
- drag and drop

Files likely involved:
- [js/storage.js](/mnt/c/Sources/cucina-app/js/storage.js)
- [js/ui.js](/mnt/c/Sources/cucina-app/js/ui.js)
- [index.html](/mnt/c/Sources/cucina-app/index.html)
- [css/style.css](/mnt/c/Sources/cucina-app/css/style.css)
- [js/i18n.js](/mnt/c/Sources/cucina-app/js/i18n.js)

Acceptance criteria:
- Piano persistente.
- Inserimento e rimozione ricette semplice.

## Useful Additional Features

- Preferiti
- Tag personalizzati
- Ricette recenti
- Ricerca per ingrediente escluso/incluso
- Filtri dieta o allergeni
- Checklist ingredienti durante cooking mode
- Dispensa ingredienti
- Meal prep / batch cooking
- Condivisione ricette via JSON
- Duplicazione ricette

## Competitive Features Seen In Apps Like Mr. Cook

- Cooking mode guidata
- Meal planner
- Shopping list automatica
- Ricerca per ingrediente
- Preferiti/collezioni
- Import da web/social
- Timer contestuali
- Suggerimenti da dispensa
- Meal prep

## Suggested Data Model Extensions

Keep additions backward-compatible with current local storage objects.

```js
{
  id: '...',
  name: '...',
  category: '...',
  bimby: false,
  emoji: '...',
  time: '20 min',
  servings: '4',
  source: 'classica',
  ingredients: ['...'],
  steps: ['...'],
  timerMinutes: 10,
  notes: '',
  favorite: false,
  tags: [],
  updatedAt: 0,
  createdAt: 0
}
```

## Technical Notes For Codex

- Preferire cambi piccoli e verificabili.
- Verificare sempre se il service worker sta servendo JS cached.
- Quando si modifica UI testabile, rieseguire una verifica Playwright.
- Evitare refactor larghi insieme a nuove feature.
- Riutilizzare naming inglese gia presente in `v3` storage dove possibile.
- Se una nuova feature richiede una nuova tab, mantenere il design coerente con le 4 tab esistenti.

## Definition Of Done

Una feature e considerata completa quando:

- ha UI funzionante,
- ha stringhe i18n complete,
- persiste correttamente se previsto,
- non introduce errori console,
- passa una verifica manuale o Playwright mirata,
- non rompe offline/cache behavior.
