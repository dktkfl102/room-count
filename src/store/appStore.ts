import { create } from "zustand"
import { persist } from "zustand/middleware"
import { DEFAULT_CATALOG_ITEMS } from "@/lib/catalog"
import { formatNumberWithComma } from "@/lib/number"

export type RoomStatus = "waiting" | "in_progress"

type Usage = {
  itemCounts: Record<string, number>
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

export type RoomConfig = Pick<Room, "id" | "name">

export type PriceItem = {
  id: string
  name: string
  unit: string
  price: number
  category: string
  displayOrder: number
  isActive: boolean
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
  priceItems: PriceItem[]
  usageByRoom: Record<string, Usage>
  businessSessions: BusinessSession[]
  activeBusinessSessionId: string | null
  salesHistory: SaleRecord[]
  setSelectedRoom: (roomId: string) => void
  setRoomsFromDb: (rooms: RoomConfig[]) => void
  setPriceItems: (items: PriceItem[]) => void
  setBusinessSessionsFromDb: (
    sessions: BusinessSession[],
    activeBusinessSessionId: string | null,
  ) => void
  setSalesHistoryFromDb: (sales: SaleRecord[]) => void
  startBusinessSession: () => void
  endBusinessSession: () => void
  setRoomStatus: (roomId: string, status: RoomStatus) => void
  addRoom: () => void
  renameRoom: (roomId: string, name: string) => void
  removeRoom: (roomId: string) => void
  incrementUsage: (roomId: string, itemId: string) => void
  decrementUsage: (roomId: string, itemId: string) => void
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
  itemCounts: {},
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
const createUuid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === "x" ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

const defaultPriceItems = (): PriceItem[] =>
  DEFAULT_CATALOG_ITEMS.map((item, index) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    price: item.price,
    category: item.category,
    displayOrder: item.displayOrder ?? index,
    isActive: true,
  }))

