import { useEffect, useState } from "react"
import {
  addRoomToDb,
  loadRooms,
  removeRoomFromDb,
  renameRoomInDb,
} from "@/lib/rooms"
import { useAppStore } from "@/store/appStore"

function RoomSettingsPage() {
  const rooms = useAppStore((state) => state.rooms)
  const setRoomsFromDb = useAppStore((state) => state.setRoomsFromDb)

  const [draftNames, setDraftNames] = useState<Record<string, string>>({})
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const getDraftName = (roomId: string, fallbackName: string) =>
    draftNames[roomId] ?? fallbackName

  const refreshRooms = async () => {
    const dbRooms = await loadRooms()
    setRoomsFromDb(dbRooms)
  }

  useEffect(() => {
    let mounted = true
    const initialize = async () => {
      try {
        const dbRooms = await loadRooms()
        if (!mounted) {
          return
        }
        setRoomsFromDb(dbRooms)
      } catch {
        if (mounted) {
          setMessage("방 목록을 불러오지 못했습니다.")
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }
    void initialize()
    return () => {
      mounted = false
    }
  }, [setRoomsFromDb])

  const handleAddRoom = async () => {
    if (isSaving) {
      return
    }
    setIsSaving(true)
    setMessage("")
    try {
      await addRoomToDb(`${rooms.length + 1}번방`, rooms.length)
      await refreshRooms()
      setMessage("방을 추가했습니다.")
    } catch {
      setMessage("방 추가에 실패했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRenameRoom = async (roomId: string, fallbackName: string) => {
    if (isSaving) {
      return
    }
    setIsSaving(true)
    setMessage("")
    try {
      await renameRoomInDb(roomId, getDraftName(roomId, fallbackName))
      await refreshRooms()
      setMessage("방 이름을 저장했습니다.")
    } catch {
      setMessage("이름 저장에 실패했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveRoom = async (roomId: string) => {
    if (isSaving || rooms.length <= 1) {
      return
    }
    setIsSaving(true)
    setMessage("")
    try {
      await removeRoomFromDb(roomId)
      await refreshRooms()
      setMessage("방을 삭제했습니다.")
    } catch {
      setMessage("방 삭제에 실패했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-2xl">
        <h2 className="text-xl font-bold sm:text-2xl">방 설정</h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">방 정보를 불러오는 중입니다.</p>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-2xl">
      <h2 className="text-xl font-bold sm:text-2xl">방 설정</h2>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">
        기본 1~4번방에서 시작하며 방 추가, 삭제, 이름 변경이 가능합니다.
      </p>

      <div className="mt-5 space-y-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto]"
          >
            <input
              value={getDraftName(room.id, room.name)}
              onChange={(event) =>
                setDraftNames((prev) => ({
                  ...prev,
                  [room.id]: event.target.value,
                }))
              }
              className="h-12 rounded-lg border bg-background px-3 text-base"
            />
            <button
              type="button"
              onClick={() => handleRenameRoom(room.id, room.name)}
              disabled={isSaving}
              className="h-12 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground disabled:opacity-40"
            >
              이름 저장
            </button>
            <button
              type="button"
              onClick={() => handleRemoveRoom(room.id)}
              disabled={rooms.length <= 1 || isSaving}
              className="h-12 rounded-lg border px-4 text-base font-semibold disabled:opacity-40"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddRoom}
        disabled={isSaving}
        className="mt-5 h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40 sm:w-56"
      >
        방 추가
      </button>

      {message ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground sm:text-base">
          {message}
        </p>
      ) : null}
    </section>
  )
}

export default RoomSettingsPage

