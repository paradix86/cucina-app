import type { NutritionPer100g } from '../types';

// Generic reference values derived from CREA (Italian National Research Institute for
// Food and Nutrition) and USDA food composition tables.  Values are per-100 g of the
// edible portion as typically consumed (cooked legumes, fresh fruit/veg, dry cereals).
// These are NOT brand-specific and are intentionally approximate averages.
// Do NOT use for medical or dietetic advice.

export type BaseIngredientNutritionEntry = {
  id:              string;
  canonicalName:   string;
  aliases:         string[];   // all lowercase; used for matching
  category?:       string;
  nutritionPer100g: NutritionPer100g;
};

export const BASE_INGREDIENTS_DATA: readonly BaseIngredientNutritionEntry[] = [

  // ── Cereals / carbs ───────────────────────────────────────────────────────

  {
    id:            'base-pasta-secca',
    canonicalName: 'Pasta secca',
    aliases:       ['pasta', 'pasta secca', 'spaghetti', 'penne', 'rigatoni', 'fusilli', 'tagliatelle', 'linguine', 'bucatini'],
    category:      'cereals',
    nutritionPer100g: { kcal: 350, proteinG: 12, carbsG: 70, sugarsG: 2, fatG: 1.5, fiberG: 3 },
  },
  {
    id:            'base-pasta-integrale',
    canonicalName: 'Pasta integrale',
    aliases:       ['pasta integrale', 'spaghetti integrali', 'penne integrali'],
    category:      'cereals',
    nutritionPer100g: { kcal: 335, proteinG: 12, carbsG: 66, sugarsG: 1.5, fatG: 2, fiberG: 7 },
  },
  {
    id:            'base-riso-bianco',
    canonicalName: 'Riso',
    aliases:       ['riso', 'riso bianco', 'riso carnaroli', 'riso arborio'],
    category:      'cereals',
    nutritionPer100g: { kcal: 350, proteinG: 7, carbsG: 77, sugarsG: 0, fatG: 0.5, fiberG: 1 },
  },
  {
    id:            'base-riso-basmati',
    canonicalName: 'Riso basmati',
    aliases:       ['riso basmati'],
    category:      'cereals',
    nutritionPer100g: { kcal: 348, proteinG: 7, carbsG: 77, sugarsG: 0.1, fatG: 0.5, fiberG: 0.4 },
  },
  {
    id:            'base-riso-integrale',
    canonicalName: 'Riso integrale',
    aliases:       ['riso integrale', 'riso venere'],
    category:      'cereals',
    nutritionPer100g: { kcal: 335, proteinG: 7, carbsG: 70, sugarsG: 0.7, fatG: 2, fiberG: 3.5 },
  },
  {
    id:            'base-avena',
    canonicalName: 'Avena',
    aliases:       ["fiocchi d'avena", 'avena', 'fiocchi di avena', 'farina di avena', 'porridge', 'oats'],
    category:      'cereals',
    nutritionPer100g: { kcal: 389, proteinG: 17, carbsG: 66, sugarsG: 1, fatG: 7, fiberG: 11 },
  },
  {
    id:            'base-farina-00',
    canonicalName: 'Farina 00',
    aliases:       ['farina', 'farina 00', 'farina di grano tenero', 'farina bianca', 'farina manitoba'],
    category:      'cereals',
    nutritionPer100g: { kcal: 364, proteinG: 10, carbsG: 76, sugarsG: 1, fatG: 1, fiberG: 3 },
  },
  {
    id:            'base-farina-integrale',
    canonicalName: 'Farina integrale',
    aliases:       ['farina integrale', 'farina di grano duro', 'farina di farro'],
    category:      'cereals',
    nutritionPer100g: { kcal: 339, proteinG: 13, carbsG: 68, sugarsG: 1, fatG: 2, fiberG: 10 },
  },
  {
    id:            'base-pane',
    canonicalName: 'Pane',
    aliases:       ['pane', 'pane bianco', 'pane comune', 'pane casareccio'],
    category:      'cereals',
    nutritionPer100g: { kcal: 265, proteinG: 9, carbsG: 50, sugarsG: 3, fatG: 3, fiberG: 3 },
  },
  {
    id:            'base-pangrattato',
    canonicalName: 'Pangrattato',
    aliases:       ['pangrattato', 'pane grattugiato'],
    category:      'cereals',
    nutritionPer100g: { kcal: 395, proteinG: 12, carbsG: 80, sugarsG: 3, fatG: 4, fiberG: 4 },
  },
  {
    id:            'base-cous-cous',
    canonicalName: 'Cous cous',
    aliases:       ['cous cous', 'couscous', 'cuscus'],
    category:      'cereals',
    nutritionPer100g: { kcal: 376, proteinG: 13, carbsG: 77, sugarsG: 0.5, fatG: 0.6, fiberG: 5 },
  },
  {
    id:            'base-quinoa',
    canonicalName: 'Quinoa',
    aliases:       ['quinoa'],
    category:      'cereals',
    nutritionPer100g: { kcal: 368, proteinG: 14, carbsG: 64, sugarsG: 1.6, fatG: 6, fiberG: 7 },
  },

  // ── Dairy ─────────────────────────────────────────────────────────────────

  {
    id:            'base-latte-intero',
    canonicalName: 'Latte intero',
    aliases:       ['latte', 'latte intero', 'latte fresco', 'latte fresco intero'],
    category:      'dairy',
    nutritionPer100g: { kcal: 61, proteinG: 3.2, carbsG: 4.8, sugarsG: 4.8, fatG: 3.3, saturatedFatG: 2.1, calciumMg: 120 },
  },
  {
    id:            'base-latte-parzialmente-scremato',
    canonicalName: 'Latte parzialmente scremato',
    aliases:       ['latte parzialmente scremato', 'latte p.s.', 'latte semi-scremato'],
    category:      'dairy',
    nutritionPer100g: { kcal: 46, proteinG: 3.3, carbsG: 4.8, sugarsG: 4.8, fatG: 1.6, saturatedFatG: 1.0, calciumMg: 120 },
  },
  {
    id:            'base-latte-scremato',
    canonicalName: 'Latte scremato',
    aliases:       ['latte scremato', 'latte magro'],
    category:      'dairy',
    nutritionPer100g: { kcal: 34, proteinG: 3.4, carbsG: 4.8, sugarsG: 4.8, fatG: 0.1, calciumMg: 123 },
  },
  {
    id:            'base-yogurt-greco',
    canonicalName: 'Yogurt greco',
    aliases:       ['yogurt greco', 'yogurt greco intero'],
    category:      'dairy',
    nutritionPer100g: { kcal: 97, proteinG: 9, carbsG: 4, sugarsG: 4, fatG: 5, calciumMg: 110 },
  },
  {
    id:            'base-yogurt-bianco',
    canonicalName: 'Yogurt bianco',
    aliases:       ['yogurt', 'yogurt bianco', 'yogurt naturale', 'yogurt intero'],
    category:      'dairy',
    nutritionPer100g: { kcal: 61, proteinG: 4, carbsG: 4.7, sugarsG: 4.7, fatG: 3.5, calciumMg: 130 },
  },
  {
    id:            'base-burro',
    canonicalName: 'Burro',
    aliases:       ['burro', 'burro fresco', 'burro chiarificato'],
    category:      'dairy',
    nutritionPer100g: { kcal: 717, proteinG: 0.9, carbsG: 0.6, sugarsG: 0.6, fatG: 81, saturatedFatG: 51 },
  },
  {
    id:            'base-parmigiano',
    canonicalName: 'Parmigiano Reggiano',
    aliases:       ['parmigiano', 'parmigiano reggiano', 'grana padano', 'grana'],
    category:      'dairy',
    nutritionPer100g: { kcal: 392, proteinG: 36, carbsG: 0, fatG: 26, saturatedFatG: 17, calciumMg: 1160, saltG: 1.6 },
  },
  {
    id:            'base-mozzarella',
    canonicalName: 'Mozzarella',
    aliases:       ['mozzarella', 'mozzarella di bufala', 'fior di latte'],
    category:      'dairy',
    nutritionPer100g: { kcal: 250, proteinG: 18, carbsG: 2.5, sugarsG: 0, fatG: 19, saturatedFatG: 12, calciumMg: 500 },
  },
  {
    id:            'base-ricotta',
    canonicalName: 'Ricotta',
    aliases:       ['ricotta', 'ricotta vaccina', 'ricotta fresca'],
    category:      'dairy',
    nutritionPer100g: { kcal: 174, proteinG: 11, carbsG: 3, sugarsG: 3, fatG: 13, saturatedFatG: 8, calciumMg: 207 },
  },

  // ── Protein ───────────────────────────────────────────────────────────────

  {
    id:            'base-uova',
    canonicalName: 'Uova',
    aliases:       ['uova', 'uovo', 'uove', 'uova intere', 'egg', 'eggs'],
    category:      'protein',
    nutritionPer100g: { kcal: 143, proteinG: 13, carbsG: 1, fatG: 10, saturatedFatG: 3 },
  },
  {
    id:            'base-pollo',
    canonicalName: 'Pollo',
    aliases:       ['pollo', 'pollo intero', 'cosce di pollo', 'sovracosce di pollo'],
    category:      'protein',
    nutritionPer100g: { kcal: 189, proteinG: 18, carbsG: 0, fatG: 13, saturatedFatG: 3.5 },
  },
  {
    id:            'base-petto-di-pollo',
    canonicalName: 'Petto di pollo',
    aliases:       ['petto di pollo', 'petto pollo', 'filetto di pollo'],
    category:      'protein',
    nutritionPer100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, saturatedFatG: 1 },
  },
  {
    id:            'base-manzo',
    canonicalName: 'Manzo',
    aliases:       ['manzo', 'carne di manzo', 'bistecca', 'fettine di manzo'],
    category:      'protein',
    nutritionPer100g: { kcal: 250, proteinG: 26, carbsG: 0, fatG: 17, saturatedFatG: 7 },
  },
  {
    id:            'base-carne-macinata',
    canonicalName: 'Carne macinata di manzo',
    aliases:       ['carne macinata', 'carne macinata di manzo', 'macinato di manzo', 'macinato', 'trito di manzo'],
    category:      'protein',
    nutritionPer100g: { kcal: 235, proteinG: 17, carbsG: 0, fatG: 18, saturatedFatG: 7 },
  },
  {
    id:            'base-salmone',
    canonicalName: 'Salmone',
    aliases:       ['salmone', 'salmone fresco', 'filetto di salmone', 'salmone atlantico'],
    category:      'protein',
    nutritionPer100g: { kcal: 208, proteinG: 20, carbsG: 0, fatG: 13, saturatedFatG: 3 },
  },
  {
    id:            'base-tonno',
    canonicalName: 'Tonno',
    aliases:       ['tonno', 'tonno al naturale', 'tonno in scatola', 'tonno sott\'acqua'],
    category:      'protein',
    nutritionPer100g: { kcal: 116, proteinG: 26, carbsG: 0, fatG: 1, saturatedFatG: 0.3 },
  },
  {
    id:            'base-tofu',
    canonicalName: 'Tofu',
    aliases:       ['tofu', 'tofu naturale', 'tofu sodo'],
    category:      'protein',
    nutritionPer100g: { kcal: 76, proteinG: 8, carbsG: 2, fatG: 4.5, fiberG: 0.3, calciumMg: 350 },
  },
  {
    id:            'base-seitan',
    canonicalName: 'Seitan',
    aliases:       ['seitan'],
    category:      'protein',
    nutritionPer100g: { kcal: 370, proteinG: 75, carbsG: 14, fatG: 2, fiberG: 0.6 },
  },

  // ── Legumes ───────────────────────────────────────────────────────────────

  {
    id:            'base-ceci',
    canonicalName: 'Ceci',
    aliases:       ['ceci', 'ceci cotti', 'ceci in scatola'],
    category:      'legumes',
    nutritionPer100g: { kcal: 164, proteinG: 9, carbsG: 27, sugarsG: 4.8, fatG: 2.6, fiberG: 8, ironMg: 2.9 },
  },
  {
    id:            'base-lenticchie',
    canonicalName: 'Lenticchie',
    aliases:       ['lenticchie', 'lenticchie cotte', 'lenticchie rosse', 'lenticchie verdi'],
    category:      'legumes',
    nutritionPer100g: { kcal: 116, proteinG: 9, carbsG: 20, sugarsG: 1.8, fatG: 0.4, fiberG: 8, ironMg: 3.3 },
  },
  {
    id:            'base-fagioli',
    canonicalName: 'Fagioli',
    aliases:       ['fagioli', 'fagioli borlotti', 'fagioli cannellini', 'fagioli cotti'],
    category:      'legumes',
    nutritionPer100g: { kcal: 127, proteinG: 8.7, carbsG: 22, sugarsG: 0.3, fatG: 0.5, fiberG: 6.5, ironMg: 2.1 },
  },
  {
    id:            'base-piselli',
    canonicalName: 'Piselli',
    aliases:       ['piselli', 'piselli freschi', 'piselli surgelati', 'piselli in scatola'],
    category:      'legumes',
    nutritionPer100g: { kcal: 81, proteinG: 5.4, carbsG: 14, sugarsG: 5.7, fatG: 0.4, fiberG: 5.7 },
  },

  // ── Fruit ─────────────────────────────────────────────────────────────────

  {
    id:            'base-banana',
    canonicalName: 'Banana',
    aliases:       ['banana', 'banane'],
    category:      'fruit',
    nutritionPer100g: { kcal: 89, proteinG: 1.1, carbsG: 23, sugarsG: 12, fatG: 0.3, fiberG: 2.6, potassiumMg: 358 },
  },
  {
    id:            'base-mela',
    canonicalName: 'Mela',
    aliases:       ['mela', 'mele', 'mele golden', 'mele fuji', 'mela verde'],
    category:      'fruit',
    nutritionPer100g: { kcal: 52, proteinG: 0.3, carbsG: 14, sugarsG: 10, fatG: 0.2, fiberG: 2.4, vitaminCMg: 4.6 },
  },
  {
    id:            'base-pera',
    canonicalName: 'Pera',
    aliases:       ['pera', 'pere'],
    category:      'fruit',
    nutritionPer100g: { kcal: 57, proteinG: 0.4, carbsG: 15, sugarsG: 10, fatG: 0.1, fiberG: 3.1, vitaminCMg: 4.3 },
  },
  {
    id:            'base-fragole',
    canonicalName: 'Fragole',
    aliases:       ['fragola', 'fragole'],
    category:      'fruit',
    nutritionPer100g: { kcal: 32, proteinG: 0.7, carbsG: 7.7, sugarsG: 4.9, fatG: 0.3, fiberG: 2, vitaminCMg: 59 },
  },
  {
    id:            'base-avocado',
    canonicalName: 'Avocado',
    aliases:       ['avocado'],
    category:      'fruit',
    nutritionPer100g: { kcal: 160, proteinG: 2, carbsG: 9, sugarsG: 0.7, fatG: 15, saturatedFatG: 2.1, fiberG: 7, potassiumMg: 485 },
  },
  {
    id:            'base-limone',
    canonicalName: 'Limone',
    aliases:       ['limone', 'limoni', 'succo di limone', 'scorza di limone'],
    category:      'fruit',
    nutritionPer100g: { kcal: 29, proteinG: 1.1, carbsG: 9, sugarsG: 2.5, fatG: 0.3, fiberG: 2.8, vitaminCMg: 53 },
  },

  // ── Vegetables ────────────────────────────────────────────────────────────

  {
    id:            'base-pomodoro',
    canonicalName: 'Pomodoro',
    aliases:       ['pomodoro', 'pomodori', 'pomodorini', 'pomodori ciliegino', 'pomodori san marzano', 'pomodori pelati', 'passata di pomodoro'],
    category:      'vegetables',
    nutritionPer100g: { kcal: 18, proteinG: 0.9, carbsG: 3.5, sugarsG: 2.6, fatG: 0.2, fiberG: 1.2, vitaminCMg: 19 },
  },
  {
    id:            'base-zucchina',
    canonicalName: 'Zucchina',
    aliases:       ['zucchina', 'zucchine', 'zucchino'],
    category:      'vegetables',
    nutritionPer100g: { kcal: 17, proteinG: 1.2, carbsG: 3.1, sugarsG: 2.5, fatG: 0.3, fiberG: 1, vitaminCMg: 17 },
  },
  {
    id:            'base-melanzana',
    canonicalName: 'Melanzana',
    aliases:       ['melanzana', 'melanzane'],
    category:      'vegetables',
    nutritionPer100g: { kcal: 25, proteinG: 1, carbsG: 5.9, sugarsG: 3.5, fatG: 0.2, fiberG: 3 },
  },
  {
    id:            'base-carota',
    canonicalName: 'Carote',
    aliases:       ['carota', 'carote'],
    category:      'vegetables',
    nutritionPer100g: { kcal: 41, proteinG: 0.9, carbsG: 9.6, sugarsG: 4.7, fatG: 0.2, fiberG: 2.8, vitaminCMg: 6 },
  },
  {
    id:            'base-cipolla',
    canonicalName: 'Cipolla',
    aliases:       ['cipolla', 'cipolle', 'cipollotto', 'cipollotti'],
    category:      'vegetables',
    nutritionPer100g: { kcal: 40, proteinG: 1.1, carbsG: 9, sugarsG: 4.2, fatG: 0.1, fiberG: 1.7 },
  },
  {
    id:            'base-aglio',
    canonicalName: 'Aglio',
    aliases:       ['aglio', "spicchio d'aglio", "spicchi d'aglio", 'spicchio aglio'],
    category:      'vegetables',
    nutritionPer100g: { kcal: 149, proteinG: 6.4, carbsG: 33, sugarsG: 1, fatG: 0.5, fiberG: 2.1 },
  },
  {
    id:            'base-spinaci',
    canonicalName: 'Spinaci',
    aliases:       ['spinaci', 'spinacino', 'spinaci freschi'],
    category:      'vegetables',
    nutritionPer100g: { kcal: 23, proteinG: 2.9, carbsG: 3.6, sugarsG: 0.4, fatG: 0.4, fiberG: 2.2, ironMg: 2.7, calciumMg: 99 },
  },
  {
    id:            'base-patata',
    canonicalName: 'Patate',
    aliases:       ['patata', 'patate'],
    category:      'vegetables',
    nutritionPer100g: { kcal: 77, proteinG: 2, carbsG: 17, sugarsG: 0.8, fatG: 0.1, fiberG: 2.2, potassiumMg: 421 },
  },
  {
    id:            'base-patata-dolce',
    canonicalName: 'Patata dolce',
    aliases:       ['patata dolce', 'patate dolci', 'sweet potato'],
    category:      'vegetables',
    nutritionPer100g: { kcal: 86, proteinG: 1.6, carbsG: 20, sugarsG: 4.2, fatG: 0.1, fiberG: 3, vitaminCMg: 2.4 },
  },
  {
    id:            'base-funghi',
    canonicalName: 'Funghi',
    aliases:       ['funghi', 'funghi champignon', 'funghi porcini', 'funghi misti', 'champignon'],
    category:      'vegetables',
    nutritionPer100g: { kcal: 22, proteinG: 3.1, carbsG: 3.3, sugarsG: 2, fatG: 0.3, fiberG: 1 },
  },

  // ── Fats / condiments ─────────────────────────────────────────────────────

  {
    id:            'base-olio-evo',
    canonicalName: 'Olio extravergine di oliva',
    aliases:       ['olio', "olio d'oliva", 'olio di oliva', 'olio extravergine', 'olio extravergine di oliva', 'olio evo'],
    category:      'fats',
    nutritionPer100g: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100, saturatedFatG: 14 },
  },
  {
    id:            'base-zucchero',
    canonicalName: 'Zucchero',
    aliases:       ['zucchero', 'zucchero semolato', 'zucchero bianco', 'zucchero a velo', 'zucchero di canna'],
    category:      'condiments',
    nutritionPer100g: { kcal: 392, proteinG: 0, carbsG: 100, sugarsG: 100, fatG: 0 },
  },
  {
    id:            'base-miele',
    canonicalName: 'Miele',
    aliases:       ['miele', 'miele di acacia', 'miele millefiori'],
    category:      'condiments',
    nutritionPer100g: { kcal: 304, proteinG: 0.3, carbsG: 82, sugarsG: 82, fatG: 0, fiberG: 0.2 },
  },
  {
    id:            'base-sale',
    canonicalName: 'Sale',
    aliases:       ['sale', 'sale fino', 'sale grosso', 'sale marino', 'sale integrale'],
    category:      'condiments',
    nutritionPer100g: { saltG: 100, sodiumMg: 39300 },
  },
  {
    id:            'base-pepe',
    canonicalName: 'Pepe',
    aliases:       ['pepe', 'pepe nero', 'pepe bianco', 'pepe macinato'],
    category:      'condiments',
    nutritionPer100g: { kcal: 251, proteinG: 11, carbsG: 64, fatG: 3.3, fiberG: 26 },
  },
  {
    id:            'base-cannella',
    canonicalName: 'Cannella',
    aliases:       ['cannella', 'cannella in polvere', 'stecca di cannella'],
    category:      'condiments',
    nutritionPer100g: { kcal: 247, proteinG: 4, carbsG: 81, sugarsG: 2.2, fatG: 1.2, fiberG: 53 },
  },
  {
    id:            'base-basilico',
    canonicalName: 'Basilico',
    aliases:       ['basilico', 'basilico fresco', 'foglie di basilico'],
    category:      'condiments',
    nutritionPer100g: { kcal: 23, proteinG: 3.2, carbsG: 2.7, fatG: 0.6, fiberG: 1.6, vitaminCMg: 18 },
  },
  {
    id:            'base-prezzemolo',
    canonicalName: 'Prezzemolo',
    aliases:       ['prezzemolo', 'prezzemolo fresco', 'foglie di prezzemolo'],
    category:      'condiments',
    nutritionPer100g: { kcal: 36, proteinG: 3, carbsG: 6.3, fatG: 0.8, fiberG: 3.3, vitaminCMg: 133 },
  },

  // ── Nuts / seeds ──────────────────────────────────────────────────────────

  {
    id:            'base-mandorle',
    canonicalName: 'Mandorle',
    aliases:       ['mandorle', 'mandorla', 'mandorle pelate', 'mandorle tostate'],
    category:      'nuts',
    nutritionPer100g: { kcal: 579, proteinG: 21, carbsG: 22, sugarsG: 4.4, fatG: 50, saturatedFatG: 3.8, fiberG: 12.5, calciumMg: 264 },
  },
  {
    id:            'base-noci',
    canonicalName: 'Noci',
    aliases:       ['noci', 'noce', 'noci comuni', 'gherigli di noce'],
    category:      'nuts',
    nutritionPer100g: { kcal: 654, proteinG: 15, carbsG: 14, sugarsG: 2.6, fatG: 65, saturatedFatG: 6, fiberG: 6.7 },
  },
  {
    id:            'base-semi-chia',
    canonicalName: 'Semi di chia',
    aliases:       ['semi di chia', 'chia'],
    category:      'nuts',
    nutritionPer100g: { kcal: 486, proteinG: 17, carbsG: 42, sugarsG: 0, fatG: 31, saturatedFatG: 3.3, fiberG: 34, calciumMg: 631 },
  },
  {
    id:            'base-semi-sesamo',
    canonicalName: 'Semi di sesamo',
    aliases:       ['semi di sesamo', 'sesamo', 'sesamo tostato'],
    category:      'nuts',
    nutritionPer100g: { kcal: 573, proteinG: 17, carbsG: 23, sugarsG: 0.3, fatG: 50, saturatedFatG: 7, fiberG: 11.8, calciumMg: 975 },
  },
];
