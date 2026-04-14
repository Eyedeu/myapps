import type { Locale } from '../types'
import type { QuestSpec } from '../types'

export const STATIC_QUESTS: Record<Locale, QuestSpec[]> = {
  en: [
    { text: 'Name three textures you can touch within arm’s reach.', preferPhoto: false },
    { text: 'Find something blue, warm-colored, and circular.', preferPhoto: true },
    { text: 'Drink water slowly—count to four on each sip.', preferPhoto: false },
    { text: 'Tidy a small surface (clear exactly five items).', preferPhoto: true },
    { text: 'Stretch your neck side-to-side five times each way.', preferPhoto: false },
    { text: 'Send a one-line kind message to someone you appreciate.', preferPhoto: false },
    { text: 'Look outside and name three moving things.', preferPhoto: true },
    { text: 'Line up three objects so their edges align.', preferPhoto: true },
    { text: 'Write one positive sentence about your room.', preferPhoto: false },
    { text: 'Name five sounds from quietest to loudest around you.', preferPhoto: false },
    { text: 'Adjust one comfort thing: light, chair, or brightness.', preferPhoto: false },
    { text: 'Do ten slow calf raises.', preferPhoto: false },
  ],
  tr: [
    { text: 'Kollarının yettiği yerde üç farklı doku söyle.', preferPhoto: false },
    { text: 'Mavi, sıcak renkli ve daire şeklinde birer şey bul.', preferPhoto: true },
    { text: 'Bir bardak suyu yavaş iç; her yudumda dört say.', preferPhoto: false },
    { text: 'Küçük bir yüzeyi düzenle (tam beş eşya kaldır).', preferPhoto: true },
    { text: 'Boynunu yavaşça sağ-sol esnet; her yöne beş kez.', preferPhoto: false },
    { text: 'Sevdiğin birine tek satırlık nazik mesaj gönder.', preferPhoto: false },
    { text: 'Pencereden bak; hareket eden üç şey say.', preferPhoto: true },
    { text: 'Üç nesneyi kenarları hizalı olacak şekilde diz.', preferPhoto: true },
    { text: 'Odan hakkında tek cümle olumlu yaz.', preferPhoto: false },
    { text: 'Etrafındaki beş sesi sessizden gürültülüye sırala.', preferPhoto: false },
    { text: 'Konfor için bir şey ayarla: ışık, sandalye veya parlaklık.', preferPhoto: false },
    { text: 'Yavaşça on kez parmak ucunda yüksel-alçal.', preferPhoto: false },
  ],
  de: [
    { text: 'Nenne drei Texturen in Reichweite deiner Arme.', preferPhoto: false },
    { text: 'Finde etwas Blaues, Warmfarbenes und Rundes.', preferPhoto: true },
    { text: 'Trinke langsam Wasser—zähle bei jedem Schluck bis vier.', preferPhoto: false },
    { text: 'Räume eine kleine Fläche auf (genau fünf Dinge weg).', preferPhoto: true },
    { text: 'Dehne den Nacken langsam links/rechts je fünfmal.', preferPhoto: false },
    { text: 'Schick jemandem eine einzeilige freundliche Nachricht.', preferPhoto: false },
    { text: 'Schau raus und nenne drei sich bewegende Dinge.', preferPhoto: true },
    { text: 'Ordne drei Dinge so, dass die Kanten fluchten.', preferPhoto: true },
    { text: 'Schreibe einen positiven Satz über dein Zimmer.', preferPhoto: false },
    { text: 'Nenne fünf Geräusche von leise zu laut.', preferPhoto: false },
    { text: 'Stelle eine Komfortsache ein: Licht, Stuhl oder Helligkeit.', preferPhoto: false },
    { text: 'Mach zehn langsame Wadenheben.', preferPhoto: false },
  ],
}

export function randomStaticQuest(locale: Locale, exclude: QuestSpec | null): QuestSpec {
  const list = STATIC_QUESTS[locale] ?? STATIC_QUESTS.en
  if (list.length === 0) return { text: 'Take a slow breath.', preferPhoto: false }
  let pick = list[Math.floor(Math.random() * list.length)]!
  let guard = 0
  while (
    exclude &&
    pick.text === exclude.text &&
    list.length > 1 &&
    guard++ < 32
  ) {
    pick = list[Math.floor(Math.random() * list.length)]!
  }
  return pick
}
