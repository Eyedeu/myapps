import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import type { BattleJudgeResult, Locale, QuestSpec } from '../types'

export const ROOM_COLLECTION = 'scoopRooms_v1'

export interface RoomPlayer {
  name: string
  locale: Locale
  lastSeenAt?: number
  ready: boolean
  text: string
  imageDataUrl: string | null
  submitted: boolean
  submittedAt?: number
  submittedAtRemainingSec?: number
}

export interface RoomDoc {
  locale: Locale
  hostPlayerId: string
  maxPlayers: number
  phase: 'lobby' | 'playing' | 'done'
  questText: string
  questByLocale?: Partial<Record<Locale, string>>
  preferPhoto: boolean
  roundLimitSec?: number
  startedAt?: number
  secondsLeft?: number
  players: Record<string, RoomPlayer>
  judging?: boolean
  judgingAt?: number
  judgingBy?: string
  judge?: BattleJudgeResult
  createdAt: number
}

export interface LobbyRoomSummary {
  roomId: string
  hostName: string
  players: number
  maxPlayers: number
  createdAt: number
}

export async function createRoom(args: {
  db: Firestore
  roomId: string
  hostPlayerId: string
  hostName: string
  locale: Locale
  maxPlayers: number
}): Promise<void> {
  const { db, roomId, hostPlayerId, hostName, locale, maxPlayers } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  const payload: RoomDoc = {
    locale,
    hostPlayerId,
    maxPlayers: Math.min(8, Math.max(2, maxPlayers)),
    phase: 'lobby',
    questText: '',
    preferPhoto: false,
    players: {
      [hostPlayerId]: {
        name: hostName,
        locale,
        lastSeenAt: Date.now(),
        ready: false,
        text: '',
        imageDataUrl: null,
        submitted: false,
        submittedAt: 0,
        submittedAtRemainingSec: 0,
      },
    },
    roundLimitSec: 300,
    startedAt: 0,
    secondsLeft: 300,
    createdAt: Date.now(),
  }
  await setDoc(ref, payload)
}

export async function joinRoom(args: {
  db: Firestore
  roomId: string
  playerId: string
  name: string
  locale: Locale
}): Promise<'ok' | 'full' | 'missing'> {
  const { db, roomId, playerId, name, locale } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return 'missing'
  const data = snap.data() as RoomDoc
  if (data.phase !== 'lobby') return 'full'
  const count = Object.keys(data.players ?? {}).length
  if (count >= data.maxPlayers) return 'full'
  if (data.players[playerId]) return 'ok'
  await updateDoc(ref, {
    [`players.${playerId}`]: {
      name,
      locale,
      lastSeenAt: Date.now(),
      ready: false,
      text: '',
      imageDataUrl: null,
      submitted: false,
      submittedAt: 0,
      submittedAtRemainingSec: 0,
    },
  })
  return 'ok'
}

export async function setPlayerReady(args: {
  db: Firestore
  roomId: string
  playerId: string
  ready: boolean
}): Promise<void> {
  const { db, roomId, playerId, ready } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  await updateDoc(ref, { [`players.${playerId}.ready`]: ready })
}

export async function touchPlayerPresence(args: {
  db: Firestore
  roomId: string
  playerId: string
}): Promise<void> {
  const { db, roomId, playerId } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  await updateDoc(ref, {
    [`players.${playerId}.lastSeenAt`]: Date.now(),
  })
}

export async function startRoomGame(args: {
  db: Firestore
  roomId: string
  hostPlayerId: string
  quest: QuestSpec
  questByLocale?: Partial<Record<Locale, string>>
  roundLimitSec: number
}): Promise<boolean> {
  const { db, roomId, hostPlayerId, quest, questByLocale, roundLimitSec } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return false
  const data = snap.data() as RoomDoc
  if (data.hostPlayerId !== hostPlayerId) return false
  const ids = Object.keys(data.players ?? {})
  if (ids.length < 2) return false
  const everyoneReady = ids.every((id) => data.players?.[id]?.ready)
  if (!everyoneReady) return false
  const updates: Record<string, unknown> = {
    phase: 'playing',
    questText: quest.text,
    questByLocale: questByLocale ?? { [data.locale]: quest.text },
    preferPhoto: quest.preferPhoto,
    roundLimitSec: Math.min(300, Math.max(180, Math.floor(roundLimitSec))),
    startedAt: Date.now(),
    secondsLeft: Math.min(300, Math.max(180, Math.floor(roundLimitSec))),
    judging: false,
    judge: deleteField(),
  }
  for (const id of ids) {
    updates[`players.${id}.ready`] = false
    updates[`players.${id}.text`] = ''
    updates[`players.${id}.imageDataUrl`] = null
    updates[`players.${id}.submitted`] = false
    updates[`players.${id}.submittedAt`] = 0
    updates[`players.${id}.submittedAtRemainingSec`] = 0
  }
  await updateDoc(ref, updates)
  return true
}

