import type { Locale } from '../types'

export const STRINGS: Record<
  Locale,
  {
    tagline: string
    homeSolo: string
    homeOnline: string
    homeLocal: string
    homeOnlineHint: string
    homeLocalHint: string
    language: string
    settings: string
    back: string
    save: string
    close: string
    apiKey: string
    apiBase: string
    model: string
    firebaseJson: string
    firebaseHelp: string
    settingsNote: string
    soloTitle: string
    soloIntro: string
    questLabel: string
    newQuest: string
    aiQuest: string
    startTimer: string
    timer: string
    done: string
    yourAnswer: string
    photoOptional: string
    photoRequiredHint: string
    submitAi: string
    analyzing: string
    score: string
    feedback: string
    completed: string
    notCompleted: string
    needApiKey: string
    onlineTitle: string
    createRoom: string
    joinRoom: string
    roomCode: string
    yourName: string
    maxPlayers: string
    waitingLobby: string
    startMatch: string
    players: string
    copyCode: string
    copied: string
    submit: string
    waitingOthers: string
    battleResult: string
    summary: string
    hostTag: string
    winner: string
    tie: string
    you: string
    firebaseMissing: string
    roomNotFound: string
    localTitle: string
    localIntro: string
    player1: string
    player2: string
    nextPlayer: string
    runJudge: string
    errorGeneric: string
    requirePhotoQuest: string
    answerNow: string
  }
