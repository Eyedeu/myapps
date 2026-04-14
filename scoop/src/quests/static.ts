import type { Locale } from '../types'
import type { QuestSpec } from '../types'

/** Short, mostly photo-verifiable tasks so AI scoring stays grounded in evidence. */
export const STATIC_QUESTS: Record<Locale, QuestSpec[]> = {
  en: [
    {
      text: 'In one photo, show three different materials (e.g. wood, plastic, fabric). Label each with one word in your text.',
      preferPhoto: true,
    },
    { text: 'Find something blue, something warm-colored, and something circular; one photo that includes all three.', preferPhoto: true },
    {
      text: 'Place four small objects in a straight line; top-down photo and name each object in order in your text.',
      preferPhoto: true,
    },
    { text: 'Clear exactly five items from one small surface; photograph the cleared area.', preferPhoto: true },
    { text: 'Photograph a clock or phone lock screen showing a time; type that exact time in your text.', preferPhoto: true },
    { text: 'Line up three objects shortest to tallest; photograph them from the side.', preferPhoto: true },
    { text: 'Photograph the shiniest object on your desk or table; name what it is in one short phrase.', preferPhoto: true },
    {
      text: 'Arrange five small round items (coins, buttons, or similar) in a straight line; photo from above.',
      preferPhoto: true,
    },
    {
      text: 'Photograph any printed label or packaging; transcribe one line of text exactly as it appears.',
      preferPhoto: true,
    },
    {
      text: 'Photograph something moving outside a window; describe in one short phrase what is moving.',
      preferPhoto: true,
    },
    {
      text: 'Lay three pens or pencils parallel on a table; top-down photo and write “done” in your text.',
      preferPhoto: true,
    },
    { text: 'Stack exactly three flat objects; photograph from directly above.', preferPhoto: true },
  ],
  tr: [
    {
      text: 'Tek fotoğrafta üç farklı malzeme göster (ör. tahta, plastik, kumaş); metinde her birini tek kelimeyle yaz.',
      preferPhoto: true,
    },
    {
      text: 'Mavi bir şey, sıcak renkli bir şey ve daire şeklinde bir şey bul; üçünü de içeren tek fotoğraf çek.',
      preferPhoto: true,
    },
    {
      text: 'Dört küçük nesneyi düz bir sıra koy; üstten fotoğraf çek ve metinde sırayla ne olduklarını yaz.',
      preferPhoto: true,
    },
    { text: 'Küçük bir yüzeyden tam beş eşyayı kaldır; düzenlenmiş alanın fotoğrafını çek.', preferPhoto: true },
    {
      text: 'Saat veya telefon kilit ekranında görünen saati fotoğrafla; metne saati aynen yaz.',
      preferPhoto: true,
    },
    { text: 'Üç nesneyi en kısadan en uzuna yan yana diz; yandan fotoğraf çek.', preferPhoto: true },
    {
      text: 'Masa veya çalışma üstündeki en parlak nesneyi fotoğrafla; kısaca ne olduğunu yaz.',
      preferPhoto: true,
    },
    {
      text: 'Beş küçük yuvarlak parça (bozuk para, düğme vb.) düz bir çizgide diz; üstten fotoğraf.',
      preferPhoto: true,
    },
    {
      text: 'Üzerinde yazı olan bir etiket/ambalaj fotoğrafla; görünen bir satırı olduğu gibi yaz.',
      preferPhoto: true,
    },
    {
      text: 'Pencereden dışarıda hareket eden bir şeyin fotoğrafını çek; neyin hareket ettiğini kısaca yaz.',
      preferPhoto: true,
    },
    {
      text: 'Üç kalem veya kurşun kalemi masada paralel yatır; üstten fotoğraf ve metinde “tamam” yaz.',
      preferPhoto: true,
    },
    { text: 'Tam üç düz nesneyi üst üste istifle; tam üstten fotoğraf çek.', preferPhoto: true },
  ],
  de: [
    {
      text: 'Zeig drei verschiedene Materialien in einem Foto (z. B. Holz, Plastik, Stoff). Beschrifte jedes mit einem Wort im Text.',
      preferPhoto: true,
    },
    {
      text: 'Finde etwas Blaues, etwas Warmfarbenes und etwas Rundes; ein Foto mit allen dreien.',
      preferPhoto: true,
    },
    {
      text: 'Leg vier kleine Dinge in eine gerade Linie; Foto von oben und benenne sie der Reihe nach im Text.',
      preferPhoto: true,
    },
    { text: 'Räume genau fünf Dinge von einer kleinen Fläche; fotografiere die Fläche danach.', preferPhoto: true },
    {
      text: 'Fotografiere eine Uhr oder ein Handy mit sichtbarer Uhrzeit; schreib die exakte Zeit in den Text.',
      preferPhoto: true,
    },
    { text: 'Stell drei Dinge von kurz nach hoch nebeneinander; fotografiere sie von der Seite.', preferPhoto: true },
    {
      text: 'Fotografiere das glänzendste Ding auf Tisch oder Schreibtisch; schreib kurz, was es ist.',
      preferPhoto: true,
    },
    {
      text: 'Ordne fünf kleine runde Dinge (Münzen, Knöpfe o. Ä.) in einer Linie; Foto von oben.',
      preferPhoto: true,
    },
    {
      text: 'Fotografiere ein Etikett oder Verpackung mit Text; tippe eine Zeile exakt ab, wie gedruckt.',
      preferPhoto: true,
    },
    {
      text: 'Fotografiere draußen etwas Bewegtes durchs Fenster; beschreib in einem kurzen Satz, was sich bewegt.',
      preferPhoto: true,
    },
    {
      text: 'Leg drei Stifte parallel auf den Tisch; Foto von oben und schreib „fertig“ in den Text.',
      preferPhoto: true,
    },
    { text: 'Stapel genau drei flache Dinge; Foto senkrecht von oben.', preferPhoto: true },
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