const sanitizePriceItems = (items: PriceItem[]) =>
  [...items]
    .map((item, index) => ({
      ...item,
      name: item.name.trim() || `품목 ${index + 1}`,
      unit: item.unit.trim() || "개",
      category: (item.category || item.name || "etc").trim().toLowerCase() || "etc",
      price: sanitizeNumber(item.price),
      displayOrder: item.displayOrder >= 0 ? item.displayOrder : index,
      isActive: item.isActive !== false,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item, index) => ({ ...item, displayOrder: index }))

const normalizeUsage = (raw: unknown, items: PriceItem[]): Usage => {
  const source = (raw as Record<string, unknown>) ?? {}
  const legacyByCategory: Record<string, number> = {
    time: Number(source.time ?? 0) || 0,
    drink: Number(source.drink ?? 0) || 0,
    soju: Number(source.soju ?? 0) || 0,
    beer: Number(source.beer ?? 0) || 0,
  }

  const nextCounts: Record<string, number> = {}
  const sourceCounts =
    typeof source.itemCounts === "object" && source.itemCounts !== null
      ? (source.itemCounts as Record<string, unknown>)
      : {}

  for (const item of items) {
    const byId = Number(sourceCounts[item.id] ?? 0) || 0
    const byCategory = Number(legacyByCategory[item.category] ?? 0) || 0
    nextCounts[item.id] = Math.max(0, Math.floor(byId > 0 ? byId : byCategory))
  }

  return {
    itemCounts: nextCounts,
    memo: typeof source.memo === "string" ? source.memo : "",
    cashAmount: sanitizeNumber(Number(source.cashAmount ?? 0) || 0),
    cardAmount: sanitizeNumber(Number(source.cardAmount ?? 0) || 0),
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      rooms: DEFAULT_ROOMS,
      selectedRoomId: DEFAULT_ROOMS[0].id,
      priceItems: defaultPriceItems(),
      usageByRoom: createInitialUsage(),
      businessSessions: [],
      activeBusinessSessionId: null,
      salesHistory: [],
      setSelectedRoom: (roomId) => {
        set({ selectedRoomId: roomId })
      },
      setRoomsFromDb: (rooms) => {
        set((state) => {
          const nextRooms = rooms.map((room) => {
            const existing = state.rooms.find((item) => item.id === room.id)
            return {
              id: room.id,
              name: room.name,
              status: existing?.status ?? "waiting",
              startTime: existing?.startTime ?? null,
              endTime: existing?.endTime ?? null,
            }
          })

          if (nextRooms.length === 0) {
            return state
          }

          const nextUsage = nextRooms.reduce<Record<string, Usage>>((acc, room) => {
            acc[room.id] = state.usageByRoom[room.id] ?? emptyUsage()
            return acc
          }, {})

          const hasSelected = nextRooms.some((room) => room.id === state.selectedRoomId)
          return {
            rooms: nextRooms,
            usageByRoom: nextUsage,
            selectedRoomId: hasSelected ? state.selectedRoomId : nextRooms[0].id,
          }
        })
      },
      setPriceItems: (items) => {
        set({
          priceItems: sanitizePriceItems(items),
        })
      },
      setBusinessSessionsFromDb: (sessions, activeBusinessSessionId) => {
        set({
          businessSessions: sessions,
          activeBusinessSessionId,
        })
      },
      setSalesHistoryFromDb: (sales) => {
        set({
          salesHistory: sales,
        })
      },
      startBusinessSession: () => {
        const state = get()
        if (state.activeBusinessSessionId) {
          return
        }
        const nextSession: BusinessSession = {
          id: createUuid(),
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
        const resetUsageByRoom = state.rooms.reduce<Record<string, Usage>>((acc, room) => {
          acc[room.id] = emptyUsage()
          return acc
        }, {})
        set({
          businessSessions: state.businessSessions.map((session) =>
            session.id === state.activeBusinessSessionId
              ? { ...session, endTime: endedAt }
              : session,
          ),
          activeBusinessSessionId: null,
          rooms: state.rooms.map((room) => ({
            ...room,
            status: "waiting",
            startTime: null,
            endTime: endedAt,
          })),
          usageByRoom: resetUsageByRoom,
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
            id: createUuid(),
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
          const current = normalizeUsage(state.usageByRoom[roomId], state.priceItems)
          return {
            usageByRoom: {
              ...state.usageByRoom,
              [roomId]: {
                ...current,
                itemCounts: {
                  ...current.itemCounts,
                  [type]: (current.itemCounts[type] ?? 0) + 1,
                },
              },
            },
          }
        })
      },
      decrementUsage: (roomId, type) => {
        set((state) => {
          const current = normalizeUsage(state.usageByRoom[roomId], state.priceItems)
          const currentCount = current.itemCounts[type] ?? 0
          return {
            usageByRoom: {
              ...state.usageByRoom,
              [roomId]: {
                ...current,
                itemCounts: {
                  ...current.itemCounts,
                  [type]: Math.max(0, currentCount - 1),
                },
              },
            },
          }
        })
      },
      setMemo: (roomId, memo) => {
        set((state) => {
          const current = normalizeUsage(state.usageByRoom[roomId], state.priceItems)
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
          const current = normalizeUsage(state.usageByRoom[roomId], state.priceItems)
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
        const usage = normalizeUsage(state.usageByRoom[roomId], state.priceItems)
        const endTime = nowIso()
        const startTime = room.startTime ?? endTime
        const total = state.priceItems.reduce((sum, item) => {
          const quantity = usage.itemCounts[item.id] ?? 0
          return sum + quantity * item.price
        }, 0)

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
      version: 2,
      migrate: (persistedState) => {
        const state = (persistedState as Partial<AppState>) ?? {}
        const priceItems =
          Array.isArray(state.priceItems) && state.priceItems.length > 0
            ? sanitizePriceItems(state.priceItems)
            : defaultPriceItems()
        const usageByRoom = Object.entries(state.usageByRoom ?? {}).reduce<
          Record<string, Usage>
        >((acc, [roomId, usage]) => {
          acc[roomId] = normalizeUsage(usage, priceItems)
          return acc
        }, {})

        return {
          ...state,
          priceItems,
          usageByRoom,
        }
      },
    },
  ),
)

export const formatCurrency = (amount: number) =>
  formatNumberWithComma(amount)

