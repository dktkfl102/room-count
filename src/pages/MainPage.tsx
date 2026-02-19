import { useEffect, useMemo, useRef, useState } from "react"
import CurrencyInput from "@/components/CurrencyInput"
import {
  closeBusinessSessionInDb,
  createBusinessSessionInDb,
  createSettlementInDb,
} from "@/lib/ledger"
import { formatCurrency, useAppStore } from "@/store/appStore"
const fallbackUsage = {
  itemCounts: {} as Record<string, number>,
  memo: "",
  cashAmount: 0,
  cardAmount: 0,
}

const formatDateTime = (iso: string | null) => {
  if (!iso) {
    return "-"
  }
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function MainPage() {
  const rooms = useAppStore((state) => state.rooms)
  const selectedRoomId = useAppStore((state) => state.selectedRoomId)
  const priceItems = useAppStore((state) => state.priceItems)
  const usageByRoom = useAppStore((state) => state.usageByRoom)
  const businessSessions = useAppStore((state) => state.businessSessions)
  const activeBusinessSessionId = useAppStore((state) => state.activeBusinessSessionId)
  const salesHistory = useAppStore((state) => state.salesHistory)
  const setSelectedRoom = useAppStore((state) => state.setSelectedRoom)
  const setRoomStatus = useAppStore((state) => state.setRoomStatus)
  const startBusinessSession = useAppStore((state) => state.startBusinessSession)
  const endBusinessSession = useAppStore((state) => state.endBusinessSession)
  const incrementUsage = useAppStore((state) => state.incrementUsage)
  const setMemo = useAppStore((state) => state.setMemo)
  const setPaymentAmount = useAppStore((state) => state.setPaymentAmount)
  const resetUsage = useAppStore((state) => state.resetUsage)
  const completeRoom = useAppStore((state) => state.completeRoom)
  const [settlementRoomId, setSettlementRoomId] = useState<string | null>(null)
  const [isCloseWarningOpen, setIsCloseWarningOpen] = useState(false)
  const [syncMessage, setSyncMessage] = useState("")
  const [guideMessage, setGuideMessage] = useState("")
  const syncedBusinessSessionIdsRef = useRef<Set<string>>(new Set())

  const sortedPriceItems = useMemo(
    () => [...priceItems].filter((item) => item.isActive !== false).sort((a, b) => a.displayOrder - b.displayOrder),
    [priceItems],
  )

  const getRoomUsage = (roomId: string) => ({
    ...fallbackUsage,
    ...(usageByRoom[roomId] ?? {}),
    itemCounts: {
      ...fallbackUsage.itemCounts,
      ...((usageByRoom[roomId]?.itemCounts as Record<string, number> | undefined) ?? {}),
    },
  })

  const calculateTotal = (roomId: string) => {
    const roomUsage = getRoomUsage(roomId)
    return sortedPriceItems.reduce((sum, item) => {
      const quantity = roomUsage.itemCounts[item.id] ?? 0
      return sum + quantity * item.price
    }, 0)
  }

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0]
  const usage = getRoomUsage(selectedRoom.id)
  const total = calculateTotal(selectedRoom.id)
  const selectedRoomStatus = selectedRoom.status ?? "waiting"

  const paidAmount = usage.cashAmount + usage.cardAmount
  const remainingAmount = Math.max(0, total - paidAmount)

  const activeBusinessSession = useMemo(
    () => businessSessions.find((session) => session.id === activeBusinessSessionId) ?? null,
    [businessSessions, activeBusinessSessionId],
  )
  const latestBusinessSession = businessSessions[businessSessions.length - 1] ?? null
  const targetSessionId = activeBusinessSession?.id ?? latestBusinessSession?.id ?? null
  const businessDaySales = useMemo(
    () =>
      targetSessionId
        ? salesHistory
            .filter((record) => record.businessSessionId === targetSessionId)
            .reduce((sum, record) => sum + record.total, 0)
        : 0,
    [salesHistory, targetSessionId],
  )
  const businessDaySettledCount = useMemo(
    () =>
      targetSessionId
        ? salesHistory.filter((record) => record.businessSessionId === targetSessionId).length
        : 0,
    [salesHistory, targetSessionId],
  )
  const inProgressRoomCount = rooms.filter(
    (room) => (room.status ?? "waiting") === "in_progress",
  ).length
  const inProgressRoomNames = rooms
    .filter((room) => (room.status ?? "waiting") === "in_progress")
    .map((room) => room.name)

  const settlementRoom = useMemo(
    () => rooms.find((room) => room.id === settlementRoomId),
    [rooms, settlementRoomId],
  )
  const settlementUsage = settlementRoom ? getRoomUsage(settlementRoom.id) : null
  const settlementTotal = settlementRoom ? calculateTotal(settlementRoom.id) : 0
  const settlementPaid = settlementUsage
    ? settlementUsage.cashAmount + settlementUsage.cardAmount
    : 0
  const settlementRemaining = Math.max(0, settlementTotal - settlementPaid)

  useEffect(() => {
    const nextCardAmount = Math.max(0, total - usage.cashAmount)
    if (usage.cardAmount !== nextCardAmount) {
      setPaymentAmount(selectedRoom.id, "cardAmount", nextCardAmount)
    }
  }, [selectedRoom.id, total, usage.cashAmount, usage.cardAmount, setPaymentAmount])

  const handleCashAmountChange = (amount: number) => {
    const cashAmount = Math.max(0, amount)
    const cardAmount = Math.max(0, total - cashAmount)
    setPaymentAmount(selectedRoom.id, "cashAmount", cashAmount)
    setPaymentAmount(selectedRoom.id, "cardAmount", cardAmount)
  }

  const handleConfirmSettlement = () => {
    if (!settlementRoom) {
      return
    }
    const roomUsage = getRoomUsage(settlementRoom.id)
    const beforeSessionId = activeBusinessSessionId
    const settlementItems = sortedPriceItems.map((item) => ({
      item,
      quantity: roomUsage.itemCounts[item.id] ?? 0,
    }))

    completeRoom(settlementRoom.id)
    setSettlementRoomId(null)

    const latestRecord = useAppStore.getState().salesHistory.at(-1)
    if (!latestRecord || latestRecord.roomId !== settlementRoom.id) {
      return
    }

    void createSettlementInDb({
      roomId: settlementRoom.id,
      roomName: settlementRoom.name,
      startAt: latestRecord.startTime,
      endAt: latestRecord.endTime,
      memo: latestRecord.memo,
      totalAmount: latestRecord.total,
      cashAmount: latestRecord.cashAmount,
      cardAmount: latestRecord.cardAmount,
      businessSessionId: beforeSessionId,
      items: settlementItems,
    }).catch(() => {
      setSyncMessage("정산 데이터 DB 저장에 실패했습니다. 네트워크를 확인해 주세요.")
    })
  }

  const handleEndBusinessClick = () => {
    if (inProgressRoomCount > 0) {
      setIsCloseWarningOpen(true)
      return
    }
    const currentSessionId = activeBusinessSessionId
    endBusinessSession()
    if (!currentSessionId) {
      return
    }
    const endedSession = useAppStore
      .getState()
      .businessSessions.find((session) => session.id === currentSessionId)
    void closeBusinessSessionInDb({
      id: currentSessionId,
      endAt: endedSession?.endTime ?? new Date().toISOString(),
    }).catch(() => {
      setSyncMessage("영업 마감 기록 DB 저장에 실패했습니다.")
    })
  }

  const handleForceEndBusiness = () => {
    const currentSessionId = activeBusinessSessionId
    endBusinessSession()
    setIsCloseWarningOpen(false)
    if (!currentSessionId) {
      return
    }
    const endedSession = useAppStore
      .getState()
      .businessSessions.find((session) => session.id === currentSessionId)
    void closeBusinessSessionInDb({
      id: currentSessionId,
      endAt: endedSession?.endTime ?? new Date().toISOString(),
    }).catch(() => {
      setSyncMessage("영업 마감 기록 DB 저장에 실패했습니다.")
    })
  }

  const handleStartBusinessClick = () => {
    if (activeBusinessSessionId) {
      return
    }
    startBusinessSession()
    const startedSession = useAppStore
      .getState()
      .businessSessions.at(-1)
    if (!startedSession) {
      return
    }
    void createBusinessSessionInDb({
      id: startedSession.id,
      startAt: startedSession.startTime,
    }).catch(() => {
      setSyncMessage("영업 시작 기록 DB 저장에 실패했습니다.")
    })
  }

  const handleToggleSelectedRoomStatus = () => {
    if (selectedRoomStatus === "waiting" && !activeBusinessSessionId) {
      setGuideMessage("영업시작 버튼을 먼저 눌러주세요.")
      return
    }
    setGuideMessage("")
    setRoomStatus(
      selectedRoom.id,
      selectedRoomStatus === "waiting" ? "in_progress" : "waiting",
    )
  }

  useEffect(() => {
    if (!activeBusinessSessionId) {
      return
    }
    if (syncedBusinessSessionIdsRef.current.has(activeBusinessSessionId)) {
      return
    }
    const currentSession = businessSessions.find((session) => session.id === activeBusinessSessionId)
    if (!currentSession) {
      return
    }

    syncedBusinessSessionIdsRef.current.add(activeBusinessSessionId)
    void createBusinessSessionInDb({
      id: currentSession.id,
      startAt: currentSession.startTime,
    }).catch(() => {
      syncedBusinessSessionIdsRef.current.delete(activeBusinessSessionId)
      setSyncMessage("영업 시작 기록 DB 저장에 실패했습니다.")
    })
  }, [activeBusinessSessionId, businessSessions])

  return (
    <section className="mx-auto w-full max-w-4xl">
        <h2 className="text-xl font-bold sm:text-2xl">메인 화면</h2>

      <div className="mt-5 rounded-lg border p-4">
        <h3 className="text-base font-semibold sm:text-lg">오늘 총 매출 요약</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-muted px-3 py-2 text-sm sm:text-base">
            영업 상태:{" "}
            <span className="font-semibold">
              {activeBusinessSession ? "진행중" : "마감"}
            </span>
          </div>
          <div className="rounded-md bg-muted px-3 py-2 text-sm sm:text-base">
            진행중 방: <span className="font-semibold">{inProgressRoomCount}개</span>
          </div>
          <div
            className={[
              "rounded-md px-3 py-2 text-sm sm:text-base",
              inProgressRoomCount > 0
                ? "bg-destructive text-destructive-foreground"
                : "bg-muted",
            ].join(" ")}
          >
            미정산 방: <span className="font-semibold">{inProgressRoomCount}개</span>
          </div>
          <div className="rounded-md bg-muted px-3 py-2 text-sm sm:text-base">
            시작 시각:{" "}
            <span className="font-semibold">
              {formatDateTime(activeBusinessSession?.startTime ?? latestBusinessSession?.startTime ?? null)}
            </span>
          </div>
          <div className="rounded-md bg-muted px-3 py-2 text-sm sm:text-base">
            영업일 누적 매출:{" "}
            <span className="font-semibold">{formatCurrency(businessDaySales)}원</span>
          </div>
          <div className="rounded-md bg-muted px-3 py-2 text-sm sm:text-base">
            오늘 정산 건수:{" "}
            <span className="font-semibold">{formatCurrency(businessDaySettledCount)}건</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:w-80">
          <button
            type="button"
            onClick={handleStartBusinessClick}
            disabled={Boolean(activeBusinessSession)}
            className="h-11 rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40"
          >
            영업 시작
          </button>
          <button
            type="button"
            onClick={handleEndBusinessClick}
            disabled={!activeBusinessSession}
            className="h-11 rounded-lg border text-base font-semibold disabled:opacity-40"
          >
            영업 마감
          </button>
        </div>
        {inProgressRoomCount > 0 ? (
          <p className="mt-2 text-xs text-destructive sm:text-sm">
            미정산 방: {inProgressRoomNames.join(", ")}
          </p>
        ) : null}
      </div>
      {syncMessage ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground sm:text-base">
          {syncMessage}
        </p>
      ) : null}

      <div className="mt-5">
        <h3 className="mb-2 text-base font-semibold sm:text-lg">방 선택</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {rooms.map((room) => (
            <div key={room.id} className="rounded-lg border p-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedRoom(room.id)}
                  className={[
                    "h-10 rounded-lg px-3 text-sm font-semibold sm:text-base",
                    room.id === selectedRoom.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-background",
                  ].join(" ")}
                >
                  {room.name}
                </button>
                <span
                  className={[
                    "rounded-full px-2 py-1 text-xs font-semibold",
                    (room.status ?? "waiting") === "in_progress"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {(room.status ?? "waiting") === "in_progress" ? "진행중" : "대기"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-lg border p-4">
        <h3 className="text-base font-semibold sm:text-lg">
          {selectedRoom.name}
        </h3>
        <div className="mt-2 rounded-md bg-muted px-3 py-2 text-sm sm:text-base">
          상태:{" "}
          <span className="font-semibold">
            {selectedRoomStatus === "in_progress" ? "진행중" : "대기"}
          </span>
          {" / "}시작: <span className="font-semibold">{formatDateTime(selectedRoom.startTime)}</span>
          {" / "}종료: <span className="font-semibold">{formatDateTime(selectedRoom.endTime)}</span>
        </div>
        <button
          type="button"
          onClick={handleToggleSelectedRoomStatus}
          className="mt-2 h-11 rounded-lg border px-4 text-sm font-semibold sm:text-base"
        >
          {selectedRoomStatus === "waiting" ? "진행 시작" : "대기 전환"}
        </button>
        {guideMessage ? (
          <p className="mt-2 text-xs text-destructive sm:text-sm">{guideMessage}</p>
        ) : null}

        <div className="mt-3 space-y-2 text-base">
          {sortedPriceItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md bg-muted px-3 py-2"
            >
              <span className="font-medium">{item.name}</span>
              <span>
                +{usage.itemCounts[item.id] ?? 0}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-primary px-4 py-3 text-base font-bold text-primary-foreground sm:text-xl">
          총 금액: {formatCurrency(total)}원
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold sm:text-lg">빠른 추가</h3>
          {selectedRoomStatus !== "in_progress" ? (
            <p className="text-xs text-destructive sm:text-sm">진행을 시작해주세요</p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sortedPriceItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => incrementUsage(selectedRoom.id, item.id)}
              disabled={selectedRoomStatus !== "in_progress"}
              className="h-14 rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:text-lg"
            >
              +{item.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h3 className="text-base font-semibold sm:text-lg">결제 구분</h3>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold sm:text-base">현금</span>
              <CurrencyInput
                value={usage.cashAmount}
                onValueChange={handleCashAmountChange}
                className="h-12 w-full rounded-lg border bg-background px-3 text-base"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold sm:text-base">카드</span>
              <CurrencyInput
                value={usage.cardAmount}
                onValueChange={() => {}}
                readOnly
                className="h-12 w-full rounded-lg border bg-muted px-3 text-base"
              />
            </label>
          </div>

          <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm sm:text-base">
            결제 합계: {formatCurrency(paidAmount)}원
          </div>
          <div className="mt-2 rounded-md bg-muted px-3 py-2 text-sm sm:text-base">
            남은 금액: {formatCurrency(remainingAmount)}원
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-base font-semibold sm:text-lg">메모</h3>
          <textarea
            value={usage.memo}
            onChange={(event) => setMemo(selectedRoom.id, event.target.value)}
            className="mt-3 h-40 w-full rounded-lg border bg-background p-3 text-base"
            placeholder="요청사항, 특이사항 등을 기록하세요."
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:max-w-md">
        <button
          type="button"
          onClick={() => setSettlementRoomId(selectedRoom.id)}
          className="h-12 rounded-lg bg-primary text-base font-semibold text-primary-foreground"
        >
          {selectedRoom.name} 정산
        </button>
        <button
          type="button"
          onClick={() => resetUsage(selectedRoom.id)}
          className="h-12 rounded-lg border text-base font-semibold"
        >
          {selectedRoom.name} 사용내역 초기화
        </button>
      </div>

      {settlementRoom && settlementUsage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-4">
            <h3 className="text-lg font-bold sm:text-xl">정산 확인 - {settlementRoom.name}</h3>
            <div className="mt-3 space-y-2 text-sm sm:text-base">
              {sortedPriceItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md bg-muted px-3 py-2"
                >
                  <span>{item.name}</span>
                  <span>+{settlementUsage.itemCounts[item.id] ?? 0}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground sm:text-base">
              총 금액: {formatCurrency(settlementTotal)}원
            </div>
            <div className="mt-2 rounded-md bg-muted px-3 py-2 text-sm sm:text-base">
              결제 합계: {formatCurrency(settlementPaid)}원 / 남은 금액:{" "}
              {formatCurrency(settlementRemaining)}원
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSettlementRoomId(null)}
                className="h-11 rounded-lg border text-base font-semibold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmSettlement}
                className="h-11 rounded-lg bg-primary text-base font-semibold text-primary-foreground"
              >
                정산 처리
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isCloseWarningOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-4">
            <h3 className="text-lg font-bold sm:text-xl">영업 마감 확인</h3>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              아직 진행중인 방이 있습니다. 지금 마감하면 미정산 방이 남을 수 있습니다.
            </p>
            <div className="mt-3 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground sm:text-base">
              미정산 방 {inProgressRoomCount}개: {inProgressRoomNames.join(", ")}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsCloseWarningOpen(false)}
                className="h-11 rounded-lg border text-base font-semibold"
              >
                계속 영업
              </button>
              <button
                type="button"
                onClick={handleForceEndBusiness}
                className="h-11 rounded-lg bg-destructive text-base font-semibold text-destructive-foreground"
              >
                마감 강행
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default MainPage