> = {
  en: {
    tagline: 'Micro-quests with optional AI scoring — solo, same-device duel, or online room.',
    homeSolo: 'Solo',
    homeOnline: 'Online battle',
    homeLocal: 'Same device (2 players)',
    homeOnlineHint: 'Share a room code (needs Firebase in Settings).',
    homeLocalHint: 'Pass the phone — two submissions, one AI verdict.',
    language: 'Language',
    settings: 'AI & Firebase',
    back: 'Back',
    save: 'Save',
    close: 'Close',
    apiKey: 'API key',
    apiBase: 'API base URL',
    model: 'Model',
    firebaseJson: 'Firebase config (JSON)',
    firebaseHelp:
      'Optional for online battles. Paste the web app config from Firebase console. Use open Firestore rules only for demos.',
    settingsNote:
      'Keys stay in this browser (localStorage). For production / Play Store, move calls to your backend.',
    soloTitle: 'Solo scoop',
    soloIntro: 'Complete the quest, add text and/or a photo, then let AI score it.',
    questLabel: 'Quest',
    newQuest: 'Different quest',
    aiQuest: 'AI quest',
    startTimer: 'Start timer',
    timer: 'Time',
    done: "I'm done",
    yourAnswer: 'Your answer (text)',
    photoOptional: 'Photo (optional)',
    photoRequiredHint: 'This quest works best with a photo.',
    submitAi: 'Submit to AI',
    analyzing: 'Analyzing…',
    score: 'Score',
    feedback: 'Feedback',
    completed: 'Task met',
    notCompleted: 'Not quite',
    needApiKey: 'Add your API key in Settings (OpenAI-compatible endpoint).',
    onlineTitle: 'Online battle',
    createRoom: 'Create room',
    joinRoom: 'Join room',
    roomCode: 'Room code',
    yourName: 'Your name',
    maxPlayers: 'Max players',
    waitingLobby: 'Waiting for players…',
    startMatch: 'Start quest',
    players: 'Players',
    copyCode: 'Copy code',
    copied: 'Copied',
    submit: 'Submit',
    waitingOthers: 'Waiting for other players…',
    battleResult: 'Results',
    summary: 'Summary',
    hostTag: 'Host',
    winner: 'Winner',
    tie: 'Tie',
    you: 'You',
    firebaseMissing: 'Paste Firebase web config JSON in Settings to use online battles.',
    roomNotFound: 'Room not found or closed.',
    localTitle: 'Same-device duel',
    localIntro: 'Two players answer the same quest; AI picks a winner.',
    player1: 'Player 1',
    player2: 'Player 2',
    nextPlayer: 'Lock & hand to Player 2',
    runJudge: 'Ask AI to judge',
    errorGeneric: 'Something went wrong.',
    requirePhotoQuest: 'Photo proof is suggested for this quest.',
    answerNow: 'Answer now (no timer)',
  },
  tr: {
    tagline:
      'İsteğe bağlı yapay zeka puanı ile mikro görevler — tek başına, aynı telefonda düello veya çevrimiçi oda.',
    homeSolo: 'Tek oyuncu',
    homeOnline: 'Çevrimiçi kapışma',
    homeLocal: 'Aynı cihaz (2 kişi)',
    homeOnlineHint: 'Oda kodunu paylaşın (Ayarlar’da Firebase gerekir).',
    homeLocalHint: 'Telefonu devret — iki cevap, tek yapay zeka kararı.',
    language: 'Dil',
    settings: 'Yapay zeka ve Firebase',
    back: 'Geri',
    save: 'Kaydet',
    close: 'Kapat',
    apiKey: 'API anahtarı',
    apiBase: 'API taban URL',
    model: 'Model',
    firebaseJson: 'Firebase yapılandırması (JSON)',
    firebaseHelp:
      'Çevrimiçi kapışma için isteğe bağlı. Firebase konsolundaki web uygulaması yapılandırmasını yapıştırın. Demoda Firestore kurallarını gevşetebilirsiniz.',
    settingsNote:
      'Anahtarlar bu tarayıcıda kalır (localStorage). Play Store için çağrıları sunucunuza taşıyın.',
    soloTitle: 'Tek başına',
    soloIntro: 'Görevi yap, metin ve/veya fotoğraf ekle, yapay zekaya puanlatsın.',
    questLabel: 'Görev',
    newQuest: 'Başka görev',
    aiQuest: 'Yapay zeka görevi',
    startTimer: 'Süreyi başlat',
    timer: 'Süre',
    done: 'Bitti',
    yourAnswer: 'Cevabın (metin)',
    photoOptional: 'Fotoğraf (isteğe bağlı)',
    photoRequiredHint: 'Bu görev için fotoğraf önerilir.',
    submitAi: 'Yapay zekaya gönder',
    analyzing: 'İnceleniyor…',
    score: 'Puan',
    feedback: 'Geri bildirim',
    completed: 'Görev tamam',
    notCompleted: 'Tam değil',
    needApiKey: 'Ayarlar’a OpenAI uyumlu API anahtarı girin.',
    onlineTitle: 'Çevrimiçi kapışma',
    createRoom: 'Oda kur',
    joinRoom: 'Odaya katıl',
    roomCode: 'Oda kodu',
    yourName: 'Adın',
    maxPlayers: 'En fazla oyuncu',
    waitingLobby: 'Oyuncular bekleniyor…',
    startMatch: 'Görevi başlat',
    players: 'Oyuncular',
    copyCode: 'Kodu kopyala',
    copied: 'Kopyalandı',
    submit: 'Gönder',
    waitingOthers: 'Diğer oyuncular bekleniyor…',
    battleResult: 'Sonuç',
    summary: 'Özet',
    hostTag: 'Sunucu',
    winner: 'Kazanan',
    tie: 'Beraberlik',
    you: 'Sen',
    firebaseMissing: 'Çevrimiçi kapışma için Ayarlar’a Firebase web JSON yapılandırması yapıştırın.',
    roomNotFound: 'Oda yok veya kapalı.',
    localTitle: 'Aynı cihaz düellosu',
    localIntro: 'İki oyuncu aynı görevi yapar; yapay zeka kazananı seçer.',
    player1: '1. oyuncu',
    player2: '2. oyuncu',
    nextPlayer: 'Kilitle ve 2. oyuncuya ver',
    runJudge: 'Yapay zekaya sor',
    errorGeneric: 'Bir şeyler ters gitti.',
    requirePhotoQuest: 'Bu görevde fotoğraf kanıtı önerilir.',
    answerNow: 'Şimdi cevapla (süresiz)',
  },
  de: {
    tagline:
      'Mini-Aufgaben mit optionaler KI-Bewertung — solo, am selben Gerät oder online.',
    homeSolo: 'Solo',
    homeOnline: 'Online-Duell',
    homeLocal: 'Ein Gerät (2 Spieler)',
    homeOnlineHint: 'Raumcode teilen (Firebase in den Einstellungen nötig).',
    homeLocalHint: 'Handy weitergeben — zwei Einsendungen, ein KI-Urteil.',
    language: 'Sprache',
    settings: 'KI & Firebase',
    back: 'Zurück',
    save: 'Speichern',
    close: 'Schließen',
    apiKey: 'API-Schlüssel',
    apiBase: 'API-Basis-URL',
    model: 'Modell',
    firebaseJson: 'Firebase-Konfiguration (JSON)',
    firebaseHelp:
      'Optional für Online-Duelle. Web-App-Konfiguration aus der Firebase-Konsole einfügen. Für Demos lockere Firestore-Regeln.',
    settingsNote:
      'Schlüssel bleiben im Browser (localStorage). Für den Play Store bitte Backend nutzen.',
    soloTitle: 'Solo',
    soloIntro: 'Erfülle die Aufgabe, Text und/oder Foto hinzufügen, KI bewertet.',
    questLabel: 'Aufgabe',
    newQuest: 'Andere Aufgabe',
    aiQuest: 'KI-Aufgabe',
    startTimer: 'Timer starten',
    timer: 'Zeit',
    done: 'Fertig',
    yourAnswer: 'Deine Antwort (Text)',
    photoOptional: 'Foto (optional)',
    photoRequiredHint: 'Für diese Aufgabe ist ein Foto sinnvoll.',
    submitAi: 'An KI senden',
    analyzing: 'Analyse…',
    score: 'Punkte',
    feedback: 'Feedback',
    completed: 'Erfüllt',
    notCompleted: 'Noch nicht',
    needApiKey: 'Bitte API-Schlüssel in den Einstellungen hinterlegen (OpenAI-kompatibel).',
    onlineTitle: 'Online-Duell',
    createRoom: 'Raum erstellen',
    joinRoom: 'Raum beitreten',
    roomCode: 'Raumcode',
    yourName: 'Dein Name',
    maxPlayers: 'Max. Spieler',
    waitingLobby: 'Warte auf Spieler…',
    startMatch: 'Aufgabe starten',
    players: 'Spieler',
    copyCode: 'Code kopieren',
    copied: 'Kopiert',
    submit: 'Absenden',
    waitingOthers: 'Warte auf andere…',
    battleResult: 'Ergebnis',
    summary: 'Zusammenfassung',
    hostTag: 'Host',
    winner: 'Gewinner',
    tie: 'Unentschieden',
    you: 'Du',
    firebaseMissing: 'Für Online-Duelle Firebase-Web-JSON in den Einstellungen einfügen.',
    roomNotFound: 'Raum nicht gefunden.',
    localTitle: 'Duell am Gerät',
    localIntro: 'Zwei Spieler, gleiche Aufgabe — die KI entscheidet.',
    player1: 'Spieler 1',
    player2: 'Spieler 2',
    nextPlayer: 'Sperren & an Spieler 2 geben',
    runJudge: 'KI befragen',
    errorGeneric: 'Etwas ist schiefgelaufen.',
    requirePhotoQuest: 'Fotonachweis wird empfohlen.',
    answerNow: 'Jetzt antworten (ohne Timer)',
  },
}
