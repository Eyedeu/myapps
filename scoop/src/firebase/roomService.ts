import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
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
  ready: boolean
  text: string
  imageDataUrl: string | null
  submitted: boolean
  submittedAt?: number
}

export interface RoomDoc {
  locale: Locale
  hostPlayerId: string
  maxPlayers: number
  phase: 'lobby' | 'playing' | 'done'
  questText: string
  preferPhoto: boolean
  roundLimitSec?: number
  startedAt?: number
  secondsLeft?: number
  players: Record<string, RoomPlayer>
  judging?: boolean
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
        ready: false,
        text: '',
        imageDataUrl: null,
        submitted: false,
        submittedAt: 0,
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
}): Promise<'ok' | 'full' | 'missing'> {
  const { db, roomId, playerId, name } = args
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
      ready: false,
      text: '',
      imageDataUrl: null,
      submitted: false,
      submittedAt: 0,
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

export async function startRoomGame(args: {
  db: Firestore
  roomId: string
  hostPlayerId: string
  quest: QuestSpec
  roundLimitSec: number
}): Promise<boolean> {
  const { db, roomId, hostPlayerId, quest, roundLimitSec } = args
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
}): Promise<void> {
  const { db, roomId, playerId, text, imageDataUrl } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  await updateDoc(ref, {
    [`players.${playerId}.text`]: text,
    [`players.${playerId}.imageDataUrl`]: imageDataUrl,
    [`players.${playerId}.submitted`]: true,
    [`players.${playerId}.submittedAt`]: Date.now(),
  })
}

export async function lockJudging(args: {
  db: Firestore
  roomId: string
}): Promise<boolean> {
  const { db, roomId } = args
  const ref = doc(db, ROOM_COLLECTION, roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return false
  const data = snap.data() as RoomDoc
  if (data.judging || data.judge) return false
  await updateDoc(ref, { judging: true })
  return true
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
  })
}

export async function releaseJudging(db: Firestore, roomId: string): Promise<void> {
  const ref = doc(db, ROOM_COLLECTION, roomId)
  await updateDoc(ref, { judging: false })
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

export function subscribeRoom(
  db: Firestore,
  roomId: string,
  cb: (doc: RoomDoc | null) => void,
): Unsubscribe {
  const ref = doc(db, ROOM_COLLECTION, roomId)
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      cb(null)
      return
    }
    cb(snap.data() as RoomDoc)
  })
}

export function subscribeLobbyRooms(
  db: Firestore,
  cb: (rooms: LobbyRoomSummary[]) => void,
): Unsubscribe {
  const q = query(collection(db, ROOM_COLLECTION), where('phase', '==', 'lobby'))
  return onSnapshot(q, (snap) => {
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
  })
}
