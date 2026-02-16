import { useEffect, useMemo, useState } from "react"
import CurrencyInput from "@/components/CurrencyInput"
import { formatCurrency, useAppStore } from "@/store/appStore"

const usageRows = [
  { key: "time", label: "시간", unit: "시간" },
  { key: "beer", label: "맥주", unit: "개" },
  { key: "soju", label: "소주", unit: "개" },
  { key: "helper", label: "도우미", unit: "명" },
] as const

const addButtons = [
  { key: "time", label: "+1시간" },
  { key: "beer", label: "+맥주" },
  { key: "soju", label: "+소주" },
  { key: "helper", label: "+도우미" },
] as const

const fallbackUsage = {
  time: 0,
  beer: 0,
  soju: 0,
  helper: 0,
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
  const prices = useAppStore((state) => state.prices)
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

  const getRoomUsage = (roomId: string) => usageByRoom[roomId] ?? fallbackUsage

  const calculateTotal = (roomId: string) => {
    const roomUsage = getRoomUsage(roomId)
    return (
      roomUsage.time * prices.time +
      roomUsage.beer * prices.drink +
      roomUsage.soju * prices.liquor +
      roomUsage.helper * prices.helper
    )
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
    completeRoom(settlementRoom.id)
    setSettlementRoomId(null)
  }

  const handleEndBusinessClick = () => {
    if (inProgressRoomCount > 0) {
      setIsCloseWarningOpen(true)
      return
    }
    endBusinessSession()
  }

  const handleForceEndBusiness = () => {
    endBusinessSession()
    setIsCloseWarningOpen(false)
  }

  return (
    <section className="mx-auto w-full max-w-4xl">
      <h2 className="text-xl font-bold sm:text-2xl">메인 화면</h2>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">
        버튼 위주로 빠르게 입력하는 장부 화면
      </p>

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
            onClick={startBusinessSession}
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
          현재 사용 내역 - {selectedRoom.name}
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
          onClick={() =>
            setRoomStatus(
              selectedRoom.id,
              selectedRoomStatus === "waiting" ? "in_progress" : "waiting",
            )
          }
          className="mt-2 h-11 rounded-lg border px-4 text-sm font-semibold sm:text-base"
        >
          {selectedRoomStatus === "waiting" ? "진행 시작" : "대기 전환"}
        </button>

        <div className="mt-3 space-y-2 text-base">
          {usageRows.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-md bg-muted px-3 py-2"
            >
              <span className="font-medium">{item.label}</span>
              <span>
                +{usage[item.key]} {item.unit}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-primary px-4 py-3 text-base font-bold text-primary-foreground sm:text-xl">
          총 금액: {formatCurrency(total)}원
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-base font-semibold sm:text-lg">빠른 추가</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {addButtons.map((button) => (
            <button
              key={button.key}
              type="button"
              onClick={() => incrementUsage(selectedRoom.id, button.key)}
              className="h-14 rounded-lg bg-primary text-base font-semibold text-primary-foreground sm:text-lg"
            >
              {button.label}
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
          선택 방 완료
        </button>
        <button
          type="button"
          onClick={() => resetUsage(selectedRoom.id)}
          className="h-12 rounded-lg border text-base font-semibold"
        >
          선택 방 사용내역 초기화
        </button>
      </div>

      {settlementRoom && settlementUsage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-4">
            <h3 className="text-lg font-bold sm:text-xl">정산 확인 - {settlementRoom.name}</h3>
            <div className="mt-3 space-y-2 text-sm sm:text-base">
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <span>시간</span>
                <span>+{settlementUsage.time}시간</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <span>맥주</span>
                <span>+{settlementUsage.beer}개</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <span>소주</span>
                <span>+{settlementUsage.soju}개</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <span>도우미</span>
                <span>+{settlementUsage.helper}명</span>
              </div>
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
                완료 처리
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

