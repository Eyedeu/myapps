import type { Locale } from '../types'
import type { QuestSpec } from '../types'

/**
 * preferPhoto true → solo/battle collect photo only (no text answer).
 * preferPhoto false → text/reasoning only (no photo).
 */
export const STATIC_QUESTS: Record<Locale, QuestSpec[]> = {
  en: [
    { text: 'In one photo, show three different materials (e.g. wood, plastic, fabric).', preferPhoto: true },
    {
      text: 'Find something blue, something warm-colored, and something circular; one photo that includes all three.',
      preferPhoto: true,
    },
    { text: 'Place four small objects in a straight line; photograph from directly above.', preferPhoto: true },
    { text: 'Clear exactly five items from one small surface; photograph the cleared area.', preferPhoto: true },
    { text: 'Photograph a clock or phone lock screen with the time clearly readable.', preferPhoto: true },
    { text: 'Line up three objects shortest to tallest; photograph them from the side.', preferPhoto: true },
    { text: 'Photograph the shiniest object on your desk or table.', preferPhoto: true },
    {
      text: 'Arrange five small round items (coins, buttons, or similar) in a straight line; photo from above.',
      preferPhoto: true,
    },
    { text: 'Photograph any printed label or packaging so the text is readable in the image.', preferPhoto: true },
    { text: 'Photograph something moving outside a window.', preferPhoto: true },
    { text: 'Lay three pens or pencils parallel on a table; photograph from above.', preferPhoto: true },
    { text: 'Stack exactly three flat objects; photograph from directly above.', preferPhoto: true },
    {
      text: 'If every Glorb is a Splip, and every Splip is a Zorb, must every Glorb be a Zorb? Answer yes or no and one short sentence why.',
      preferPhoto: false,
    },
    {
      text: 'Odd one out: chair, table, sofa, spoon — name the odd item and why in one short phrase.',
      preferPhoto: false,
    },
    { text: 'What is 18 + 27? Type only the number.', preferPhoto: false },
    { text: 'Next number in the sequence: 4, 9, 16, 25, ? — type only the number.', preferPhoto: false },
    {
      text: 'Ada, Ben, and Cleo each have a different pet: bird, fish, dog. Ben has the fish. Cleo does not have the dog. Who has the bird? One name only.',
      preferPhoto: false,
    },
    {
      text: 'You walk 6 steps forward, 3 back, then 4 forward. Net steps forward from the start? Type only the number.',
      preferPhoto: false,
    },
    {
      text: 'Three crates are red, green, and blue. The red crate is left of the green one. The blue crate is not on the right. List the order left-to-right as three color names separated by commas.',
      preferPhoto: false,
    },
  ],
  tr: [
    { text: 'Tek fotoğrafta üç farklı malzeme göster (ör. tahta, plastik, kumaş).', preferPhoto: true },
    {
      text: 'Mavi bir şey, sıcak renkli bir şey ve daire şeklinde bir şey bul; üçünü de içeren tek fotoğraf çek.',
      preferPhoto: true,
    },
    { text: 'Dört küçük nesneyi düz bir sıra koy; tam üstten fotoğraf çek.', preferPhoto: true },
    { text: 'Küçük bir yüzeyden tam beş eşyayı kaldır; düzenlenmiş alanın fotoğrafını çek.', preferPhoto: true },
    { text: 'Saat veya telefon kilit ekranında saat net okunacak şekilde fotoğraf çek.', preferPhoto: true },
    { text: 'Üç nesneyi en kısadan en uzuna yan yana diz; yandan fotoğraf çek.', preferPhoto: true },
    { text: 'Masa veya çalışma üstündeki en parlak nesneyi fotoğrafla.', preferPhoto: true },
    {
      text: 'Beş küçük yuvarlak parça (bozuk para, düğme vb.) düz bir çizgide diz; üstten fotoğraf.',
      preferPhoto: true,
    },
    { text: 'Üzerinde yazı olan bir etiket veya ambalajı yazılar okunur şekilde fotoğrafla.', preferPhoto: true },
    { text: 'Pencereden dışarıda hareket eden bir şeyin fotoğrafını çek.', preferPhoto: true },
    { text: 'Üç kalem veya kurşun kalemi masada paralel yatır; üstten fotoğraf çek.', preferPhoto: true },
    { text: 'Tam üç düz nesneyi üst üste istifle; tam üstten fotoğraf çek.', preferPhoto: true },
    {
      text: 'Her Mor bir Çip, her Çip bir Zet ise her Mor mutlaka bir Zet midir? Evet veya hayır ve tek cümle gerekçe.',
      preferPhoto: false,
    },
    {
      text: 'Yabancı olan hangisi: sandalye, koltuk, kanepe, kaşık — tek kısa ifadeyle hangisi ve neden.',
      preferPhoto: false,
    },
    { text: '24 + 19 kaçtır? Sadece sayıyı yaz.', preferPhoto: false },
    { text: 'Dizideki sonraki sayı: 5, 10, 17, 26, ? — sadece sayıyı yaz.', preferPhoto: false },
    {
      text: 'Ada, Ben ve Cleo’nun kuş, balık ve köpekten farklı birer evcil hayvanı var. Ben’in balığı var. Cleo’nun köpeği yok. Kuş kimin? Sadece bir isim.',
      preferPhoto: false,
    },
    {
      text: 'Önce 7 adım ileri, 2 geri, sonra 5 ileri yürüdün. Başlangıca göre net ileri adım? Sadece sayı.',
      preferPhoto: false,
    },
    {
      text: 'Üç kutu kırmızı, yeşil ve mavi. Kırmızı kutu yeşilin solunda. Mavi kutu en sağda değil. Soldan sağa sırayı üç renk adıyla virgülle yaz.',
      preferPhoto: false,
    },
  ],
  de: [
    {
      text: 'Zeig drei verschiedene Materialien in einem Foto (z. B. Holz, Plastik, Stoff).',
      preferPhoto: true,
    },
    {
      text: 'Finde etwas Blaues, etwas Warmfarbenes und etwas Rundes; ein Foto mit allen dreien.',
      preferPhoto: true,
    },
    { text: 'Leg vier kleine Dinge in eine gerade Linie; Foto von oben.', preferPhoto: true },
    { text: 'Räume genau fünf Dinge von einer kleinen Fläche; fotografiere die Fläche danach.', preferPhoto: true },
    {
      text: 'Fotografiere eine Uhr oder ein Handy, auf dem die Uhrzeit gut lesbar ist.',
      preferPhoto: true,
    },
    { text: 'Stell drei Dinge von kurz nach hoch nebeneinander; fotografiere sie von der Seite.', preferPhoto: true },
    { text: 'Fotografiere das glänzendste Ding auf Tisch oder Schreibtisch.', preferPhoto: true },
    {
      text: 'Ordne fünf kleine runde Dinge (Münzen, Knöpfe o. Ä.) in einer Linie; Foto von oben.',
      preferPhoto: true,
    },
    {
      text: 'Fotografiere ein Etikett oder Verpackung so, dass der Text im Bild lesbar ist.',
      preferPhoto: true,
    },
    {
      text: 'Fotografiere draußen etwas Bewegtes durchs Fenster.',
      preferPhoto: true,
    },
    { text: 'Leg drei Stifte parallel auf den Tisch; Foto von oben.', preferPhoto: true },
    { text: 'Stapel genau drei flache Dinge; Foto senkrecht von oben.', preferPhoto: true },
    {
      text: 'Wenn jedes Glorb ein Splip ist und jedes Splip ein Zorb, muss jedes Glorb ein Zorb sein? Antworte mit ja oder nein und einem kurzen Satz warum.',
      preferPhoto: false,
    },
    {
      text: 'Welches passt nicht: Stuhl, Tisch, Sofa, Löffel — nenne das eine und warum in einem kurzen Satz.',
      preferPhoto: false,
    },
    { text: 'Wie viel ist 16 + 29? Nur die Zahl.', preferPhoto: false },
    { text: 'Nächste Zahl in der Folge: 2, 6, 12, 20, ? — nur die Zahl.', preferPhoto: false },
    {
      text: 'Ada, Ben und Cleo haben je ein anderes Haustier: Vogel, Fisch, Hund. Ben hat den Fisch. Cleo hat nicht den Hund. Wer hat den Vogel? Nur ein Name.',
      preferPhoto: false,
    },
    {
      text: 'Du gehst 5 Schritte vor, 4 zurück, dann 6 vor. Netto-Schritte vorwärts vom Start? Nur die Zahl.',
      preferPhoto: false,
    },
    {
      text: 'Drei Kisten sind rot, grün und blau. Die rote Kiste steht links von der grünen. Die blaue Kiste steht nicht rechts. Reihenfolge von links nach rechts als drei Farben, durch Komma getrennt.',
      preferPhoto: false,
    },
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
