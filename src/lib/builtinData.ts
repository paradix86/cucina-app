import type { Recipe } from '../types';

interface BuiltinRecipe extends Recipe {
  scaling?: { baseWeightGrams: number; basePieces: number; supportedCuts: string[] };
}

export const BUILTIN_RECIPES: BuiltinRecipe[] = [

  /* ==================== CLASSICHE ==================== */

  {
    id: 'b1', name: 'Pasta al pomodoro', category: 'Primi', bimby: false,
    emoji: '🍝', time: '20 min', servings: '4', source: 'classica',
    ingredients: [ '320g pasta', '400g pomodori pelati', '2 spicchi aglio', 'basilico fresco', 'olio evo', 'sale' ],
    steps: [
      'Porta a ebollizione una pentola di acqua salata e cuoci la pasta.',
      "In una padella scalda un filo di olio con l'aglio, aggiungi i pomodori pelati e cuoci a fuoco medio per 10 min.",
      'Scola la pasta al dente e mantecala nel sugo per 1-2 min.',
      'Aggiungi il basilico fresco e servi subito.',
    ],
    timerMinutes: 10,
  },

  /* ==================== ALAN SIGNATURE ==================== */

  {
    id: 'a1',
    name: 'Pollo shiitake carote e salsa di soia',
    category: 'Secondi',
    bimby: false,
    emoji: '🍗',
    time: '20 min',
    servings: '2',
    source: 'alan',
    ingredients: [
      '300g petto di pollo a straccetti',
      '150g funghi shiitake',
      '2 carote',
      '2 cucchiai salsa di soia',
      '1 cucchiaino semi di sesamo',
      'olio',
      'pepe'
    ],
    steps: [
      'Taglia il pollo a straccetti e le carote a julienne.',
      'In padella scalda un filo di olio e rosola il pollo 5-6 min.',
      'Aggiungi i funghi shiitake e le carote.',
      'Cuoci altri 5-6 min a fuoco medio.',
      'Aggiungi la salsa di soia e mescola bene.',
      'Completa con semi di sesamo e pepe.',
    ],
    timerMinutes: 12,
  },

  {
    id: 'a2',
    name: 'Salmone con riso e salsa yogurt limone',
    category: 'Primi',
    bimby: false,
    emoji: '🐟',
    time: '25 min',
    servings: '2',
    source: 'alan',
    ingredients: [
      '250g riso basmati',
      '2 filetti di salmone',
      '150g yogurt greco',
      'scorza di limone',
      'sale',
      'pepe'
    ],
    steps: [
      'Cuoci il riso in acqua salata.',
      'Cuoci il salmone in padella o al vapore.',
      'Mescola yogurt, scorza di limone, sale e pepe.',
      'Impiatta riso e salmone e aggiungi la salsa sopra.',
    ],
    timerMinutes: 15,
  },

  {
    id: 'a3',
    name: 'Pollo bamboo e funghi stile asiatico',
    category: 'Secondi',
    bimby: false,
    emoji: '🥡',
    time: '20 min',
    servings: '2',
    source: 'alan',
    ingredients: [
      '300g pollo',
      '100g bamboo',
      '150g funghi',
      '2 cucchiai salsa di soia',
      '1 cucchiaio salsa bulgogi (opz.)',
      'olio'
    ],
    steps: [
      'Rosola il pollo in padella con olio.',
      'Aggiungi funghi e bamboo.',
      'Cuoci 5-6 min.',
      'Aggiungi soia e bulgogi.',
      'Mescola e servi caldo.',
    ],
    timerMinutes: 12,
  },

  {
    id: 'a4',
    name: 'Bowl proteica manzo stile asiatico',
    category: 'Primi',
    bimby: false,
    emoji: '🍚',
    time: '25 min',
    servings: '2',
    source: 'alan',
    ingredients: [
      '200g riso',
      '250g manzo macinato',
      '1 cipolla',
      '2 cucchiai salsa di soia',
      'semi di sesamo'
    ],
    steps: [
      'Cuoci il riso.',
      'Rosola cipolla e manzo in padella.',
      'Aggiungi salsa di soia.',
      'Servi sopra il riso con sesamo.',
    ],
    timerMinutes: 15,
  },

  {
    id: 'a5',
    name: 'Bowl pollo avocado e yogurt',
    category: 'Primi',
    bimby: false,
    emoji: '🥗',
    time: '20 min',
    servings: '2',
    source: 'alan',
    ingredients: [
      '200g riso',
      '250g pollo',
      '1 avocado',
      '150g yogurt greco',
      'sale',
      'pepe'
    ],
    steps: [
      'Cuoci il riso.',
      'Cuoci il pollo in padella.',
      'Taglia avocado a fette.',
      'Servi tutto in bowl con yogurt sopra.',
    ],
    timerMinutes: 15,
  },

];

BUILTIN_RECIPES.forEach(recipe => {
  if (!recipe.preparationType) recipe.preparationType = recipe.bimby ? 'bimby' : 'classic';
});