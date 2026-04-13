# 🍳 Cucina App

App web per la cucina pensata per tablet e touchscreen (Lenovo Yoga C930 e simili).  
Nessun backend, nessuna installazione: apri `index.html` e sei pronto.

## Funzionalità

| Sezione | Cosa fa |
|---|---|
| 📚 **Ricettario** | Le tue ricette salvate, ricercabili e persistenti (localStorage) |
| ＋ **Importa** | Incolla un link YouTube / TikTok / Instagram / qualsiasi sito → l'AI estrae la ricetta |
| 🍝 **Ricette** | 17 ricette integrate: classiche italiane + Bimby TM5 |
| ⏱ **Timer** | Timer multipli in parallelo, avviabili anche dalle ricette |

## Come usarla

### Opzione 1 — direttamente nel browser
```
git clone https://github.com/tuo-username/cucina-app.git
cd cucina-app
# Apri index.html nel browser (doppio click oppure via Live Server)
```

### Opzione 2 — GitHub Pages
1. Vai su **Settings → Pages** del tuo repository
2. Seleziona **Branch: main / root**
3. L'app sarà disponibile su `https://tuo-username.github.io/cucina-app/`

## Struttura del progetto

```
cucina-app/
├── index.html          # Struttura HTML dell'app
├── css/
│   └── style.css       # Stili (dark mode inclusa)
├── js/
│   ├── data.js         # Ricette built-in (classiche + Bimby TM5)
│   ├── storage.js      # localStorage: salva / carica / esporta ricette
│   ├── timer.js        # Timer multipli in parallelo
│   ├── import.js       # Importazione ricette da URL via Claude AI
│   ├── ui.js           # Rendering e navigazione UI
│   └── app.js          # Inizializzazione
└── README.md
```

## Importazione ricette con AI

La funzione **+ Importa** usa l'API Claude (Anthropic) per analizzare qualsiasi URL e generare la ricetta strutturata.

### Dentro claude.ai (widget)
Funziona automaticamente senza configurazione.

### Standalone (GitHub Pages o locale)
Hai due opzioni:

**A) API key diretta** (solo per uso personale, non pubblicare la chiave):
```js
// js/import.js, prima riga
const ANTHROPIC_API_KEY = 'sk-ant-...';
```

**B) Backend proxy** (consigliato per uso pubblico):
Crea un piccolo server che aggiunge l'header `x-api-key` e fai puntare le chiamate al tuo proxy invece che a `api.anthropic.com`.

## Ricette Bimby TM5 incluse

- Risotto alla milanese
- Vellutata di zucca
- Ragù alla bolognese
- Besciamella
- Crema pasticcera
- Hummus di ceci
- Zuppa di legumi
- Polpette al sugo (con Varoma)

## Aggiungere ricette built-in

Modifica `js/data.js` e aggiungi un oggetto all'array `BUILTIN_RICETTE`:

```js
{
  id: 'mia1',           // ID univoco
  nome: 'La mia ricetta',
  cat: 'Primi',         // Primi / Secondi / Dolci / Antipasti / Zuppe / Sughi
  bimby: false,         // true per ricette Bimby TM5
  emoji: '🍜',
  tempo: '30 min',
  porzioni: '4',
  fonte: 'classica',    // 'classica' | 'bimby'
  ingredienti: ['200g pasta', '...'],
  steps: ['Passo 1...', 'Passo 2...'],
  timerMin: 10,         // 0 se nessun timer principale
}
```

Per ricette Bimby, i passi con impostazioni del robot usano il formato:
```
"Vel. 5 · 3 sec — Descrizione del passo"
"Temp. 100° · Vel. 1 · 10 min — Descrizione del passo"
```

## Compatibilità

Testata su Chrome, Firefox, Safari, Edge.  
Ottimizzata per touchscreen e modalità tenda/tablet.  
Dark mode automatica tramite `prefers-color-scheme`.

## Licenza

MIT — libero uso personale e commerciale.
