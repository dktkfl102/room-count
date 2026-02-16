import { useState } from "react"
import { useAppStore } from "@/store/appStore"

function RoomSettingsPage() {
  const rooms = useAppStore((state) => state.rooms)
  const addRoom = useAppStore((state) => state.addRoom)
  const renameRoom = useAppStore((state) => state.renameRoom)
  const removeRoom = useAppStore((state) => state.removeRoom)

  const [draftNames, setDraftNames] = useState<Record<string, string>>({})

  const getDraftName = (roomId: string, fallbackName: string) =>
    draftNames[roomId] ?? fallbackName

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
              onClick={() => renameRoom(room.id, getDraftName(room.id, room.name))}
              className="h-12 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground"
            >
              이름 저장
            </button>
            <button
              type="button"
              onClick={() => removeRoom(room.id)}
              disabled={rooms.length <= 1}
              className="h-12 rounded-lg border px-4 text-base font-semibold disabled:opacity-40"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRoom}
        className="mt-5 h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground sm:w-56"
      >
        방 추가
      </button>
    </section>
  )
}

export default RoomSettingsPage

