import { supabase } from "@/lib/supabase"
import type { BusinessSession, PriceItem, SaleRecord } from "@/store/appStore"

type StartBusinessSessionInput = {
  id: string
  startAt: string
}

type CloseBusinessSessionInput = {
  id: string
  endAt: string
}

type SettlementItem = {
  item: PriceItem
  quantity: number
}

type CreateSettlementInput = {
  roomId: string
  roomName: string
  startAt: string
  endAt: string
  memo: string
  totalAmount: number
  cashAmount: number
  cardAmount: number
  businessSessionId: string | null
  items: SettlementItem[]
}

type LedgerSnapshot = {
  sessions: BusinessSession[]
  activeBusinessSessionId: string | null
  sales: SaleRecord[]
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export const createBusinessSessionInDb = async (input: StartBusinessSessionInput) => {
  if (!isUuid(input.id)) {
    return
  }
  const { error } = await supabase.from("business_sessions").insert({
    id: input.id,
    start_at: input.startAt,
    status: "open",
  })
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw error
  }
}

export const closeBusinessSessionInDb = async (input: CloseBusinessSessionInput) => {
  if (!isUuid(input.id)) {
    return
  }
  const { error } = await supabase
    .from("business_sessions")
    .update({
      end_at: input.endAt,
      status: "closed",
    })
    .eq("id", input.id)
  if (error) {
    throw error
  }
}

export const createSettlementInDb = async (input: CreateSettlementInput) => {
  if (!isUuid(input.businessSessionId ?? "")) {
    return
  }

  const { data: insertedRoomSession, error: roomSessionError } = await supabase
    .from("room_sessions")
    .insert({
      room_id: input.roomId,
      business_session_id: input.businessSessionId,
      room_name_snapshot: input.roomName,
      start_at: input.startAt,
      end_at: input.endAt,
      status: "completed",
      total_amount: Math.max(0, input.totalAmount),
      memo: input.memo,
    })
    .select("id")
    .limit(1)

  if (roomSessionError) {
    throw roomSessionError
  }

  const roomSessionId = insertedRoomSession?.[0]?.id
  if (!roomSessionId) {
    return
  }

  const itemRows = input.items
    .filter((entry) => entry.quantity > 0)
    .map((entry) => ({
      room_session_id: roomSessionId,
      item_id: isUuid(entry.item.id) ? entry.item.id : null,
      item_name_snapshot: entry.item.name,
      unit_snapshot: entry.item.unit,
      unit_price_snapshot: Math.max(0, entry.item.price),
      quantity: Math.max(0, entry.quantity),
    }))

  if (itemRows.length > 0) {
    const { error: itemError } = await supabase.from("room_session_items").insert(itemRows)
    if (itemError) {
      throw itemError
    }
  }

  const { error: settlementError } = await supabase.from("settlements").insert({
    room_session_id: roomSessionId,
    cash_amount: Math.max(0, input.cashAmount),
    card_amount: Math.max(0, input.cardAmount),
    settled_at: input.endAt,
  })
  if (settlementError) {
    throw settlementError
  }
}

type BusinessSessionRow = {
  id: string
  start_at: string
  end_at: string | null
  status: string
}

type RoomSessionSettlementRow = {
  cash_amount: number
  card_amount: number
  settled_at: string
}

type RoomSessionRow = {
  id: string
  room_id: string
  room_name_snapshot: string
  start_at: string
  end_at: string | null
  total_amount: number
  memo: string | null
  business_session_id: string | null
  settlements: RoomSessionSettlementRow[] | RoomSessionSettlementRow | null
}

const toSettlement = (
  raw: RoomSessionRow["settlements"],
): RoomSessionSettlementRow | null => {
  if (!raw) {
    return null
  }
  if (Array.isArray(raw)) {
    return raw[0] ?? null
  }
  return raw
}

export const loadLedgerSnapshotFromDb = async (): Promise<LedgerSnapshot> => {
  const [sessionsResult, roomSessionsResult] = await Promise.all([
    supabase
      .from("business_sessions")
      .select("id, start_at, end_at, status")
      .order("start_at", { ascending: true }),
    supabase
      .from("room_sessions")
      .select(
        "id, room_id, room_name_snapshot, start_at, end_at, total_amount, memo, business_session_id, settlements(cash_amount, card_amount, settled_at)",
      )
      .order("end_at", { ascending: true }),
  ])

  const sessionsRows = (sessionsResult.data ?? []) as BusinessSessionRow[]
  const sessions: BusinessSession[] = sessionsRows.map((row) => ({
    id: row.id,
    startTime: row.start_at,
    endTime: row.end_at,
  }))

  const activeSession =
    sessionsRows.find((row) => row.status === "open") ??
    [...sessionsRows].reverse().find((row) => !row.end_at)

  const roomSessionRows = (roomSessionsResult.data ?? []) as RoomSessionRow[]
  const sales: SaleRecord[] = roomSessionRows
    .map((row) => {
      const settlement = toSettlement(row.settlements)
      if (!settlement || !row.end_at) {
        return null
      }
      return {
        id: row.id,
        roomId: row.room_id,
        roomName: row.room_name_snapshot,
        startTime: row.start_at,
        endTime: row.end_at,
        total: Math.max(0, Number(row.total_amount) || 0),
        cashAmount: Math.max(0, Number(settlement.cash_amount) || 0),
        cardAmount: Math.max(0, Number(settlement.card_amount) || 0),
        memo: row.memo ?? "",
        settledAt: settlement.settled_at,
        businessSessionId: row.business_session_id,
      }
    })
    .filter((row): row is SaleRecord => Boolean(row))

  return {
    sessions,
    activeBusinessSessionId: activeSession?.id ?? null,
    sales,
  }
}


