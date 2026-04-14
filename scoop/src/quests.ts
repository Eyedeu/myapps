/** Short, safe micro-quests for a2–5 minute break (no risky or location-specific tasks). */
export const QUESTS: string[] = [
  'Name three different textures you can touch within arm’s reach.',
  'Find something blue, something warm in color, and something with a circle shape.',
  'Drink a glass of water slowly; count to four on each sip.',
  'Open a window or step outside for one minute and notice one smell.',
  'Tidy a surface smaller than a laptop—clear only five items.',
  'Stretch your neck: slow side-to-side, five times each direction.',
  'Send a one-line “thinking of you” message to someone you like.',
  'Hum a tune you liked as a kid for twenty seconds.',
  'Look out the window and name three moving things (people, cars, leaves…).',
  'Re-stack or line up three books or boxes so the edges align.',
  'Write one sentence describing your room using only positive words.',
  'Find an object that starts with the same letter as your first name.',
  'Do ten slow calf raises while brushing your teeth or waiting.',
  'Pick one small trash item and throw it away mindfully.',
  'Name five sounds you can hear right now, from quietest to loudest.',
  'Adjust one thing for comfort: chair height, light, or phone brightness.',
  'Take three photos of interesting shadows (optional—mental snapshots count).',
  'Organize cables or chargers for two minutes—good enough beats perfect.',
  'List three foods in your kitchen that could become a snack in under a minute.',
  'Stand in a doorway and roll shoulders backward ten times.',
]

export function randomQuestIndex(exclude: number | null): number {
  if (QUESTS.length === 0) return 0
  let i = Math.floor(Math.random() * QUESTS.length)
  let guard = 0
  while (exclude !== null && QUESTS.length > 1 && i === exclude && guard++ < 32) {
    i = Math.floor(Math.random() * QUESTS.length)
  }
  return i
}
