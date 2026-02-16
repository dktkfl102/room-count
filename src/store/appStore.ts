import { create } from "zustand"
import { persist } from "zustand/middleware"
import { formatNumberWithComma } from "@/lib/number"

export type RoomStatus = "waiting" | "in_progress"

type Usage = {
  time: number
  beer: number
  soju: number
  helper: number
  memo: string
  cashAmount: number
  cardAmount: number
}

type Room = {
  id: string
  name: string
  status: RoomStatus
  startTime: string | null
  endTime: string | null
}

type Prices = {
  time: number
  drink: number
  liquor: number
  helper: number
}

export type BusinessSession = {
  id: string
  startTime: string
  endTime: string | null
}

export type SaleRecord = {
  id: string
  roomId: string
  roomName: string
  startTime: string
  endTime: string
  total: number
  cashAmount: number
  cardAmount: number
  memo: string
  settledAt: string
  businessSessionId: string | null
}

type AppState = {
  rooms: Room[]
  selectedRoomId: string
  prices: Prices
  usageByRoom: Record<string, Usage>
  businessSessions: BusinessSession[]
  activeBusinessSessionId: string | null
  salesHistory: SaleRecord[]
  setSelectedRoom: (roomId: string) => void
  setPrices: (prices: Prices) => void
  startBusinessSession: () => void
  endBusinessSession: () => void
  setRoomStatus: (roomId: string, status: RoomStatus) => void
  addRoom: () => void
  renameRoom: (roomId: string, name: string) => void
  removeRoom: (roomId: string) => void
  incrementUsage: (roomId: string, type: "time" | "beer" | "soju" | "helper") => void
  setMemo: (roomId: string, memo: string) => void
  setPaymentAmount: (roomId: string, type: "cashAmount" | "cardAmount", amount: number) => void
  resetUsage: (roomId: string) => void
  completeRoom: (roomId: string) => void
}

const DEFAULT_ROOMS: Room[] = [
  { id: "room-1", name: "1번방", status: "waiting", startTime: null, endTime: null },
  { id: "room-2", name: "2번방", status: "waiting", startTime: null, endTime: null },
  { id: "room-3", name: "3번방", status: "waiting", startTime: null, endTime: null },
  { id: "room-4", name: "4번방", status: "waiting", startTime: null, endTime: null },
]

const emptyUsage = (): Usage => ({
  time: 0,
  beer: 0,
  soju: 0,
  helper: 0,
  memo: "",
  cashAmount: 0,
  cardAmount: 0,
})

const createInitialUsage = () =>
  DEFAULT_ROOMS.reduce<Record<string, Usage>>((acc, room) => {
    acc[room.id] = emptyUsage()
    return acc
  }, {})

const sanitizeNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.floor(value))
}

