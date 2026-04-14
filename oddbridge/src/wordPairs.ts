export type WordPair = { a: string; b: string }

/** Curated, culturally neutral prompts — two nouns to bridge in one sentence. */
export const WORD_PAIRS: WordPair[] = [
  { a: 'Thunder', b: 'Toast' },
  { a: 'Library', b: 'Lantern' },
  { a: 'Subway', b: 'Seashell' },
  { a: 'Piano', b: 'Puddle' },
  { a: 'Galaxy', b: 'Glove' },
  { a: 'Velvet', b: 'Voltage' },
  { a: 'Harbor', b: 'Harmonica' },
  { a: 'Mirror', b: 'Motorcycle' },
  { a: 'Cinnamon', b: 'Circuit' },
  { a: 'Glacier', b: 'Guitar' },
  { a: 'Envelope', b: 'Elevator' },
  { a: 'Cactus', b: 'Compass' },
  { a: 'Moonlight', b: 'Microscope' },
  { a: 'Origami', b: 'Orbit' },
  { a: 'Teapot', b: 'Telescope' },
  { a: 'Ribbon', b: 'Rocket' },
  { a: 'Sandwich', b: 'Satellite' },
  { a: 'Helmet', b: 'Honey' },
  { a: 'Icicle', b: 'Ink' },
  { a: 'Jigsaw', b: 'Jellyfish' },
  { a: 'Kettle', b: 'Key' },
  { a: 'Lighthouse', b: 'Lemon' },
  { a: 'Magnet', b: 'Mango' },
  { a: 'Notebook', b: 'Neon' },
  { a: 'Oven', b: 'Oyster' },
  { a: 'Paintbrush', b: 'Parachute' },
  { a: 'Quilt', b: 'Quartz' },
  { a: 'Robot', b: 'Raincoat' },
  { a: 'Stamp', b: 'Stadium' },
  { a: 'Tunnel', b: 'Tambourine' },
  { a: 'Umbrella', b: 'Ukulele' },
  { a: 'Volcano', b: 'Violin' },
  { a: 'Window', b: 'Walnut' },
  { a: 'Yarn', b: 'Yacht' },
  { a: 'Zipper', b: 'Zeppelin' },
  { a: 'Bakery', b: 'Battery' },
  { a: 'Candle', b: 'Calculator' },
  { a: 'Dragon', b: 'Drum' },
  { a: 'Forest', b: 'Fork' },
  { a: 'Garden', b: 'Gear' },
  { a: 'Helicopter', b: 'Hammock' },
  { a: 'Island', b: 'Ice cream' },
  { a: 'Jungle', b: 'Joystick' },
  { a: 'Kitchen', b: 'Kite' },
  { a: 'Ladder', b: 'Lantern' },
  { a: 'Mountain', b: 'Mushroom' },
  { a: 'Notebook', b: 'Noodle' },
  { a: 'Ocean', b: 'Orange' },
  { a: 'Pyramid', b: 'Penguin' },
  { a: 'River', b: 'Radio' },
  { a: 'Spider', b: 'Spaghetti' },
  { a: 'Treasure', b: 'Trampoline' },
  { a: 'Universe', b: 'Urn' },
  { a: 'Village', b: 'Violin' },
  { a: 'Waterfall', b: 'Waffle' },
  { a: 'Xylophone', b: 'X-ray' },
  { a: 'Yogurt', b: 'Yo-yo' },
  { a: 'Zoo', b: 'Zip line' },
  { a: 'Anchor', b: 'Apron' },
  { a: 'Bridge', b: 'Broccoli' },
  { a: 'Crystal', b: 'Crow' },
  { a: 'Diamond', b: 'Dolphin' },
  { a: 'Engine', b: 'Eggplant' },
  { a: 'Feather', b: 'Fountain' },
  { a: 'Giraffe', b: 'Grenade' },
  { a: 'Horizon', b: 'Hedgehog' },
  { a: 'Igloo', b: 'Igneous rock' },
  { a: 'Jacket', b: 'Jupiter' },
  { a: 'Knight', b: 'Knitting' },
  { a: 'Lobster', b: 'Laptop' },
  { a: 'Meteor', b: 'Muffin' },
  { a: 'Narwhal', b: 'Nightlight' },
  { a: 'Octopus', b: 'Odometer' },
  { a: 'Phoenix', b: 'Pickle' },
  { a: 'Quokka', b: 'Question mark' },
]

export function randomPair(exclude?: WordPair | null): WordPair {
  if (WORD_PAIRS.length === 0) return { a: 'Star', b: 'Stone' }
  let pick = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)]!
  if (!exclude) return pick
  let guard = 0
  while (
    pick.a === exclude.a &&
    pick.b === exclude.b &&
    guard++ < 24
  ) {
    pick = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)]!
  }
  return pick
}
