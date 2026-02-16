import { useMemo, useState } from "react"
import CurrencyInput from "@/components/CurrencyInput"
import { formatCurrency, useAppStore } from "@/store/appStore"

function PriceSettingsPage() {
  const prices = useAppStore((state) => state.prices)
  const setPrices = useAppStore((state) => state.setPrices)

  const [form, setForm] = useState(prices)
  const [saved, setSaved] = useState("")

  const previewText = useMemo(
    () =>
      `1시간 ${formatCurrency(form.time)}원 / 음료 ${formatCurrency(form.drink)}원 / 주류 ${formatCurrency(form.liquor)}원 / 도우미 ${formatCurrency(form.helper)}원`,
    [form],
  )

  const handleSave = () => {
    setPrices(form)
    setSaved("기본 단가를 저장했습니다.")
  }

  return (
    <section className="mx-auto w-full max-w-2xl">
      <h2 className="text-xl font-bold sm:text-2xl">가격표 설정</h2>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">
        기본 단가를 입력하면 메인 화면 계산에 즉시 반영됩니다.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold sm:text-base">시간 단가</span>
          <CurrencyInput
            value={form.time}
            onValueChange={(value) => setForm((prev) => ({ ...prev, time: value }))}
            className="h-12 w-full rounded-lg border bg-background px-3 text-base"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold sm:text-base">음료 단가</span>
          <CurrencyInput
            value={form.drink}
            onValueChange={(value) => setForm((prev) => ({ ...prev, drink: value }))}
            className="h-12 w-full rounded-lg border bg-background px-3 text-base"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold sm:text-base">주류 단가</span>
          <CurrencyInput
            value={form.liquor}
            onValueChange={(value) => setForm((prev) => ({ ...prev, liquor: value }))}
            className="h-12 w-full rounded-lg border bg-background px-3 text-base"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold sm:text-base">도우미 단가</span>
          <CurrencyInput
            value={form.helper}
            onValueChange={(value) => setForm((prev) => ({ ...prev, helper: value }))}
            className="h-12 w-full rounded-lg border bg-background px-3 text-base"
          />
        </label>
      </div>

      <div className="mt-5 rounded-lg border bg-muted p-3 text-sm sm:text-base">
        미리보기: {previewText}
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="mt-5 h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground sm:w-56"
      >
        기본 단가 저장
      </button>

      {saved ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground sm:text-base">
          {saved}
        </p>
      ) : null}
    </section>
  )
}

export default PriceSettingsPage

