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
    aiProviderLabel: string
    providerOpenai: string
    providerGemini: string
    geminiModelsHint: string
    geminiKeyHint: string
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
    aiQuestLoading: string
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
    readyUp: string
    unready: string
    readyTag: string
    waitingReady: string
    players: string
    copyCode: string
    copied: string
    copyInviteLink: string
    roomMissingOrClosed: string
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
    questPhotoOnly: string
    questTextOnly: string
    submitNeedPhoto: string
    submitNeedText: string
    photoProofLabel: string
    answerNow: string
    noTimerRound: string
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
    aiProviderLabel: 'AI backend',
    providerOpenai: 'OpenAI-compatible (chat/completions)',
    providerGemini: 'Google Gemini (AI Studio key)',
    geminiModelsHint:
      'Tries Gemini 3.1 Flash Lite first, then Gemini 3 Flash if the request errors (rate limits, etc.).',
    geminiKeyHint: 'Create an API key in Google AI Studio → API keys.',
    apiKey: 'API key',
    apiBase: 'API base URL',
    model: 'Model',
    firebaseJson: 'Firebase config (JSON)',
    firebaseHelp:
      'Optional for online battles. Paste the web app config from Firebase console. Use open Firestore rules only for demos.',
    settingsNote:
      'Keys stay in this browser (localStorage). For production / Play Store, move calls to your backend.',
    soloTitle: 'Solo scoop',
    soloIntro:
      'New or AI quests start a dynamic 3–5 minute countdown based on quest difficulty. Time stops only when you submit to AI; it scores proof and (with the timer) how you used the time.',
    questLabel: 'Quest',
    newQuest: 'Different quest',
    aiQuest: 'AI quest',
    aiQuestLoading: 'Creating your quest…',
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
    readyUp: 'I am ready',
    unready: 'Not ready',
    readyTag: 'Ready',
    waitingReady: 'Everyone must tap ready before the host can start.',
    players: 'Players',
    copyCode: 'Copy code',
    copied: 'Copied',
    copyInviteLink: 'Copy invite link',
    roomMissingOrClosed: 'This room no longer exists or the connection was lost.',
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
    questPhotoOnly: 'Photo round: your proof is the picture only (no written answer).',
    questTextOnly: 'Text round: answer with reasoning or numbers only (no photo).',
    submitNeedPhoto: 'Add a photo before submitting.',
    submitNeedText: 'Write an answer before submitting.',
    photoProofLabel: 'Photo proof',
    answerNow: 'Answer now (no timer)',
    noTimerRound: 'No time limit — submit when ready.',
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
    aiProviderLabel: 'Yapay zeka sağlayıcısı',
    providerOpenai: 'OpenAI uyumlu (chat/completions)',
    providerGemini: 'Google Gemini (AI Studio anahtarı)',
    geminiModelsHint:
      'Önce Gemini 3.1 Flash Lite, hata olursa Gemini 3 Flash (limit vb.) kullanılır.',
    geminiKeyHint: 'Google AI Studio → API keys bölümünden anahtar oluşturun.',
    apiKey: 'API anahtarı',
    apiBase: 'API taban URL',
    model: 'Model',
    firebaseJson: 'Firebase yapılandırması (JSON)',
    firebaseHelp:
      'Çevrimiçi kapışma için isteğe bağlı. Firebase konsolundaki web uygulaması yapılandırmasını yapıştırın. Demoda Firestore kurallarını gevşetebilirsiniz.',
    settingsNote:
      'Anahtarlar bu tarayıcıda kalır (localStorage). Play Store için çağrıları sunucunuza taşıyın.',
    soloTitle: 'Tek başına',
    soloIntro:
      'Yeni veya yapay zeka görevinde görevin zorluğuna göre 3-5 dakikalık geri sayım başlar. Süre yalnızca yapay zekaya gönderdiğinde durur; kanıtı ve (zamanlıysa) süre kullanımını değerlendirir.',
    questLabel: 'Görev',
    newQuest: 'Başka görev',
    aiQuest: 'Yapay zeka görevi',
    aiQuestLoading: 'Görev oluşturuluyor…',
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
    readyUp: 'Hazırım',
    unready: 'Hazır değilim',
    readyTag: 'Hazır',
    waitingReady: 'Sunucunun başlatması için herkes hazır olmalı.',
    players: 'Oyuncular',
    copyCode: 'Kodu kopyala',
    copied: 'Kopyalandı',
    copyInviteLink: 'Davet linkini kopyala',
    roomMissingOrClosed: 'Oda artık yok veya bağlantı koptu.',
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
    questPhotoOnly: 'Fotoğraf turu: kanıt yalnızca fotoğraf (yazılı cevap yok).',
    questTextOnly: 'Metin turu: yalnızca mantık veya sayı ile cevap (fotoğraf yok).',
    submitNeedPhoto: 'Göndermeden önce fotoğraf ekleyin.',
    submitNeedText: 'Göndermeden önce bir cevap yazın.',
    photoProofLabel: 'Fotoğraf kanıtı',
    answerNow: 'Şimdi cevapla (süresiz)',
    noTimerRound: 'Süre sınırı yok — hazır olunca gönder.',
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
    aiProviderLabel: 'KI-Backend',
    providerOpenai: 'OpenAI-kompatibel (chat/completions)',
    providerGemini: 'Google Gemini (AI Studio-Schlüssel)',
    geminiModelsHint:
      'Zuerst Gemini 3.1 Flash Lite, bei Fehler Gemini 3 Flash (z. B. Rate Limits).',
    geminiKeyHint: 'API-Schlüssel in Google AI Studio unter API keys anlegen.',
    apiKey: 'API-Schlüssel',
    apiBase: 'API-Basis-URL',
    model: 'Modell',
    firebaseJson: 'Firebase-Konfiguration (JSON)',
    firebaseHelp:
      'Optional für Online-Duelle. Web-App-Konfiguration aus der Firebase-Konsole einfügen. Für Demos lockere Firestore-Regeln.',
    settingsNote:
      'Schlüssel bleiben im Browser (localStorage). Für den Play Store bitte Backend nutzen.',
    soloTitle: 'Solo',
    soloIntro:
      'Neue oder KI-Aufgaben starten je nach Schwierigkeit einen 3- bis 5-Minuten-Countdown. Die Zeit stoppt erst beim Absenden an die KI; sie bewertet Nachweis und (mit Timer) den Zeitfaktor.',
    questLabel: 'Aufgabe',
    newQuest: 'Andere Aufgabe',
    aiQuest: 'KI-Aufgabe',
    aiQuestLoading: 'Aufgabe wird erstellt…',
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
    readyUp: 'Ich bin bereit',
    unready: 'Nicht bereit',
    readyTag: 'Bereit',
    waitingReady: 'Alle müssen auf bereit stehen, bevor der Host starten kann.',
    players: 'Spieler',
    copyCode: 'Code kopieren',
    copied: 'Kopiert',
    copyInviteLink: 'Einladungslink kopieren',
    roomMissingOrClosed: 'Dieser Raum existiert nicht mehr oder die Verbindung wurde getrennt.',
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
    questPhotoOnly: 'Foto-Runde: Der Nachweis ist nur das Bild (kein Text).',
    questTextOnly: 'Text-Runde: Nur schriftliche Antwort/Denken (kein Foto).',
    submitNeedPhoto: 'Bitte vor dem Absenden ein Foto hinzufügen.',
    submitNeedText: 'Bitte vor dem Absenden eine Antwort schreiben.',
    photoProofLabel: 'Fotonachweis',
    answerNow: 'Jetzt antworten (ohne Timer)',
    noTimerRound: 'Kein Zeitlimit — absenden wenn fertig.',
  },
}