export async function submitOnline(args: {
  db: Firestore
  roomId: string
  playerId: string
  text: string
  imageDataUrl: string | null
  secondsLeftSeen: number
}): Promise<void> {
  const { db, roomId, playerId, text, imageDataUrl, secondsLeftSeen } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  await updateDoc(ref, {
    [`players.${playerId}.text`]: text,
    [`players.${playerId}.imageDataUrl`]: imageDataUrl,
    [`players.${playerId}.submitted`]: true,
    [`players.${playerId}.submittedAt`]: Date.now(),
    [`players.${playerId}.submittedAtRemainingSec`]: Math.max(0, Math.floor(secondsLeftSeen)),
  })
}

export async function lockJudging(args: {
  db: Firestore
  roomId: string
  playerId: string
}): Promise<boolean> {
  const { db, roomId, playerId } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  const locked = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return false
    const data = snap.data() as RoomDoc
    if (data.phase !== 'playing') return false
    if (data.judging || data.judge) return false
    tx.update(ref, { judging: true, judgingAt: Date.now(), judgingBy: playerId })
    return true
  })
  return Boolean(locked)
}

export async function writeJudge(args: {
  db: Firestore
  roomId: string
  judge: BattleJudgeResult
}): Promise<void> {
  const { db, roomId, judge } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  await updateDoc(ref, {
    judge,
    phase: 'done',
    judging: false,
    judgingAt: 0,
    judgingBy: '',
  })
}

export async function releaseJudging(
  db: Firestore,
  roomId: string,
  expectedPlayerId?: string,
): Promise<void> {
  const ref = doc(db, ROOM_COLLECTION, roomId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const data = snap.data() as RoomDoc
    if (!data.judging) return
    if (expectedPlayerId && data.judgingBy && data.judgingBy !== expectedPlayerId) return
    tx.update(ref, { judging: false, judgingAt: 0, judgingBy: '' })
  })
}

export async function setRoomSecondsLeft(args: {
  db: Firestore
  roomId: string
  hostPlayerId: string
  secondsLeft: number
}): Promise<boolean> {
  const { db, roomId, hostPlayerId, secondsLeft } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return false
  const data = snap.data() as RoomDoc
  if (data.hostPlayerId !== hostPlayerId) return false
  if (data.phase !== 'playing') return false
  await updateDoc(ref, { secondsLeft: Math.max(0, Math.floor(secondsLeft)) })
  return true
}

export async function deleteRoom(args: { db: Firestore; roomId: string; hostPlayerId: string }): Promise<boolean> {
  const { db, roomId, hostPlayerId } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return true
  const data = snap.data() as RoomDoc
  if (data.hostPlayerId !== hostPlayerId) return false
  await deleteDoc(ref)
  return true
}

export async function leaveRoomAndCleanup(args: {
  db: Firestore
  roomId: string
  playerId: string
}): Promise<void> {
  const { db, roomId, playerId } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data() as RoomDoc
  const players = { ...(data.players ?? {}) }
  if (!players[playerId]) return

  delete players[playerId]
  const remainingIds = Object.keys(players)

  // Delete room only when nobody remains.
  if (remainingIds.length === 0) {
    await deleteDoc(ref)
    return
  }

  const updates: Record<string, unknown> = {
    [`players.${playerId}`]: deleteField(),
  }

  // If host leaves but room still has enough users, transfer host to first remaining player.
  if (data.hostPlayerId === playerId) {
    updates.hostPlayerId = remainingIds[0]!
  }

  await updateDoc(ref, updates)
}

