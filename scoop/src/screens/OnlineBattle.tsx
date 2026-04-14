import { doc, getDoc } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AiQuestLoadingOverlay } from '../components/AiQuestLoadingOverlay'
import { judgeBattle, generateAiQuest } from '../ai/scoring'
import { getFirestoreFromJson } from '../firebase/init'
import {
  createRoom,
  joinRoom,
  lockJudging,
  releaseJudging,
  ROOM_COLLECTION,
  startRoomGame,
  submitOnline,
  subscribeRoom,
  writeJudge,
  type RoomDoc,
} from '../firebase/roomService'
import { compressImageToDataUrl } from '../lib/image'
import { makeRoomCode, normalizeRoomCode } from '../lib/roomCode'
import {
  buildInviteUrl,
  clearOnlineSession,
  getJoinCodeFromLocation,
  loadOnlineSession,
  saveOnlineSession,
  stripJoinParamsFromUrl,
} from '../lib/roomSession'
import { randomStaticQuest } from '../quests/static'
import { getOrCreatePlayerId } from '../settings/storage'
import { useAppI18n } from '../settings/useAppI18n'
import type { QuestSpec } from '../types'

type UiMode = 'menu' | 'createForm' | 'joinForm' | 'inRoom'

export function OnlineBattle({ onBack }: { onBack: () => void }) {
  const { t, settings, locale } = useAppI18n()
  const db = useMemo(() => getFirestoreFromJson(settings.firebaseJson), [settings.firebaseJson])
  const playerId = useMemo(() => getOrCreatePlayerId(), [])

  const [ui, setUi] = useState<UiMode>('menu')
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(2)
  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [draftQuest, setDraftQuest] = useState<QuestSpec>(() => randomStaticQuest(locale, null))
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiQuestLoading, setAiQuestLoading] = useState(false)
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [roomGone, setRoomGone] = useState(false)
  const recentAiQuestsRef = useRef<string[]>([])

  const leaveToMenu = useCallback(() => {
    clearOnlineSession()
    setRoomId('')
    setRoom(null)
    setUi('menu')
  }, [])

  useEffect(() => {
    const saved = loadOnlineSession()
    if (saved?.roomId) {
      if (!db) {
        clearOnlineSession()
        return
      }
      setRoomId(saved.roomId)
      if (saved.displayName) setName(saved.displayName)
      setUi('inRoom')
      return
    }
    const fromUrl = getJoinCodeFromLocation()
    if (fromUrl && db) {
      setJoinCode(fromUrl)
      setUi('joinForm')
    }
  }, [db])

  useEffect(() => {
    if (!db || !roomId) {
      setRoom(null)
      setRoomGone(false)
      return
    }
    setRoomGone(false)
    let first = true
    return subscribeRoom(db, roomId, (doc) => {
      if (first) {
        first = false
        setRoomGone(doc === null)
      } else if (doc === null) {
        setRoomGone(true)
      } else {
        setRoomGone(false)
      }
      setRoom(doc)
    })
  }, [db, roomId])

  useEffect(() => {
    if (!db || !roomId || !settings.apiKey.trim()) return
    if (!room) return
    if (room.phase !== 'playing') return
    if (room.judging || room.judge) return
    const entries = Object.entries(room.players ?? {})
    if (entries.length < 2) return
    if (!entries.every(([, p]) => p.submitted)) return

    let cancelled = false
    ;(async () => {
      try {
        const gotLock = await lockJudging({ db, roomId })
        if (!gotLock || cancelled) return
        const snap = await getDoc(doc(db, ROOM_COLLECTION, roomId))
        const fresh = snap.data() as RoomDoc | undefined
        if (!fresh) return
        const questObj: QuestSpec = {
          text: fresh.questText,
          preferPhoto: fresh.preferPhoto,
        }
        const players = Object.entries(fresh.players).map(([id, p]) => ({
          id,
          name: p.name,
          text: p.text,
          imageDataUrl: p.imageDataUrl,
        }))
        const judge = await judgeBattle({
          settings,
          locale,
          quest: questObj,
          players,
        })
        if (cancelled) return
        await writeJudge({ db, roomId, judge })
      } catch {
        if (!cancelled && db) {
          await releaseJudging(db, roomId)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [db, roomId, room, settings, locale])

  const handleCreate = useCallback(async () => {
    setErr(null)
    if (!db) {
      setErr(t.firebaseMissing)
      return
    }
    if (!name.trim()) return
    setBusy(true)
    try {
      const code = makeRoomCode(6)
      await createRoom({
        db,
        roomId: code,
        hostPlayerId: playerId,
        hostName: name.trim(),
        locale,
        maxPlayers,
      })
      setRoomId(code)
      saveOnlineSession({
        roomId: code,
        role: 'host',
        displayName: name.trim(),
      })
      setDraftQuest(randomStaticQuest(locale, null))
      setUi('inRoom')
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [db, name, playerId, locale, maxPlayers, t])

  const handleJoin = useCallback(async () => {
    setErr(null)
    if (!db) {
      setErr(t.firebaseMissing)
      return
    }
    const code = normalizeRoomCode(joinCode)
    if (!code || !name.trim()) return
    setBusy(true)
    try {
      const res = await joinRoom({ db, roomId: code, playerId, name: name.trim() })
      if (res === 'missing') setErr(t.roomNotFound)
      else if (res === 'full') setErr(t.errorGeneric)
      else {
        setRoomId(code)
        saveOnlineSession({
          roomId: code,
          role: 'join',
          displayName: name.trim(),
        })
        stripJoinParamsFromUrl()
        setUi('inRoom')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [db, joinCode, name, playerId, t])

  const startMatch = useCallback(async () => {
    if (!db || !room) return
    if (room.hostPlayerId !== playerId) return
    setBusy(true)
    setErr(null)
    try {
      const ok = await startRoomGame({
        db,
        roomId,
        hostPlayerId: playerId,
        quest: draftQuest,
      })
      if (!ok) setErr(t.errorGeneric)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [db, room, playerId, roomId, draftQuest, t])

  const submit = useCallback(async () => {
    if (!db || !roomId) return
    setBusy(true)
    setErr(null)
    try {
      await submitOnline({ db, roomId, playerId, text, imageDataUrl: image })
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [db, roomId, playerId, text, image, t])

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)
      setLinkCopied(false)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setErr(t.errorGeneric)
    }
  }, [roomId, t])

  const copyInviteLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(roomId))
      setLinkCopied(true)
      setCopied(false)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      setErr(t.errorGeneric)
    }
  }, [roomId, t])

  const refreshDraft = useCallback(() => {
    setDraftQuest((q) => randomStaticQuest(locale, q))
  }, [locale])

  const draftAi = useCallback(async () => {
    setErr(null)
    if (!settings.apiKey.trim()) {
      setErr(t.needApiKey)
      return
    }
    setAiQuestLoading(true)
    try {
      const q = await generateAiQuest(settings, locale, {
        avoidTexts: recentAiQuestsRef.current,
      })
      recentAiQuestsRef.current = [q.text, ...recentAiQuestsRef.current].slice(0, 8)
      setDraftQuest(q)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setAiQuestLoading(false)
    }
  }, [settings, locale, t])

  const onPickImage = useCallback(
    async (file: File | null) => {
      if (!file) return
      try {
        setImage(await compressImageToDataUrl(file))
      } catch {
        setErr(t.errorGeneric)
      }
    },
    [t],
  )

  useEffect(() => {
    if (room?.phase === 'playing') {
      setText('')
      setImage(null)
    }
  }, [room?.phase, room?.questText])

  if (ui === 'menu') {
    return (
      <div className="app">
        <header className="header">
          <button type="button" className="linkish" onClick={onBack}>
            ← {t.back}
          </button>
          <h1 className="title">{t.onlineTitle}</h1>
          <p className="lede">{t.homeOnlineHint}</p>
        </header>
        <main className="card">
          {!db && <p className="error">{t.firebaseMissing}</p>}
          <div className="actions column">
            <button type="button" className="btn primary" disabled={!db} onClick={() => setUi('createForm')}>
              {t.createRoom}
            </button>
            <button type="button" className="btn ghost" disabled={!db} onClick={() => setUi('joinForm')}>
              {t.joinRoom}
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (ui === 'createForm') {
    return (
      <div className="app">
        <header className="header">
          <button type="button" className="linkish" onClick={() => setUi('menu')}>
            ← {t.back}
          </button>
          <h1 className="title">{t.createRoom}</h1>
        </header>
        <main className="card">
          <label className="field">
            <span className="field-label">{t.yourName}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">{t.maxPlayers}</span>
            <input
              className="input"
              type="number"
              min={2}
              max={8}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            />
          </label>
          {err && <p className="error">{err}</p>}
          <div className="actions">
            <button type="button" className="btn primary" disabled={busy} onClick={() => void handleCreate()}>
              {t.createRoom}
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (ui === 'joinForm') {
    return (
      <div className="app">
        <header className="header">
          <button
            type="button"
            className="linkish"
            onClick={() => {
              stripJoinParamsFromUrl()
              setUi('menu')
            }}
          >
            ← {t.back}
          </button>
          <h1 className="title">{t.joinRoom}</h1>
        </header>
        <main className="card">
          <label className="field">
            <span className="field-label">{t.roomCode}</span>
            <input className="input" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
          </label>
          <label className="field">
            <span className="field-label">{t.yourName}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {err && <p className="error">{err}</p>}
          <div className="actions">
            <button type="button" className="btn primary" disabled={busy} onClick={() => void handleJoin()}>
              {t.joinRoom}
            </button>
          </div>
        </main>
      </div>
    )
  }

  // inRoom
  if (!room) {
    return (
      <div className="app">
        <header className="header">
          <h1 className="title">{t.onlineTitle}</h1>
        </header>
        <main className="card">
          {roomGone ? (
            <p className="error">{t.roomMissingOrClosed}</p>
          ) : (
            <>
              <p className="lede">{t.waitingLobby}</p>
              <p className="muted small">{roomId}</p>
            </>
          )}
          <div className="actions">
            <button type="button" className="btn ghost" onClick={leaveToMenu}>
              {t.back}
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (room.phase === 'lobby') {
    const isHost = room.hostPlayerId === playerId
    const playerRows = Object.entries(room.players ?? {})
    const lobbyBusy = busy || aiQuestLoading
    return (
      <div className="app">
        <AiQuestLoadingOverlay open={aiQuestLoading} message={t.aiQuestLoading} />
        <header className="header">
          <button type="button" className="linkish" onClick={leaveToMenu}>
            ← {t.back}
          </button>
          <h1 className="title">{t.onlineTitle}</h1>
          <p className="lede">
            {t.roomCode}: <strong>{roomId}</strong>{' '}
            <button type="button" className="linkish" onClick={() => void copyCode()}>
              {copied ? t.copied : t.copyCode}
            </button>{' '}
            <button type="button" className="linkish" onClick={() => void copyInviteLink()}>
              {linkCopied ? t.copied : t.copyInviteLink}
            </button>
          </p>
          <p className="muted small">
            {t.maxPlayers}: {room.maxPlayers} · {t.players}: {playerRows.length}/{room.maxPlayers}
          </p>
        </header>
        <main className="card">
          <p className="quest-label">{t.players}</p>
          <ul className="list">
            {playerRows.map(([id, p]) => (
              <li key={id}>
                {p.name}
                {id === playerId ? ` (${t.you})` : ''}
                {id === room.hostPlayerId ? ` · ${t.hostTag}` : ''}
              </li>
            ))}
          </ul>

          {isHost && (
            <>
              <p className="quest-label">{t.questLabel}</p>
              <p className="quest small">{draftQuest.text}</p>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={refreshDraft} disabled={lobbyBusy}>
                  {t.newQuest}
                </button>
                <button type="button" className="btn ghost" onClick={() => void draftAi()} disabled={lobbyBusy}>
                  {t.aiQuest}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void startMatch()}
                  disabled={lobbyBusy || playerRows.length < 2}
                >
                  {t.startMatch}
                </button>
              </div>
            </>
          )}

          {!isHost && <p className="muted">{t.waitingLobby}</p>}

          {err && <p className="error">{err}</p>}
        </main>
      </div>
    )
  }

  if (room.phase === 'playing') {
    const self = room.players[playerId]
    const submitted = Boolean(self?.submitted)
    const allDone = Object.values(room.players).every((p) => p.submitted)
    return (
      <div className="app">
        <header className="header">
          <h1 className="title">{t.questLabel}</h1>
          <p className="quest">{room.questText}</p>
          {room.preferPhoto && <p className="photo-hint">{t.requirePhotoQuest}</p>}
        </header>
        <main className="card">
          {!submitted ? (
            <>
              <label className="field">
                <span className="field-label">{t.yourAnswer}</span>
                <textarea
                  className="textarea"
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <label className="field">
                <span className="field-label">{t.photoOptional}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
                />
              </label>
              <div className="actions">
                <button type="button" className="btn primary" disabled={busy} onClick={() => void submit()}>
                  {t.submit}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">{allDone ? t.analyzing : t.waitingOthers}</p>
          )}
          {err && <p className="error">{err}</p>}
        </main>
      </div>
    )
  }

  // done
  const j = room.judge
  return (
    <div className="app">
      <header className="header">
        <h1 className="title">{t.battleResult}</h1>
      </header>
      <main className="card">
        {j && (
          <>
            <p className="result-line">
              <strong>{t.summary}:</strong> {j.summary}
            </p>
            <p className="result-line">
              <strong>{t.winner}:</strong>{' '}
              {j.winnerId === 'tie'
                ? t.tie
                : room.players[j.winnerId]?.name ?? j.winnerId}
            </p>
            <div className="split-feedback">
              {Object.entries(room.players).map(([id, p]) => (
                <div key={id}>
                  <strong>{p.name}</strong> — {j.byPlayer[id]?.score ?? '—'}: {j.byPlayer[id]?.feedback}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="actions">
          <button type="button" className="btn primary" onClick={leaveToMenu}>
            {t.back}
          </button>
        </div>
      </main>
    </div>
  )
}
