# Scoop

Micro-quests with **OpenAI-compatible** APIs (text + optional image) and optional **Firebase Firestore** for online rooms (2–8 players).

## Modes

- **Solo:** static or AI-generated quest → text/photo → AI score & feedback (EN/TR/DE UI).
- **Same device:** two players, one phone, AI picks a winner.
- **Online battle:** host creates a room code; players join; host starts a quest; everyone submits; AI judges when all have submitted.

## Setup

1. **AI:** open **AI & Firebase** in the app. Use an OpenAI-compatible `chat/completions` endpoint (default `https://api.openai.com/v1`) and a model that supports **JSON mode** + **vision** for images (e.g. `gpt-4o-mini`). Keys are stored in `localStorage` only.

2. **Online mode:** create a Firebase project → enable **Firestore** → add a web app → paste the **firebaseConfig** JSON into settings. For demos you can use permissive rules (not for production):

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scoopRooms_v1/{id} {
      allow read, write: if true;
    }
  }
}
```

3. **GitHub Pages:** the monorepo workflow builds with  
 `npm run build -- --base=/<repo>/scoop/`.

## Local dev

```bash
npm install
npm run dev
```

## Security note

Browser-stored API keys are fine for personal demos only. For **Google Play**, proxy AI (and optionally matchmaking) through your own backend.
