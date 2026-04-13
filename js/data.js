/**
 * data.js — Ricette built-in (classiche + Bimby TM5)
 *
 * Struttura di ogni ricetta:
 *   id         string   — identificatore univoco
 *   nome       string
 *   cat        string   — Primi / Secondi / Dolci / Antipasti / Zuppe / Sughi / Bevande
 *   bimby      boolean  — true = ricetta Bimby TM5
 *   emoji      string
 *   tempo      string   — es. "30 min"
 *   porzioni   string   — es. "4"
 *   fonte      string   — "classica" | "bimby"
 *   ingredienti string[]
 *   steps       string[]  — per ricette classiche: testo libero
 *                        — per ricette Bimby: prefisso "Vel.X YY° ZZmin — testo"
 *   timerMin   number   — minuti timer principale (0 = nessun timer)
 */

const BUILTIN_RICETTE = [

  /* ==================== CLASSICHE ==================== */

  {
    id: 'b1', nome: 'Pasta al pomodoro', cat: 'Primi', bimby: false,
    emoji: '🍝', tempo: '20 min', porzioni: '4', fonte: 'classica',
    ingredienti: ['320g pasta', '400g pomodori pelati', '2 spicchi aglio', 'basilico fresco', 'olio evo', 'sale'],
    steps: [
      'Porta a ebollizione una pentola di acqua salata e cuoci la pasta.',
      'In una padella scalda un filo di olio con l\'aglio, aggiungi i pomodori pelati e cuoci a fuoco medio per 10 min.',
      'Scola la pasta al dente e mantecala nel sugo per 1-2 min.',
      'Aggiungi il basilico fresco e servi subito.',
    ],
    timerMin: 10,
  },

  {
    id: 'b2', nome: 'Pollo arrosto', cat: 'Secondi', bimby: false,
    emoji: '🍗', tempo: '70 min', porzioni: '4', fonte: 'classica',
    ingredienti: ['1 pollo intero (~1.5kg)', 'rosmarino', '4 spicchi aglio', '1 limone', 'olio evo', 'sale', 'pepe nero'],
    steps: [
      'Preriscalda il forno a 200 °C (statico).',
      'Massaggia il pollo con olio, sale, pepe, rosmarino e aglio tritato.',
      'Inserisci mezzo limone e uno spicchio d\'aglio nella cavità.',
      'Cuoci in una teglia 60-70 min, bagnando con i succhi ogni 20 min.',
      'Lascia riposare 5 min prima di tagliare.',
    ],
    timerMin: 65,
  },

  {
    id: 'b3', nome: 'Tiramisù', cat: 'Dolci', bimby: false,
    emoji: '🍰', tempo: '30 min + 4h riposo', porzioni: '6', fonte: 'classica',
    ingredienti: ['500g mascarpone', '4 uova', '100g zucchero', '200g savoiardi', 'caffè forte freddo', 'cacao amaro q.b.'],
    steps: [
      'Separa le uova. Monta i tuorli con lo zucchero fino a ottenere un composto chiaro e spumoso.',
      'Incorpora il mascarpone ai tuorli mescolando delicatamente.',
      'Monta gli albumi a neve ferma e incorporali al composto con movimenti dal basso verso l\'alto.',
      'Inzuppa i savoiardi nel caffè freddo e fai uno strato in una pirofila.',
      'Copri con metà crema, poi altro strato di savoiardi e crema.',
      'Spolvera abbondantemente con cacao e metti in frigo almeno 4 ore (meglio tutta la notte).',
    ],
    timerMin: 240,
  },

  {
    id: 'b4', nome: 'Bruschette al pomodoro', cat: 'Antipasti', bimby: false,
    emoji: '🍅', tempo: '10 min', porzioni: '4', fonte: 'classica',
    ingredienti: ['8 fette pane casereccio', '4 pomodori maturi', '1 spicchio aglio', 'basilico', 'olio evo', 'sale grosso'],
    steps: [
      'Tosta le fette di pane in forno a 200 °C per 5 min o sulla griglia.',
      'Taglia i pomodori a cubetti, condisci con sale e basilico e lascia insaporire 5 min.',
      'Strofina uno spicchio d\'aglio sulle fette ancora calde.',
      'Distribuisci il pomodoro sulle bruschette e irrora con olio evo.',
    ],
    timerMin: 5,
  },

  {
    id: 'b5', nome: 'Minestrone', cat: 'Primi', bimby: false,
    emoji: '🥣', tempo: '50 min', porzioni: '6', fonte: 'classica',
    ingredienti: ['2 patate', '2 carote', '2 zucchine', '100g fagiolini', '2 pomodori', '2 coste sedano', '1 cipolla', '400g cannellini in scatola', '80g pasta piccola', '1L brodo vegetale', 'olio evo', 'parmigiano'],
    steps: [
      'Taglia tutte le verdure a cubetti uniformi di circa 1 cm.',
      'Soffriggi cipolla e sedano in una pentola con 3 cucchiai di olio per 5 min.',
      'Aggiungi tutte le verdure e il brodo vegetale. Copri e cuoci a fuoco medio 30 min.',
      'Aggiungi i cannellini scolati e la pasta. Cuoci altri 10 min.',
      'Servi con un filo di olio a crudo e parmigiano grattugiato.',
    ],
    timerMin: 40,
  },

  {
    id: 'b6', nome: 'Pesto alla genovese', cat: 'Sughi', bimby: false,
    emoji: '🌿', tempo: '10 min', porzioni: '4', fonte: 'classica',
    ingredienti: ['50g basilico fresco', '30g pinoli', '50g parmigiano reggiano', '20g pecorino sardo', '150ml olio evo (delicato)', '1 spicchio aglio', 'sale grosso'],
    steps: [
      'Lava il basilico e asciugalo delicatamente senza strofinare.',
      'Nel mortaio (o frullatore a bassa velocità) pestare aglio e sale grosso, poi aggiungere i pinoli.',
      'Aggiungere il basilico e pestare/frullare fino a ottenere un trito fine.',
      'Incorporare i formaggi grattugiati e mescolare.',
      'Aggiungere l\'olio a filo, mescolando, fino alla consistenza desiderata.',
      'Usare subito o conservare in vasetto coperto di olio in frigo fino a 5 giorni.',
    ],
    timerMin: 0,
  },

  {
    id: 'b7', nome: 'Frittata alle verdure', cat: 'Secondi', bimby: false,
    emoji: '🍳', tempo: '15 min', porzioni: '2', fonte: 'classica',
    ingredienti: ['4 uova', '1 zucchina', '½ peperone', '½ cipolla', 'olio evo', 'sale', 'pepe', 'parmigiano (opz.)'],
    steps: [
      'Taglia le verdure a cubetti piccoli e rosolale in padella antiaderente con un filo di olio per 5 min.',
      'Sbatti le uova con sale, pepe e parmigiano se gradito.',
      'Versa le uova sulle verdure e cuoci a fuoco medio-basso senza mescolare.',
      'Quando la superficie è quasi soda, appoggia un piatto e capovolgi la frittata. Cuoci altri 2 min.',
    ],
    timerMin: 8,
  },

  /* ==================== BIMBY TM5 ==================== */

  {
    id: 'bx1', nome: 'Risotto alla milanese', cat: 'Primi', bimby: true,
    emoji: '🍚', tempo: '35 min', porzioni: '4', fonte: 'bimby',
    ingredienti: ['320g riso Carnaroli', '1 cipolla (50g)', '50g burro', '50g vino bianco secco', '1 bustina zafferano', '800g acqua', '1 dado vegetale', '80g parmigiano grattugiato', 'sale'],
    steps: [
      'Vel. 5 · 3 sec — Metti la cipolla nel boccale e trita.',
      'Temp. 100° · Vel. 1 · 3 min — Aggiungi 30g di burro e soffriggi la cipolla.',
      'Temp. 100° · Vel. 1 · 2 min — Aggiungi il riso e tosta senza misurino.',
      'Temp. 100° · Vel. 1 · 1 min — Sfuma con il vino bianco senza misurino.',
      'Temp. 100° · Vel. 1 · 18 min — Aggiungi acqua, dado e zafferano. Cuoci con misurino capovolto.',
      'A fine cottura aggiungi il burro restante e il parmigiano. Manteca 30 sec a Vel. 1 e servi.',
    ],
    timerMin: 18,
  },

  {
    id: 'bx2', nome: 'Vellutata di zucca', cat: 'Zuppe', bimby: true,
    emoji: '🎃', tempo: '30 min', porzioni: '4', fonte: 'bimby',
    ingredienti: ['700g zucca a cubetti', '1 patata (150g)', '1 cipolla (80g)', '800g acqua', '1 dado vegetale', '30g olio evo', 'sale', 'pepe', 'panna da cucina (opz.)'],
    steps: [
      'Vel. 5 · 3 sec — Metti la cipolla nel boccale e trita.',
      'Temp. 100° · Vel. 1 · 3 min — Aggiungi l\'olio e soffriggi la cipolla.',
      'Aggiungi la zucca a cubetti, la patata a pezzi, l\'acqua e il dado.',
      'Temp. 100° · Vel. 1 · 20 min — Cuoci con misurino.',
      'Vel. da 5 a 9 · 1 min — Frulla gradualmente fino a crema liscia. Aggiusta di sale e pepe.',
      'Servi con un filo di panna, olio a crudo e crostini tostati.',
    ],
    timerMin: 20,
  },

  {
    id: 'bx3', nome: 'Ragù alla bolognese', cat: 'Sughi', bimby: true,
    emoji: '🥩', tempo: '55 min', porzioni: '6', fonte: 'bimby',
    ingredienti: ['500g carne macinata mista', '1 carota', '1 costa sedano', '1 cipolla', '50g vino rosso', '400g pomodori pelati', '30g olio evo', 'sale', 'pepe', '1 foglia alloro'],
    steps: [
      'Vel. 5 · 5 sec — Trita carota, sedano e cipolla a pezzi nel boccale.',
      'Temp. 100° · Vel. 1 · 5 min — Aggiungi l\'olio e soffriggi le verdure.',
      'Temp. 100° · Vel. 1 · 5 min — Aggiungi la carne macinata e rosola senza misurino.',
      'Temp. 100° · Vel. 1 · 1 min — Sfuma con il vino rosso senza misurino.',
      'Temp. 100° · Vel. 1 · 35 min — Aggiungi i pomodori pelati, l\'alloro, sale e pepe. Cuoci con misurino capovolto.',
      'Rimuovi l\'alloro. Il ragù è pronto per condire pasta fresca, lasagne o tagliatelle.',
    ],
    timerMin: 35,
  },

  {
    id: 'bx4', nome: 'Besciamella', cat: 'Sughi', bimby: true,
    emoji: '🥛', tempo: '12 min', porzioni: '4', fonte: 'bimby',
    ingredienti: ['500g latte intero', '50g farina 00', '50g burro', 'noce moscata q.b.', 'sale', 'pepe bianco'],
    steps: [
      'Metti tutti gli ingredienti nel boccale nell\'ordine indicato.',
      'Temp. 90° · Vel. 4 · 10 min — Cuoci mescolando continuamente.',
      'Controlla la consistenza: se è troppo densa aggiungi latte a filo e frulla 10 sec, se troppo liquida cuoci altri 2 min.',
      'Usa subito per lasagne, pasta al forno o cannelloni.',
    ],
    timerMin: 10,
  },

  {
    id: 'bx5', nome: 'Crema pasticcera', cat: 'Dolci', bimby: true,
    emoji: '🍮', tempo: '15 min', porzioni: '6', fonte: 'bimby',
    ingredienti: ['500g latte intero', '4 tuorli', '150g zucchero', '50g amido di mais', 'scorza grattugiata 1 limone bio'],
    steps: [
      'Metti nel boccale tutti gli ingredienti.',
      'Temp. 80° · Vel. 4 · 10 min — Cuoci la crema.',
      'Vel. 4 · 5 sec — Mescola ancora brevemente a fine cottura.',
      'Versa in una ciotola, copri con pellicola a contatto e lascia raffreddare.',
      'Usa per crostate, bignè, pan di spagna farcito o dolci al cucchiaio.',
    ],
    timerMin: 10,
  },

  {
    id: 'bx6', nome: 'Hummus di ceci', cat: 'Antipasti', bimby: true,
    emoji: '🫘', tempo: '10 min', porzioni: '4', fonte: 'bimby',
    ingredienti: ['400g ceci in scatola (scolati e sciacquati)', '2 cucchiai tahini', '1 spicchio aglio', '30ml succo di limone', '50ml olio evo', 'sale', 'paprika dolce e olio per guarnire'],
    steps: [
      'Scola e sciacqua bene i ceci sotto acqua corrente.',
      'Metti tutti gli ingredienti nel boccale.',
      'Vel. da 5 a 10 · 30 sec — Frulla fino a ottenere una crema liscia e omogenea.',
      'Controlla la consistenza: se troppo denso aggiungi poca acqua fredda e rifrulla 10 sec.',
      'Servi con un filo di olio, paprika e pane pita o crudité di verdure.',
    ],
    timerMin: 0,
  },

  {
    id: 'bx7', nome: 'Zuppa di legumi', cat: 'Zuppe', bimby: true,
    emoji: '🥗', tempo: '45 min', porzioni: '4', fonte: 'bimby',
    ingredienti: ['200g fagioli borlotti cotti', '200g ceci cotti', '100g lenticchie rosse', '1 cipolla', '1 carota', '1 costa sedano', '400g pomodori pelati', '800g acqua', '30g olio evo', 'rosmarino', 'sale', 'pepe'],
    steps: [
      'Vel. 5 · 3 sec — Trita cipolla, carota e sedano nel boccale.',
      'Temp. 100° · Vel. 1 · 5 min — Aggiungi l\'olio e soffriggi.',
      'Aggiungi tutti i legumi, i pomodori, l\'acqua, il rosmarino, sale e pepe.',
      'Temp. 100° · Vel. 1 · 30 min — Cuoci con misurino capovolto.',
      'Aggiusta di sale. Servi con olio a crudo e pane tostato.',
    ],
    timerMin: 30,
  },

  {
    id: 'bx8', nome: 'Polpette al sugo (con Varoma)', cat: 'Secondi', bimby: true,
    emoji: '🍖', tempo: '45 min', porzioni: '4', fonte: 'bimby',
    ingredienti: ['500g carne macinata mista', '1 uovo', '50g parmigiano grattugiato', '50g pangrattato', 'prezzemolo tritato', '1 spicchio aglio', 'sale', 'pepe', '400g passata di pomodoro', '30g olio evo'],
    steps: [
      'Vel. 5 · 3 sec — Trita aglio e prezzemolo nel boccale.',
      'Trasferisci il trito in una ciotola e mescola con carne, uovo, parmigiano, pangrattato, sale e pepe. Forma le polpette.',
      'Posiziona le polpette nel vassoio Varoma.',
      'Temp. 100° · Vel. 1 · 3 min — Nel boccale metti l\'olio e scalda.',
      'Temp. Varoma · Vel. 1 · 20 min — Aggiungi la passata e il sale nel boccale. Cuoci con il Varoma sopra.',
      'Servi le polpette calde con il sugo del boccale.',
    ],
    timerMin: 20,
  },

];
