import { supabase } from "@/lib/supabase"
import type { RoomConfig } from "@/store/appStore"

type RoomRow = {
  id: string
  name: string
  display_order: number | null
  is_active: boolean
}

const DEFAULT_ROOM_NAMES = ["1번방", "2번방", "3번방", "4번방"]

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `room-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

const toRoomConfig = (row: RoomRow): RoomConfig => ({
  id: row.id,
  name: row.name,
})

const sortRoomRows = (rows: RoomRow[]) =>
  [...rows].sort((a, b) => {
    const orderA = a.display_order ?? 0
    const orderB = b.display_order ?? 0
    if (orderA !== orderB) {
      return orderA - orderB
    }
    return a.name.localeCompare(b.name, "ko")
  })

const createDefaultRoomPayload = () =>
  DEFAULT_ROOM_NAMES.map((name, index) => ({
    id: createId(),
    name,
    display_order: index,
    is_active: true,
  }))

export const loadRooms = async (): Promise<RoomConfig[]> => {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, display_order, is_active")
    .eq("is_active", true)
    .order("display_order", { ascending: true })

  if (!error && data && data.length > 0) {
    return sortRoomRows(data as RoomRow[]).map(toRoomConfig)
  }

  const defaults = createDefaultRoomPayload()
  try {
    const { data: insertedRows, error: insertError } = await supabase
      .from("rooms")
      .insert(defaults)
      .select("id, name, display_order, is_active")

    if (!insertError && insertedRows && insertedRows.length > 0) {
      return sortRoomRows(insertedRows as RoomRow[]).map(toRoomConfig)
    }
  } catch {
    // RLS/네트워크 오류 시 로컬 fallback만 사용
  }

  return defaults.map((row) => ({ id: row.id, name: row.name }))
}

export const addRoomToDb = async (name: string, displayOrder: number) => {
  const payload = {
    id: createId(),
    name: name.trim() || `${displayOrder + 1}번방`,
    display_order: Math.max(0, displayOrder),
    is_active: true,
  }
  const { error } = await supabase.from("rooms").insert(payload)
  if (error) {
    throw error
  }
}

export const renameRoomInDb = async (roomId: string, name: string) => {
  const trimmed = name.trim()
  if (!trimmed) {
    return
  }
  const { error } = await supabase.from("rooms").update({ name: trimmed }).eq("id", roomId)
  if (error) {
    throw error
  }
}

export const removeRoomFromDb = async (roomId: string) => {
  const { error } = await supabase
    .from("rooms")
    .update({ is_active: false })
    .eq("id", roomId)
  if (error) {
    throw error
  }
}