const nowIso = () => new Date().toISOString()

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      rooms: DEFAULT_ROOMS,
      selectedRoomId: DEFAULT_ROOMS[0].id,
      prices: {
        time: 30000,
        drink: 5000,
        liquor: 6000,
        helper: 50000,
      },
      usageByRoom: createInitialUsage(),
      businessSessions: [],
      activeBusinessSessionId: null,
      salesHistory: [],
      setSelectedRoom: (roomId) => {
        set({ selectedRoomId: roomId })
      },
      setPrices: (prices) => {
        set({
          prices: {
            time: sanitizeNumber(prices.time),
            drink: sanitizeNumber(prices.drink),
            liquor: sanitizeNumber(prices.liquor),
            helper: sanitizeNumber(prices.helper),
          },
        })
      },
      startBusinessSession: () => {
        const state = get()
        if (state.activeBusinessSessionId) {
          return
        }
        const nextSession: BusinessSession = {
          id: `session-${Date.now()}`,
          startTime: nowIso(),
          endTime: null,
        }
        set({
          businessSessions: [...state.businessSessions, nextSession],
          activeBusinessSessionId: nextSession.id,
        })
      },
      endBusinessSession: () => {
        const state = get()
        if (!state.activeBusinessSessionId) {
          return
        }
        const endedAt = nowIso()
        set({
          businessSessions: state.businessSessions.map((session) =>
            session.id === state.activeBusinessSessionId
              ? { ...session, endTime: endedAt }
              : session,
          ),
          activeBusinessSessionId: null,
        })
      },
      setRoomStatus: (roomId, status) => {
        const state = get()
        const changedAt = nowIso()
        let nextSessions = state.businessSessions
        let nextActiveSessionId = state.activeBusinessSessionId

        // 실사용에서 시작 버튼을 놓쳐도 누락되지 않게 진행 시작 시 영업을 자동 시작합니다.
        if (status === "in_progress" && !nextActiveSessionId) {
          const nextSession: BusinessSession = {
            id: `session-${Date.now()}`,
            startTime: changedAt,
            endTime: null,
          }
          nextSessions = [...state.businessSessions, nextSession]
          nextActiveSessionId = nextSession.id
        }

        set({
          businessSessions: nextSessions,
          activeBusinessSessionId: nextActiveSessionId,
          rooms: state.rooms.map((room) => {
            if (room.id !== roomId) {
              return room
            }
            if (status === "in_progress") {
              return {
                ...room,
                status: "in_progress",
                startTime: changedAt,
                endTime: null,
              }
            }
            return {
              ...room,
              status: "waiting",
            }
          }),
        })
      },
      addRoom: () => {
        const state = get()
        const nextNumber = state.rooms.length + 1
        const newId = `room-${Date.now()}`
        set({
          rooms: [
            ...state.rooms,
            {
              id: newId,
              name: `${nextNumber}번방`,
              status: "waiting",
              startTime: null,
              endTime: null,
            },
          ],
          usageByRoom: {
            ...state.usageByRoom,
            [newId]: emptyUsage(),
          },
        })
      },
      renameRoom: (roomId, name) => {
        const trimmed = name.trim()
        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === roomId
              ? { ...room, name: trimmed.length > 0 ? trimmed : room.name }
              : room,
          ),
        }))
      },
      removeRoom: (roomId) => {
        const state = get()
        if (state.rooms.length <= 1) {
          return
        }

        const nextRooms = state.rooms.filter((room) => room.id !== roomId)
        const nextUsage = { ...state.usageByRoom }
        delete nextUsage[roomId]

        const fallbackRoomId = nextRooms[0]?.id ?? ""
        const nextSelectedRoom =
          state.selectedRoomId === roomId ? fallbackRoomId : state.selectedRoomId

        set({
          rooms: nextRooms,
          usageByRoom: nextUsage,
          selectedRoomId: nextSelectedRoom,
        })
      },
      incrementUsage: (roomId, type) => {
        set((state) => {
          const current = state.usageByRoom[roomId] ?? emptyUsage()
          return {
            usageByRoom: {
              ...state.usageByRoom,
              [roomId]: {
                ...current,
                [type]: current[type] + 1,
              },
            },
          }
        })
      },
      setMemo: (roomId, memo) => {
        set((state) => {
          const current = state.usageByRoom[roomId] ?? emptyUsage()
          return {
            usageByRoom: {
              ...state.usageByRoom,
              [roomId]: { ...current, memo },
            },
          }
        })
      },
      setPaymentAmount: (roomId, type, amount) => {
        set((state) => {
          const current = state.usageByRoom[roomId] ?? emptyUsage()
          return {
            usageByRoom: {
              ...state.usageByRoom,
              [roomId]: { ...current, [type]: sanitizeNumber(amount) },
            },
          }
        })
      },
      resetUsage: (roomId) => {
        set((state) => ({
          usageByRoom: {
            ...state.usageByRoom,
            [roomId]: emptyUsage(),
          },
        }))
      },
      completeRoom: (roomId) => {
        const state = get()
        const room = state.rooms.find((item) => item.id === roomId)
        if (!room) {
          return
        }
        const usage = state.usageByRoom[roomId] ?? emptyUsage()
        const endTime = nowIso()
        const startTime = room.startTime ?? endTime
        const total =
          usage.time * state.prices.time +
          usage.beer * state.prices.drink +
          usage.soju * state.prices.liquor +
          usage.helper * state.prices.helper

        const record: SaleRecord = {
          id: `sale-${Date.now()}`,
          roomId: room.id,
          roomName: room.name,
          startTime,
          endTime,
          total,
          cashAmount: usage.cashAmount,
          cardAmount: usage.cardAmount,
          memo: usage.memo,
          settledAt: endTime,
          businessSessionId: state.activeBusinessSessionId,
        }

        set({
          usageByRoom: {
            ...state.usageByRoom,
            [roomId]: emptyUsage(),
          },
          rooms: state.rooms.map((item) =>
            item.id === roomId
              ? {
                  ...item,
                  status: "waiting",
                  startTime: null,
                  endTime,
                }
              : item,
          ),
          salesHistory: [...state.salesHistory, record],
        })
      },
    }),
    {
      name: "room-count-local-store",
    },
  ),
)

export const formatCurrency = (amount: number) =>
  formatNumberWithComma(amount)