export async function sweepInactiveRooms(args: {
  db: Firestore
  lobbyStaleMs?: number
  playingStaleMs?: number
}): Promise<void> {
  const { db, lobbyStaleMs = 120_000, playingStaleMs = 300_000 } = args
  const now = Date.now()
  const snap = await getDocs(collection(db, ROOM_COLLECTION))

  for (const d of snap.docs) {
    const data = d.data() as RoomDoc
    const players = data.players ?? {}
    const allIds = Object.keys(players)

    if (allIds.length === 0) {
      await deleteDoc(doc(db, ROOM_COLLECTION, d.id))
      continue
    }

    const staleMs = data.phase === 'playing' ? playingStaleMs : lobbyStaleMs
    const activeIds = allIds.filter((id) => now - (players[id]?.lastSeenAt ?? 0) < staleMs)
    const staleIds = allIds.filter((id) => !activeIds.includes(id))

    if (activeIds.length === 0) {
      await deleteDoc(doc(db, ROOM_COLLECTION, d.id))
      continue
    }

    if (staleIds.length > 0) {
      const ref = doc(db, ROOM_COLLECTION, d.id)
      const updates: Record<string, unknown> = {}
      for (const id of staleIds) {
        updates[`players.${id}`] = deleteField()
      }

      if (activeIds.length === 1 && data.phase === 'playing' && !data.judge) {
        const winnerId = activeIds[0]!
        const winnerLocale = players[winnerId]?.locale ?? data.locale
        const loseFeedbackByLocale = {
          en: 'You became inactive during the round and lost by forfeit.',
          tr: 'Tur sirasinda baglanti koptugu icin hukmen kaybettin.',
          de: 'Du warst waehrend der Runde inaktiv und hast kampflos verloren.',
        } as const
        const winFeedbackByLocale = {
          en: 'Opponent became inactive during the round. You win by forfeit.',
          tr: 'Rakip tur sirasinda baglantisini kaybetti. Hukmen kazandin.',
          de: 'Der Gegner war waehrend der Runde inaktiv. Du gewinnst kampflos.',
        } as const
        const summaryByLocale = {
          en: 'Round ended because one side became inactive.',
          tr: 'Taraflardan biri inaktif kaldigi icin tur sonlandirildi.',
          de: 'Die Runde wurde beendet, weil eine Seite inaktiv war.',
        } as const

        const byPlayer: BattleJudgeResult['byPlayer'] = {}
        const feedbackByPlayerLocale: NonNullable<BattleJudgeResult['feedbackByPlayerLocale']> = {}
        for (const id of allIds) {
          const isWinner = id === winnerId
          byPlayer[id] = {
            score: isWinner ? 9 : 1,
            feedback: isWinner ? winFeedbackByLocale[winnerLocale] : loseFeedbackByLocale[winnerLocale],
          }
          feedbackByPlayerLocale[id] = isWinner ? { ...winFeedbackByLocale } : { ...loseFeedbackByLocale }
        }

        updates.judge = {
          winnerId,
          summary: summaryByLocale[winnerLocale],
          summaryByLocale: { ...summaryByLocale },
          ranking: [winnerId, ...allIds.filter((id) => id !== winnerId)],
          byPlayer,
          feedbackByPlayerLocale,
        } satisfies BattleJudgeResult
        updates.phase = 'done'
        updates.judging = false
        updates.judgingAt = 0
      } else if (data.hostPlayerId && staleIds.includes(data.hostPlayerId)) {
        updates.hostPlayerId = activeIds[0]!
      }

      await updateDoc(ref, updates)
    }
  }
}

export function subscribeRoom(
  db: Firestore,
  roomId: string,
  cb: (doc: RoomDoc | null) => void,
): Unsubscribe {
  const ref = doc(db, ROOM_COLLECTION, roomId)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let unsub: Unsubscribe = () => {}
  let dead = false

  const attach = () => {
    try {
      unsub = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            cb(null)
            return
          }
          cb(snap.data() as RoomDoc)
        },
        () => {
          if (dead) return
          window.setTimeout(() => {
            if (!dead) attach()
          }, 3000)
        },
      )
    } catch {
      if (!dead) {
        window.setTimeout(() => {
          if (!dead) attach()
        }, 3000)
      }
    }
  }

  attach()
  return () => {
    dead = true
    unsub()
  }
}

export function subscribeLobbyRooms(
  db: Firestore,
  cb: (rooms: LobbyRoomSummary[]) => void,
): Unsubscribe {
  const q = query(collection(db, ROOM_COLLECTION), where('phase', '==', 'lobby'))
  return onSnapshot(
    q,
    (snap) => {
      const rooms = snap.docs
        .map((d) => {
          const data = d.data() as RoomDoc
          const playerRows = Object.values(data.players ?? {})
          const playerCount = playerRows.length
          if (playerCount < 1 || playerCount >= data.maxPlayers) return null
          return {
            roomId: d.id,
            hostName: data.players?.[data.hostPlayerId]?.name ?? 'Host',
            players: playerCount,
            maxPlayers: data.maxPlayers,
            createdAt: data.createdAt ?? 0,
          } as LobbyRoomSummary
        })
        .filter(Boolean)
        .sort((a, b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0)) as LobbyRoomSummary[]
      cb(rooms)
    },
    () => { /* ignore lobby query errors */ },
  )
}
