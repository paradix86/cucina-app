# Contributing

## Setup

Il progetto non richiede build.

### Avvio locale

Opzione semplice:

```bash
python3 -m http.server 5500
```

Poi apri:

```text
http://localhost:5500
```

## Project Rules

- Non aggiungere dipendenze senza una decisione esplicita.
- Mantieni il progetto statico.
- Tutte le stringhe utente devono stare in `js/i18n.js`.
- Se tocchi file serviti dal service worker, aggiorna `CACHE_NAME` in `sw.js`.
- Se fai modifiche mirate, evita refactor non richiesti.

## Coding Conventions

- JS semplice, leggibile, senza framework.
- Naming preferito: inglese per nuovi campi e funzioni strutturali.
- Compatibilita con dati legacy quando possibile.
- CSS organizzato in blocchi commentati.

## Pull Request Checklist

- [ ] La feature/fix funziona davvero nel browser
- [ ] Nessun errore console
- [ ] Le stringhe sono internazionalizzate
- [ ] La UI resta usabile su touch
- [ ] Il service worker cache e stato gestito correttamente
- [ ] Non sono stati introdotti refactor non necessari

## Recommended Manual Test Areas

- Navigazione tab
- Ricette built-in
- Detail view
- Servings scaling
- Timer
- Import
- Ricettario/localStorage
- Offline/PWA base behavior

## Playwright Notes

Quando testi modifiche UI:

- pulisci cache e service worker se necessario
- verifica sempre anche `console`
- se la feature tocca detail view o timers, testa il flusso completo e non solo il rendering iniziale

## Documentation

Se aggiungi una macro-feature:

- aggiorna `PROJECT_PLAN.md`
- aggiorna `README.md` se cambia il comportamento utente
- aggiorna questo file se cambia il workflow di sviluppo
