import { doc, getDoc } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AiQuestLoadingOverlay } from '../components/AiQuestLoadingOverlay'
import { judgeBattle, generateAiQuest, localizeQuestText } from '../ai/scoring'
import { getFirestoreFromJson } from '../firebase/init'
import {
  createRoom,
  joinRoom,
  lockJudging,
  leaveRoomAndCleanup,
  releaseJudging,
  ROOM_COLLECTION,
  setRoomSecondsLeft,
  sweepInactiveRooms,
  subscribeLobbyRooms,
  setPlayerReady,
  startRoomGame,
  submitOnline,
  subscribeRoom,
  touchPlayerPresence,
  writeJudge,
  type LobbyRoomSummary,
  type RoomDoc,
} from '../firebase/roomService'
import { compressImageToDataUrl } from '../lib/image'
import { makeRoomCode, normalizeRoomCode } from '../lib/roomCode'
import { formatRoundTime, getQuestRoundLimitSec, MAX_ROUND_SEC } from '../lib/roundTimer'
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
import type { BattleJudgeResult, QuestSpec } from '../types'
import { STRINGS } from '../i18n/strings'

type UiMode = 'menu' | 'createForm' | 'joinForm' | 'inRoom'

export function OnlineBattle({ onBack }: { onBack: () => void }) {
  const { t, settings, locale } = useAppI18n()
  const { db, error: firestoreInitError } = useMemo(
    () => getFirestoreFromJson(settings.firebaseJson),
    [settings.firebaseJson],
  )
  const playerId = useMemo(() => getOrCreatePlayerId(), [])

  const [ui, setUi] = useState<UiMode>('menu')
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(2)
  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiQuestLoading, setAiQuestLoading] = useState(false)
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [roomGone, setRoomGone] = useState(false)
  const [lobbyRooms, setLobbyRooms] = useState<LobbyRoomSummary[]>([])
  const [statusNow, setStatusNow] = useState(() => Date.now())
  const [analyzingStartedAt, setAnalyzingStartedAt] = useState<number | null>(null)
  const recentAiQuestsRef = useRef<string[]>([])
  const timeoutAutoSubmitTokenRef = useRef('')
  const hostTimerLastSentRef = useRef<number | null>(null)
  const lastStaticQuestRef = useRef<QuestSpec | null>(null)
  const judgingInFlightRef = useRef(false)

  const leaveToMenu = useCallback(() => {
    clearOnlineSession()
    setRoomId('')
    setRoom(null)
    setAnalyzingStartedAt(null)
    setUi('menu')
  }, [])

  const leaveAndMaybeDeleteRoom = useCallback(async () => {
    const canCleanup = Boolean(db && roomId)
    try {
      if (canCleanup) {
        await leaveRoomAndCleanup({
          db: db!,
          roomId,
          playerId,
        })
      }
    } finally {
      leaveToMenu()
    }
  }, [db, roomId, playerId, leaveToMenu])

  const buildForfeitJudge = useCallback(
    (currentRoom: RoomDoc, forfeiterId: string): BattleJudgeResult => {
      const ids = Object.keys(currentRoom.players ?? {})
      const survivors = ids.filter((id) => id !== forfeiterId)
      const winnerId: string | 'tie' = survivors.length > 0 ? survivors[0]! : 'tie'
      const ranking = survivors.concat(forfeiterId)
      const byPlayer: BattleJudgeResult['byPlayer'] = {}
      const feedbackByPlayerLocale: BattleJudgeResult['feedbackByPlayerLocale'] = {}
      const summaryByLocale: BattleJudgeResult['summaryByLocale'] = {
        en: STRINGS.en.forfeitSummary,
        tr: STRINGS.tr.forfeitSummary,
        de: STRINGS.de.forfeitSummary,
      }
      for (const id of ids) {
        const loseByLocale = {
          en: STRINGS.en.forfeitLoseFeedback,
          tr: STRINGS.tr.forfeitLoseFeedback,
          de: STRINGS.de.forfeitLoseFeedback,
        }
        const winByLocale = {
          en: STRINGS.en.forfeitWinFeedback,
          tr: STRINGS.tr.forfeitWinFeedback,
          de: STRINGS.de.forfeitWinFeedback,
        }
        feedbackByPlayerLocale[id] = id === forfeiterId ? loseByLocale : winByLocale
        byPlayer[id] =
          id === forfeiterId
            ? { score: 1, feedback: t.forfeitLoseFeedback }
            : {
                score: id === winnerId ? 9 : 7,
                feedback: t.forfeitWinFeedback,
              }
      }
      return {
        winnerId,
        summary: t.forfeitSummary,
        summaryByLocale,
        ranking,
        byPlayer,
        feedbackByPlayerLocale,
      }
    },
    [t],
  )

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
    if (!db) {
      setLobbyRooms([])
      return
    }
    // Best-effort cleanup for rooms with no active users.
    void sweepInactiveRooms({ db })
    const sweepId = window.setInterval(() => {
      void sweepInactiveRooms({ db })
    }, 60_000)
    const unsub = subscribeLobbyRooms(db, setLobbyRooms)
    return () => {
      window.clearInterval(sweepId)
      unsub()
    }
  }, [db])

  useEffect(() => {
    if (!db || !roomId) return
    const ping = () =>
      touchPlayerPresence({
        db,
        roomId,
        playerId,
      }).catch(() => {})
    ping()
    const id = window.setInterval(ping, 15000)
    return () => window.clearInterval(id)
  }, [db, roomId, playerId])

  useEffect(() => {
    if (!db || !roomId) return
    if (!room) return
    if (room.phase !== 'playing') return
    if (room.judging || room.judge) return
    if (judgingInFlightRef.current) return
    const entries = Object.entries(room.players ?? {})
    if (entries.length < 2) return
    if (!entries.every(([, p]) => p.submitted)) return

    judgingInFlightRef.current = true
    ;(async () => {
      let gotLock = false
      let freshRoom: RoomDoc | undefined
      try {
        gotLock = await lockJudging({ db, roomId, playerId })
        if (!gotLock) return
        const snap = await getDoc(doc(db, ROOM_COLLECTION, roomId))
        freshRoom = snap.data() as RoomDoc | undefined
        if (!freshRoom || freshRoom.phase !== 'playing') return
        const questObj: QuestSpec = {
          text: freshRoom.questByLocale?.[freshRoom.locale] ?? freshRoom.questText,
          preferPhoto: freshRoom.preferPhoto,
        }
        const startAt = freshRoom.startedAt ?? 0
        const players = Object.entries(freshRoom.players).map(([id, p]) => ({
          id,
          name: p.name,
          text: p.text,
          imageDataUrl: p.imageDataUrl,
          elapsedSec:
            startAt > 0 && typeof p.submittedAt === 'number' && p.submittedAt > 0
              ? Math.max(0, Math.floor((p.submittedAt - startAt) / 1000))
              : undefined,
        }))
        const judge = await judgeBattle({
          settings,
          locale,
          quest: questObj,
          players,
        })
        await writeJudge({ db, roomId, judge })
      } catch {
        if (db && gotLock) {
          try {
            const src = freshRoom ?? room
            const ids = Object.keys(src?.players ?? {})
            if (ids.length > 0) {
              const emergencyJudge: BattleJudgeResult = {
                winnerId: 'tie',
                summary: 'Analysis could not be completed. Auto-result applied.',
                summaryByLocale: {
                  en: 'Analysis could not be completed. Auto-result applied.',
                  tr: 'Analiz tamamlanamadı. Otomatik sonuç uygulandı.',
                  de: 'Analyse konnte nicht abgeschlossen werden. Auto-Ergebnis angewendet.',
                },
                ranking: ids,
                byPlayer: Object.fromEntries(
                  ids.map((id) => [id, { score: 5, feedback: '' }]),
                ),
              }
              await writeJudge({ db, roomId, judge: emergencyJudge })
            } else {
              await releaseJudging(db, roomId, playerId).catch(() => {})
            }
          } catch {
            await releaseJudging(db, roomId, playerId).catch(() => {})
          }
        }
      } finally {
        judgingInFlightRef.current = false
      }
    })()
  }, [db, roomId, room, settings, locale, playerId])

  useEffect(() => {
    if (!room || room.phase !== 'playing') {
      setAnalyzingStartedAt(null)
      return
    }
    if (room.judge) {
      setAnalyzingStartedAt(null)
      return
    }
    const allDone = Object.values(room.players ?? {}).every((p) => p.submitted)
    if (!allDone) {
      setAnalyzingStartedAt(null)
      return
    }
    setAnalyzingStartedAt((prev) => prev ?? Date.now())
  }, [room])

  // Watchdog: if judging lock is stale for a long time, release it so someone can retry.
  useEffect(() => {
    if (!db || !roomId || !room) return
    if (room.phase !== 'playing') return
    if (!room.judging || room.judge) return

    const now = Date.now()
    const ageMs = now - (room.judgingAt ?? now)
    const staleAfterMs = 90000
    const waitMs = Math.max(1000, staleAfterMs - ageMs)

    const id = window.setTimeout(() => {
      void (async () => {
        try {
          const snap = await getDoc(doc(db, ROOM_COLLECTION, roomId))
          const fresh = snap.data() as RoomDoc | undefined
          if (!fresh) return
          const freshAgeMs = Date.now() - (fresh.judgingAt ?? Date.now())
          if (fresh.phase === 'playing' && fresh.judging && !fresh.judge && freshAgeMs >= staleAfterMs) {
            await releaseJudging(db, roomId)
          }
        } catch {
          // best-effort watchdog
        }
      })()
    }, waitMs)

    return () => window.clearTimeout(id)
  }, [db, roomId, room])

  const handleCreate = useCallback(async () => {
    setErr(null)
    if (!db) {
      setErr(
        firestoreInitError ? `${t.firebaseMissing} (${firestoreInitError})` : t.firebaseMissing,
      )
      return
    }
    if (!name.trim()) {
      setErr(t.yourName)
      return
    }
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
      setUi('inRoom')
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [db, firestoreInitError, name, playerId, locale, maxPlayers, t])

  const handleJoin = useCallback(async () => {
    setErr(null)
    if (!db) {
      setErr(
        firestoreInitError ? `${t.firebaseMissing} (${firestoreInitError})` : t.firebaseMissing,
      )
      return
    }
    const code = normalizeRoomCode(joinCode)
    if (!code || !name.trim()) {
      if (!name.trim()) setErr(t.yourName)
      return
    }
    setBusy(true)
    try {
      const res = await joinRoom({ db, roomId: code, playerId, name: name.trim(), locale })
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
  }, [db, firestoreInitError, joinCode, name, playerId, t, locale])

  const startMatch = useCallback(async () => {
    if (!db || !room) return
    if (room.hostPlayerId !== playerId) return
    if (!settings.apiKey.trim()) {
      setErr(t.needApiKey)
      return
    }
    setBusy(true)
    setAiQuestLoading(true)
    setErr(null)
    try {
      let quest: QuestSpec
      let questByLocale: Partial<Record<'en' | 'tr' | 'de', string>> | undefined
      try {
        let lastQuestErr: unknown = null
        let generated: QuestSpec | null = null
        for (let i = 0; i < 2; i++) {
          try {
            generated = await generateAiQuest(settings, locale, {
              avoidTexts: recentAiQuestsRef.current,
            })
            break
          } catch (e) {
            lastQuestErr = e
          }
        }
        if (!generated) throw (lastQuestErr ?? new Error('AI quest generation failed'))
        quest = generated
        recentAiQuestsRef.current = [quest.text, ...recentAiQuestsRef.current].slice(0, 8)
        try {
          questByLocale = await localizeQuestText({
            settings,
            sourceLocale: locale,
            quest,
            targetLocales: ['en', 'tr', 'de'],
          })
        } catch {
          questByLocale = {
            en: quest.text,
            tr: quest.text,
            de: quest.text,
          }
        }
      } catch {
        quest = randomStaticQuest(locale, lastStaticQuestRef.current)
        lastStaticQuestRef.current = quest
        questByLocale = {
          en: quest.text,
          tr: quest.text,
          de: quest.text,
        }
        setErr('AI quest unavailable; started with a static quest.')
      }
      const ok = await startRoomGame({
        db,
        roomId,
        hostPlayerId: playerId,
        quest,
        questByLocale,
        roundLimitSec: getQuestRoundLimitSec(quest),
      })
      if (!ok) setErr(t.errorGeneric)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setAiQuestLoading(false)
      setBusy(false)
    }
  }, [db, room, playerId, roomId, t, settings, locale])

  const toggleReady = useCallback(async () => {
    if (!db || !roomId || !room) return
    const self = room.players[playerId]
    if (!self || room.phase !== 'lobby') return
    setBusy(true)
    setErr(null)
    try {
      await setPlayerReady({
        db,
        roomId,
        playerId,
        ready: !self.ready,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [db, roomId, room, playerId, t])

  const submit = useCallback(async () => {
    if (!db || !roomId || !room) return
    const photoTask = room.preferPhoto
    if (photoTask && !image) {
      setErr(t.submitNeedPhoto)
      return
    }
    if (!photoTask && !text.trim()) {
      setErr(t.submitNeedText)
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await submitOnline({
        db,
        roomId,
        playerId,
        text: photoTask ? '' : text,
        imageDataUrl: photoTask ? image : null,
        secondsLeftSeen:
          typeof room.secondsLeft === 'number' ? room.secondsLeft : room.roundLimitSec ?? MAX_ROUND_SEC,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [db, roomId, room, playerId, text, image, t])

  const leaveDuringBattle = useCallback(async () => {
    if (!db || !roomId || !room) {
      leaveToMenu()
      return
    }
    if (room.phase !== 'playing') {
      await leaveAndMaybeDeleteRoom()
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const gotLock = await lockJudging({ db, roomId, playerId })
      if (gotLock) {
        const judge = buildForfeitJudge(room, playerId)
        await writeJudge({ db, roomId, judge })
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
      leaveToMenu()
    }
  }, [db, roomId, room, playerId, t, leaveToMenu, leaveAndMaybeDeleteRoom, buildForfeitJudge])

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
      setErr(null)
    }
  }, [room?.phase, room?.questText])

  useEffect(() => {
    if (!db || !room || !roomId) return
    if (room.phase !== 'playing') return
    if (room.hostPlayerId !== playerId) return
    const everyoneSubmitted = Object.values(room.players ?? {}).every((p) => p.submitted)
    if (everyoneSubmitted) return
    const limitSec = room.roundLimitSec ?? MAX_ROUND_SEC
    const startedAt = room.startedAt ?? 0
    if (startedAt <= 0) return
    const tick = () => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      const nextLeft = Math.max(0, limitSec - elapsedSec)
      if (hostTimerLastSentRef.current === nextLeft) return
      hostTimerLastSentRef.current = nextLeft
      void setRoomSecondsLeft({
        db,
        roomId,
        hostPlayerId: playerId,
        secondsLeft: nextLeft,
      }).catch(() => {})
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [db, room, roomId, playerId])

  useEffect(() => {
    if (room?.phase !== 'playing' || !roomId) {
      timeoutAutoSubmitTokenRef.current = ''
      return
    }
    timeoutAutoSubmitTokenRef.current = `${roomId}:${room.startedAt ?? 0}`
  }, [room?.phase, room?.startedAt, roomId])

  useEffect(() => {
    if (!db || !room || room.phase !== 'playing' || !roomId) return
    const self = room.players[playerId]
    if (!self || self.submitted) return
    const limitSec = room.roundLimitSec ?? MAX_ROUND_SEC
    const startedAt = room.startedAt ?? 0
    if (startedAt <= 0) return
    const secondsLeft = Math.max(
      0,
      typeof room.secondsLeft === 'number' ? room.secondsLeft : limitSec,
    )
    if (secondsLeft > 0) return

    const token = `${roomId}:${startedAt}:${playerId}`
    if (timeoutAutoSubmitTokenRef.current === token) return
    timeoutAutoSubmitTokenRef.current = token

    void submitOnline({
      db,
      roomId,
      playerId,
      text: room.preferPhoto ? '' : (text.trim() || ''),
      imageDataUrl: room.preferPhoto ? image : null,
      secondsLeftSeen: secondsLeft,
    }).catch(() => {
      setErr(t.errorGeneric)
    })
  }, [db, room, roomId, playerId, text, image, t])

  // Safety poll: if snapshot listener misses an update, catch it via direct read.
  const selfSubmitted = room?.phase === 'playing' && Boolean(room?.players?.[playerId]?.submitted)
  useEffect(() => {
    if (!db || !roomId || !selfSubmitted) return
    const poll = () => {
      void (async () => {
        try {
          const snap = await getDoc(doc(db, ROOM_COLLECTION, roomId))
          if (!snap.exists()) {
            setRoom(null)
            setRoomGone(true)
            return
          }
          const fresh = snap.data() as RoomDoc
          if (fresh.phase !== 'playing' || fresh.judge) {
            setRoom(fresh)
          }
        } catch { /* best effort */ }
      })()
    }
    const id = window.setInterval(poll, 4000)
    return () => window.clearInterval(id)
  }, [db, roomId, selfSubmitted, playerId])

  useEffect(() => {
    if (room?.phase !== 'playing' || room?.judge || !analyzingStartedAt) return
    const id = window.setInterval(() => setStatusNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [room?.phase, room?.judge, analyzingStartedAt])

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
          {!db && (
            <>
              <p className="error">{t.firebaseMissing}</p>
              {firestoreInitError ? (
                <p className="error small" style={{ wordBreak: 'break-word' }}>
                  {firestoreInitError}
                </p>
              ) : null}
            </>
          )}
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
          <p className="quest-label">{t.openRooms}</p>
          {lobbyRooms.length === 0 ? (
            <p className="muted small">{t.noOpenRooms}</p>
          ) : (
            <ul className="list">
              {lobbyRooms.map((r) => (
                <li key={r.roomId}>
                  <strong>{r.roomId}</strong> · {r.hostName} · {r.players}/{r.maxPlayers}{' '}
                  <button type="button" className="linkish inline-link" onClick={() => setJoinCode(r.roomId)}>
                    {t.useRoom}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
            <button type="button" className="btn ghost" onClick={() => void leaveAndMaybeDeleteRoom()}>
              {t.back}
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (room.phase === 'lobby') {
    const isHost = room.hostPlayerId === playerId
    const self = room.players[playerId]
    const playerRows = Object.entries(room.players ?? {})
    const allReady = playerRows.length >= 2 && playerRows.every(([, p]) => p.ready)
    const lobbyBusy = busy || aiQuestLoading
    return (
      <div className="app">
        <AiQuestLoadingOverlay open={aiQuestLoading} message={t.aiQuestLoading} />
        <header className="header">
          <button type="button" className="linkish" onClick={() => void leaveAndMaybeDeleteRoom()}>
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
                {p.ready ? ` · ${t.readyTag}` : ''}
              </li>
            ))}
          </ul>

          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => void toggleReady()} disabled={lobbyBusy || !self}>
              {self?.ready ? t.unready : t.readyUp}
            </button>
          </div>
          {!allReady && <p className="muted small">{t.waitingReady}</p>}

          {isHost && (
            <>
              <p className="muted small">{t.onlineAiStartHint}</p>
              <div className="actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void startMatch()}
                  disabled={lobbyBusy || !allReady}
                >
                  {t.startMatch} (3-5 dk)
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
    const localizedQuest = room.questByLocale?.[locale] ?? room.questText
    const self = room.players[playerId]
    const submitted = Boolean(self?.submitted)
    const allDone = Object.values(room.players).every((p) => p.submitted)
    const limitSec = room.roundLimitSec ?? MAX_ROUND_SEC
    const secondsLeft = Math.max(
      0,
      typeof room.secondsLeft === 'number' ? room.secondsLeft : limitSec,
    )
    const submittedRemaining =
      self && typeof self.submittedAtRemainingSec === 'number'
        ? Math.max(0, self.submittedAtRemainingSec)
        : null
    const judgingElapsedSec =
      analyzingStartedAt
        ? Math.max(0, Math.floor((statusNow - analyzingStartedAt) / 1000))
        : 0
    return (
      <div className="app">
        <header className="header">
          <h1 className="title">{t.questLabel}</h1>
          <p className="quest">{localizedQuest}</p>
          <div className="timer" aria-label={t.timer}>
            <span className={secondsLeft <= 60 ? 'warn' : ''}>{formatRoundTime(secondsLeft)}</span>
          </div>
          {room.preferPhoto ? (
            <p className="photo-hint">{t.questPhotoOnly}</p>
          ) : (
            <p className="muted small">{t.questTextOnly}</p>
          )}
        </header>
        <main className="card">
          {!submitted ? (
            <>
              {room.preferPhoto ? (
                <label className="field">
                  <span className="field-label">{t.photoProofLabel}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
                  />
                </label>
              ) : (
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
              )}
              <div className="actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy || secondsLeft <= 0}
                  onClick={() => void submit()}
                >
                  {t.submit}
                </button>
                <button type="button" className="btn ghost" disabled={busy} onClick={() => void leaveDuringBattle()}>
                  {t.leaveAndLose}
                </button>
              </div>
            </>
          ) : (
            <>
              {submittedRemaining !== null && (
                <p className="ok small">
                  {t.submittedAtSecond.replace('{time}', formatRoundTime(submittedRemaining))}
                </p>
              )}
              <p className="muted">{allDone ? t.analyzing : t.waitingOthers}</p>
              {allDone && (
                <div className="analysis-status">
                  <p className="muted small">{t.analyzingDetail}</p>
                  <p className="muted small">{t.analyzingElapsed.replace('{time}', formatRoundTime(judgingElapsedSec))}</p>
                </div>
              )}
              <div className="actions">
                <button type="button" className="btn ghost" disabled={busy} onClick={() => void leaveDuringBattle()}>
                  {t.leaveAndLose}
                </button>
              </div>
            </>
          )}
          {err && <p className="error">{err}</p>}
        </main>
      </div>
    )
  }

  // done
  const j = room.judge
  const localizedSummary = j?.summaryByLocale?.[locale] ?? j?.summary
  return (
    <div className="app">
      <header className="header">
        <h1 className="title">{t.battleResult}</h1>
      </header>
      <main className="card">
        {j && (
          <>
            <p className="result-line">
              <strong>{t.summary}:</strong> {localizedSummary}
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
                  <strong>{p.name}</strong> — {j.byPlayer[id]?.score ?? '—'}:{' '}
                  {j.feedbackByPlayerLocale?.[id]?.[locale] ?? j.byPlayer[id]?.feedback}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => void leaveAndMaybeDeleteRoom()}>
            {t.back}
          </button>
        </div>
      </main>
    </div>
  )
}
