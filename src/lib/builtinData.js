/**
 * data.js — Built-in recipes (classic + Bimby TM5)
 *
 * Recipe object shape:
 *   id           string   — unique identifier
 *   name         string
 *   category     string   — Primi / Secondi / Dolci / Antipasti / Zuppe / Sughi / Bevande
 *   bimby        boolean  — true = Bimby TM5 recipe
 *   emoji        string
 *   time         string   — e.g. "30 min"
 *   servings     string   — e.g. "4"
 *   source       string   — "classica" | "bimby"
 *   ingredients  string[]
 *   steps        string[] — classic: free text
 *                        — bimby: prefix "Vel.X YY° ZZmin — text"
 *   timerMinutes number   — main timer in minutes (0 = none)
 */

export const BUILTIN_RECIPES = [

  /* ==================== CLASSICHE ==================== */

  {
    id: 'b1', name: 'Pasta al pomodoro', category: 'Primi', bimby: false,
    emoji: '🍝', time: '20 min', servings: '4', source: 'classica',
    ingredients: ['320g pasta', '400g pomodori pelati', '2 spicchi aglio', 'basilico fresco', 'olio evo', 'sale'],
    steps: [
      'Porta a ebollizione una pentola di acqua salata e cuoci la pasta.',
      "In una padella scalda un filo di olio con l'aglio, aggiungi i pomodori pelati e cuoci a fuoco medio per 10 min.",
      'Scola la pasta al dente e mantecala nel sugo per 1-2 min.',
      'Aggiungi il basilico fresco e servi subito.',
    ],
    timerMinutes: 10,
  },

  {
    id: 'b2', name: 'Pollo arrosto', category: 'Secondi', bimby: false,
    emoji: '🍗', time: '70 min', servings: '4', source: 'classica',
    ingredients: ['1 pollo intero (~1.5kg)', 'rosmarino', '4 spicchi aglio', '1 limone', 'olio evo', 'sale', 'pepe nero'],
    steps: [
      'Preriscalda il forno a 200 °C (statico).',
      "Massaggia il pollo con olio, sale, pepe, rosmarino e aglio tritato.",
      "Inserisci mezzo limone e uno spicchio d'aglio nella cavità.",
      'Cuoci in una teglia 60-70 min, bagnando con i succhi ogni 20 min.',
      'Lascia riposare 5 min prima di tagliare.',
    ],
    timerMinutes: 65,
  },

  {
    id: 'b3', name: 'Tiramisù', category: 'Dolci', bimby: false,
    emoji: '🍰', time: '30 min + 4h riposo', servings: '6', source: 'classica',
    ingredients: ['500g mascarpone', '4 uova', '100g zucchero', '200g savoiardi', 'caffè forte freddo', 'cacao amaro q.b.'],
    steps: [
      'Separa le uova. Monta i tuorli con lo zucchero fino a ottenere un composto chiaro e spumoso.',
      'Incorpora il mascarpone ai tuorli mescolando delicatamente.',
      "Monta gli albumi a neve ferma e incorporali al composto con movimenti dal basso verso l'alto.",
      'Inzuppa i savoiardi nel caffè freddo e fai uno strato in una pirofila.',
      'Copri con metà crema, poi altro strato di savoiardi e crema.',
      'Spolvera abbondantemente con cacao e metti in frigo almeno 4 ore (meglio tutta la notte).',
    ],
    timerMinutes: 240,
  },

  {
    id: 'b4', name: 'Bruschette al pomodoro', category: 'Antipasti', bimby: false,
    emoji: '🍅', time: '10 min', servings: '4', source: 'classica',
    ingredients: ['8 fette pane casereccio', '4 pomodori maturi', '1 spicchio aglio', 'basilico', 'olio evo', 'sale grosso'],
    steps: [
      'Tosta le fette di pane in forno a 200 °C per 5 min o sulla griglia.',
      'Taglia i pomodori a cubetti, condisci con sale e basilico e lascia insaporire 5 min.',
      "Strofina uno spicchio d'aglio sulle fette ancora calde.",
      'Distribuisci il pomodoro sulle bruschette e irrora con olio evo.',
    ],
    timerMinutes: 5,
  },

  {
    id: 'b5', name: 'Minestrone', category: 'Primi', bimby: false,
    emoji: '🥣', time: '50 min', servings: '6', source: 'classica',
    ingredients: ['2 patate', '2 carote', '2 zucchine', '100g fagiolini', '2 pomodori', '2 coste sedano', '1 cipolla', '400g cannellini in scatola', '80g pasta piccola', '1L brodo vegetale', 'olio evo', 'parmigiano'],
    steps: [
      'Taglia tutte le verdure a cubetti uniformi di circa 1 cm.',
      'Soffriggi cipolla e sedano in una pentola con 3 cucchiai di olio per 5 min.',
      'Aggiungi tutte le verdure e il brodo vegetale. Copri e cuoci a fuoco medio 30 min.',
      'Aggiungi i cannellini scolati e la pasta. Cuoci altri 10 min.',
      'Servi con un filo di olio a crudo e parmigiano grattugiato.',
    ],
    timerMinutes: 40,
  },

  {
    id: 'b6', name: 'Pesto alla genovese', category: 'Sughi', bimby: false,
    emoji: '🌿', time: '10 min', servings: '4', source: 'classica',
    ingredients: ['50g basilico fresco', '30g pinoli', '50g parmigiano reggiano', '20g pecorino sardo', '150ml olio evo (delicato)', '1 spicchio aglio', 'sale grosso'],
    steps: [
      'Lava il basilico e asciugalo delicatamente senza strofinare.',
      'Nel mortaio (o frullatore a bassa velocità) pestare aglio e sale grosso, poi aggiungere i pinoli.',
      'Aggiungere il basilico e pestare/frullare fino a ottenere un trito fine.',
      'Incorporare i formaggi grattugiati e mescolare.',
      "Aggiungere l'olio a filo, mescolando, fino alla consistenza desiderata.",
      'Usare subito o conservare in vasetto coperto di olio in frigo fino a 5 giorni.',
    ],
    timerMinutes: 0,
  },

  {
    id: 'b7', name: 'Frittata alle verdure', category: 'Secondi', bimby: false,
    emoji: '🍳', time: '15 min', servings: '2', source: 'classica',
    ingredients: ['4 uova', '1 zucchina', '½ peperone', '½ cipolla', 'olio evo', 'sale', 'pepe', 'parmigiano (opz.)'],
    steps: [
      'Taglia le verdure a cubetti piccoli e rosolale in padella antiaderente con un filo di olio per 5 min.',
      'Sbatti le uova con sale, pepe e parmigiano se gradito.',
      'Versa le uova sulle verdure e cuoci a fuoco medio-basso senza mescolare.',
      'Quando la superficie è quasi soda, appoggia un piatto e capovolgi la frittata. Cuoci altri 2 min.',
    ],
    timerMinutes: 8,
  },

  {
    id: 'b8', name: 'Gnocchi gourmet ricotta e zucchine', category: 'Primi', bimby: false,
    emoji: '🥟', time: '25 min', servings: '2', source: 'classica',
    ingredients: [
      '500g gnocchi di patate',
      '2 zucchine medie',
      '120g ricotta',
      '30g parmigiano grattugiato',
      '1 scalogno',
      'olio evo',
      'sale',
      'pepe nero',
      'scorza di limone (opz.)'
    ],
    steps: [
      'Taglia le zucchine a rondelle sottili o a mezzaluna e trita finemente lo scalogno.',
      'In una padella scalda un filo di olio evo e fai appassire lo scalogno a fuoco medio per 2-3 min.',
      'Aggiungi le zucchine, sala leggermente e cuoci 6-8 min finché diventano morbide ma ancora verdi.',
      'In una ciotola lavora la ricotta con parmigiano, pepe e poca scorza di limone se gradita.',
      'Cuoci gli gnocchi in acqua salata e scolali appena salgono a galla.',
      'Trasferisci gli gnocchi nella padella con le zucchine, aggiungi la crema di ricotta e manteca a fuoco dolce con 1-2 cucchiai di acqua di cottura.',
      'Servi subito con altro pepe nero e poco parmigiano sopra.',
    ],
    timerMinutes: 15,
  },

  {
    id: 'b9', name: 'Riso con macinato, cipolla rossa e salsa yogurt', category: 'Primi', bimby: false,
    emoji: '🍚', time: '30 min', servings: '2', source: 'classica',
    ingredients: [
      '160g riso bianco',
      '250g carne macinata di manzo',
      '1 cipolla rossa di Tropea piccola',
      '150g salsa di pomodoro leggera',
      '120g yogurt greco',
      '1 cucchiaino miele',
      'scorza di limone',
      'olio evo',
      'sale',
      'pepe nero'
    ],
    steps: [
      'Cuoci il riso in acqua salata secondo i tempi indicati, poi scolalo e tienilo da parte.',
      'Affetta finemente la cipolla rossa di Tropea.',
      'In una padella scalda un filo di olio evo e fai rosolare la cipolla per 3-4 min.',
      'Aggiungi il macinato di manzo, sgranalo bene e cuocilo finché risulta ben rosolato.',
      'Unisci la salsa di pomodoro, regola di sale e pepe e lascia restringere per qualche minuto.',
      'In una ciotolina mescola yogurt greco, miele e scorza di limone fino a ottenere una salsa cremosa.',
      'Impiatta il riso, aggiungi sopra il macinato al pomodoro e completa con la salsa yogurt.',
    ],
    timerMinutes: 20,
  },
  {
    id: 'b10', name: 'Pollo speziato marinato in friggitrice ad aria', category: 'Secondi', bimby: false,
    emoji: '🍗', time: '22 min + marinatura', servings: '4', source: 'classica',
    ingredients: [
      '800g cosce o sovracosce di pollo',
      '2 cucchiai olio evo',
      '1 cucchiaino paprika',
      '1 cucchiaino aglio in polvere',
      '1 cucchiaino cumino',
      '1 cucchiaino sale',
      '1/2 cucchiaino pepe nero'
    ],
    steps: [
      'Tampona bene il pollo con carta cucina.',
      'In una ciotola mescola olio evo, paprika, aglio in polvere, cumino, sale e pepe.',
      'Massaggia accuratamente il pollo con la marinatura e lascialo insaporire almeno 30 min.',
      'Disponi i pezzi nel cestello senza sovrapporli.',
      'Cuoci a 170 °C per 12 min per iniziare una cottura più dolce e uniforme.',
      'Gira il pollo.',
      'Prosegui a 190 °C per 8-10 min fino a doratura e pelle ben cotta.',
      'Controlla la cottura al cuore prima di servire.',
      'Se usi pezzi più piccoli o meno peso totale, riduci leggermente l’ultima fase; se usi pezzi grandi o cestello molto pieno, prolunga di 2-4 min.',
    ],
    timerMinutes: 22,
    scaling: {
      baseWeightGrams: 800,
      basePieces: 4,
      supportedCuts: ['cosce', 'sovracosce'],
    },
  },
  /* ==================== BIMBY TM5 ==================== */

  {
    id: 'bx1', name: 'Risotto alla milanese', category: 'Primi', bimby: true,
    emoji: '🍚', time: '35 min', servings: '4', source: 'bimby',
    ingredients: ['320g riso Carnaroli', '1 cipolla (50g)', '50g burro', '50g vino bianco secco', '1 bustina zafferano', '800g acqua', '1 dado vegetale', '80g parmigiano grattugiato', 'sale'],
    steps: [
      'Vel. 5 · 3 sec — Metti la cipolla nel boccale e trita.',
      'Temp. 100° · Vel. 1 · 3 min — Aggiungi 30g di burro e soffriggi la cipolla.',
      'Temp. 100° · Vel. 1 · 2 min — Aggiungi il riso e tosta senza misurino.',
      'Temp. 100° · Vel. 1 · 1 min — Sfuma con il vino bianco senza misurino.',
      'Temp. 100° · Vel. 1 · 18 min — Aggiungi acqua, dado e zafferano. Cuoci con misurino capovolto.',
      'A fine cottura aggiungi il burro restante e il parmigiano. Manteca 30 sec a Vel. 1 e servi.',
    ],
    timerMinutes: 18,
  },

  {
    id: 'bx2', name: 'Vellutata di zucca', category: 'Zuppe', bimby: true,
    emoji: '🎃', time: '30 min', servings: '4', source: 'bimby',
    ingredients: ['700g zucca a cubetti', '1 patata (150g)', '1 cipolla (80g)', '800g acqua', '1 dado vegetale', '30g olio evo', 'sale', 'pepe', 'panna da cucina (opz.)'],
    steps: [
      'Vel. 5 · 3 sec — Metti la cipolla nel boccale e trita.',
      "Temp. 100° · Vel. 1 · 3 min — Aggiungi l'olio e soffriggi la cipolla.",
      "Aggiungi la zucca a cubetti, la patata a pezzi, l'acqua e il dado.",
      'Temp. 100° · Vel. 1 · 20 min — Cuoci con misurino.',
      'Vel. da 5 a 9 · 1 min — Frulla gradualmente fino a crema liscia. Aggiusta di sale e pepe.',
      'Servi con un filo di panna, olio a crudo e crostini tostati.',
    ],
    timerMinutes: 20,
  },

  {
    id: 'bx3', name: 'Ragù alla bolognese', category: 'Sughi', bimby: true,
    emoji: '🥩', time: '55 min', servings: '6', source: 'bimby',
    ingredients: ['500g carne macinata mista', '1 carota', '1 costa sedano', '1 cipolla', '50g vino rosso', '400g pomodori pelati', '30g olio evo', 'sale', 'pepe', '1 foglia alloro'],
    steps: [
      'Vel. 5 · 5 sec — Trita carota, sedano e cipolla a pezzi nel boccale.',
      "Temp. 100° · Vel. 1 · 5 min — Aggiungi l'olio e soffriggi le verdure.",
      'Temp. 100° · Vel. 1 · 5 min — Aggiungi la carne macinata e rosola senza misurino.',
      'Temp. 100° · Vel. 1 · 1 min — Sfuma con il vino rosso senza misurino.',
      "Temp. 100° · Vel. 1 · 35 min — Aggiungi i pomodori pelati, l'alloro, sale e pepe. Cuoci con misurino capovolto.",
      "Rimuovi l'alloro. Il ragù è pronto per condire pasta fresca, lasagne o tagliatelle.",
    ],
    timerMinutes: 35,
  },

  {
    id: 'bx4', name: 'Besciamella', category: 'Sughi', bimby: true,
    emoji: '🥛', time: '12 min', servings: '4', source: 'bimby',
    ingredients: ['500g latte intero', '50g farina 00', '50g burro', 'noce moscata q.b.', 'sale', 'pepe bianco'],
    steps: [
      "Metti tutti gli ingredienti nel boccale nell'ordine indicato.",
      'Temp. 90° · Vel. 4 · 10 min — Cuoci mescolando continuamente.',
      "Controlla la consistenza: se è troppo densa aggiungi latte a filo e frulla 10 sec, se troppo liquida cuoci altri 2 min.",
      'Usa subito per lasagne, pasta al forno o cannelloni.',
    ],
    timerMinutes: 10,
  },

  {
    id: 'bx5', name: 'Crema pasticcera', category: 'Dolci', bimby: true,
    emoji: '🍮', time: '15 min', servings: '6', source: 'bimby',
    ingredients: ['500g latte intero', '4 tuorli', '150g zucchero', '50g amido di mais', 'scorza grattugiata 1 limone bio'],
    steps: [
      'Metti nel boccale tutti gli ingredienti.',
      'Temp. 80° · Vel. 4 · 10 min — Cuoci la crema.',
      'Vel. 4 · 5 sec — Mescola ancora brevemente a fine cottura.',
      'Versa in una ciotola, copri con pellicola a contatto e lascia raffreddare.',
      'Usa per crostate, bignè, pan di spagna farcito o dolci al cucchiaio.',
    ],
    timerMinutes: 10,
  },

  {
    id: 'bx6', name: 'Hummus di ceci', category: 'Antipasti', bimby: true,
    emoji: '🫘', time: '10 min', servings: '4', source: 'bimby',
    ingredients: ['400g ceci in scatola (scolati e sciacquati)', '2 cucchiai tahini', '1 spicchio aglio', '30ml succo di limone', '50ml olio evo', 'sale', 'paprika dolce e olio per guarnire'],
    steps: [
      'Scola e sciacqua bene i ceci sotto acqua corrente.',
      'Metti tutti gli ingredienti nel boccale.',
      'Vel. da 5 a 10 · 30 sec — Frulla fino a ottenere una crema liscia e omogenea.',
      'Controlla la consistenza: se troppo denso aggiungi poca acqua fredda e rifrulla 10 sec.',
      'Servi con un filo di olio, paprika e pane pita o crudité di verdure.',
    ],
    timerMinutes: 0,
  },

  {
    id: 'bx7', name: 'Zuppa di legumi', category: 'Zuppe', bimby: true,
    emoji: '🥗', time: '45 min', servings: '4', source: 'bimby',
    ingredients: ['200g fagioli borlotti cotti', '200g ceci cotti', '100g lenticchie rosse', '1 cipolla', '1 carota', '1 costa sedano', '400g pomodori pelati', '800g acqua', '30g olio evo', 'rosmarino', 'sale', 'pepe'],
    steps: [
      'Vel. 5 · 3 sec — Trita cipolla, carota e sedano nel boccale.',
      "Temp. 100° · Vel. 1 · 5 min — Aggiungi l'olio e soffriggi.",
      "Aggiungi tutti i legumi, i pomodori, l'acqua, il rosmarino, sale e pepe.",
      'Temp. 100° · Vel. 1 · 30 min — Cuoci con misurino capovolto.',
      'Aggiusta di sale. Servi con olio a crudo e pane tostato.',
    ],
    timerMinutes: 30,
  },

  {
    id: 'bx8', name: 'Polpette al sugo (con Varoma)', category: 'Secondi', bimby: true,
    emoji: '🍖', time: '45 min', servings: '4', source: 'bimby',
    ingredients: ['500g carne macinata mista', '1 uovo', '50g parmigiano grattugiato', '50g pangrattato', 'prezzemolo tritato', '1 spicchio aglio', 'sale', 'pepe', '400g passata di pomodoro', '30g olio evo'],
    steps: [
      'Vel. 5 · 3 sec — Trita aglio e prezzemolo nel boccale.',
      'Trasferisci il trito in una ciotola e mescola con carne, uovo, parmigiano, pangrattato, sale e pepe. Forma le polpette.',
      'Posiziona le polpette nel vassoio Varoma.',
      "Temp. 100° · Vel. 1 · 3 min — Nel boccale metti l'olio e scalda.",
      'Temp. Varoma · Vel. 1 · 20 min — Aggiungi la passata e il sale nel boccale. Cuoci con il Varoma sopra.',
      'Servi le polpette calde con il sugo del boccale.',
    ],
    timerMinutes: 20,
  },

];

BUILTIN_RECIPES.forEach(recipe => {
  if (!recipe.preparationType) recipe.preparationType = recipe.bimby ? 'bimby' : 'classic';
});
