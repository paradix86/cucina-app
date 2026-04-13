# AGENTS.md

Questo file aiuta agenti come Codex a lavorare nel repo in modo coerente.

## Project Snapshot

- Stack: HTML + CSS + Vanilla JS.
- No dependencies.
- No bundler.
- No build step.
- App servita come sito statico / PWA.

## Important Files

- [index.html](/mnt/c/Sources/cucina-app/index.html): struttura UI e tab panels
- [css/style.css](/mnt/c/Sources/cucina-app/css/style.css): tutti gli stili
- [js/app.js](/mnt/c/Sources/cucina-app/js/app.js): bootstrap app
- [js/ui.js](/mnt/c/Sources/cucina-app/js/ui.js): rendering e navigazione
- [js/storage.js](/mnt/c/Sources/cucina-app/js/storage.js): localStorage e migrazioni
- [js/data.js](/mnt/c/Sources/cucina-app/js/data.js): ricette built-in
- [js/timer.js](/mnt/c/Sources/cucina-app/js/timer.js): timer globali
- [js/i18n.js](/mnt/c/Sources/cucina-app/js/i18n.js): traduzioni
- [sw.js](/mnt/c/Sources/cucina-app/sw.js): service worker cache-first

## Non-Negotiables

1. Tutte le stringhe UI passano da `t('key')`.
2. Nessuna dipendenza esterna.
3. Nessun refactor largo se la richiesta e mirata.
4. Mantenere compatibilita con localStorage esistente.
5. Se cambia un asset statico cached, aggiornare `CACHE_NAME` in `sw.js`.

## Editing Guidelines

- Preferire fix chirurgici.
- Seguire il naming inglese gia presente nei modelli `v3`.
- Se si tocca storage, considerare dati legacy/migrazione.
- Se si aggiunge UI nuova, riusare classi e pattern visivi esistenti.
- Tenere i pulsanti touch-friendly.

## Verification Workflow

Per feature UI:

1. avviare server statico locale se necessario
2. aprire l'app in Playwright
3. pulire service worker/cache se il JS sembra stantio
4. testare il flusso richiesto
5. controllare console errors

## Common Pitfalls

- Il service worker puo servire JS vecchio.
- `innerHTML` puo rompere stato o riferimenti se non ripristinati bene.
- Le ricette possono esistere in forma legacy italiana (`nome`, `cat`, `fonte`) o v3 inglese.
- Le funzioni che usano `document.querySelector()` globale possono colpire il nodo sbagliato se esistono viste nascoste.

## Preferred Implementation Style

- Funzioni piccole e leggibili.
- Stato minimale a livello modulo.
- Nessuna astrazione extra se non porta valore immediato.
- CSS nello stesso file globale, in sezioni commentate.

## When Adding A Feature

- aggiungere i18n
- aggiungere UI
- aggiungere persistenza se serve
- verificare accessibilita base
- verificare mobile/touch
- aggiornare piano o documentazione se la feature introduce nuova area funzionale
