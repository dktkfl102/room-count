import { useEffect, useState } from "react"
import CurrencyInput from "@/components/CurrencyInput"
import type { CatalogItem } from "@/lib/catalog"
import {
  DEFAULT_CATALOG_ITEMS,
  loadCatalogItems,
  saveCatalogItems,
} from "@/lib/catalog"
import { useAppStore } from "@/store/appStore"

function PriceSettingsPage() {
  const priceItems = useAppStore((state) => state.priceItems)
  const setPriceItems = useAppStore((state) => state.setPriceItems)

  const [formItems, setFormItems] = useState<CatalogItem[]>([])
  const [saved, setSaved] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let mounted = true

    const syncCatalog = async () => {
      const nextItems = await loadCatalogItems()
      if (!mounted) {
        return
      }
      setFormItems(nextItems)
      setPriceItems(nextItems)
      setIsLoading(false)
    }

    void syncCatalog()
    return () => {
      mounted = false
    }
  }, [setPriceItems])

  useEffect(() => {
    if (priceItems.length === 0) {
      return
    }
    setFormItems(priceItems)
  }, [priceItems])

  const handleSave = async () => {
    if (isSaving) {
      return
    }
    setIsSaving(true)
    try {
      const nextItems = await saveCatalogItems(formItems)
      setFormItems(nextItems)
      setPriceItems(nextItems)
      setSaved("단가 품목을 저장했습니다.")
    } catch {
      setSaved("저장에 실패했습니다. 네트워크/권한을 확인해 주세요.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangeItem = <K extends keyof CatalogItem>(
    index: number,
    key: K,
    value: CatalogItem[K],
  ) => {
    setFormItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value,
            }
          : item,
      ),
    )
  }

  const handleAddItem = () => {
    setFormItems((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        name: `품목 ${prev.length + 1}`,
        unit: "개",
        price: 0,
        category: `etc-${Date.now()}`,
        displayOrder: prev.length,
        isActive: true,
      },
    ])
  }

  const handleRemoveItem = (id: string) => {
    setFormItems((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target?.category === "time") {
        setSaved("시간 품목은 기본값으로 유지되며 삭제할 수 없습니다.")
        return prev
      }
      const next = prev.filter((item) => item.id !== id)
      if (next.length === 0) {
        return DEFAULT_CATALOG_ITEMS.map((item) => ({ ...item }))
      }
      return next.map((item, index) => ({ ...item, displayOrder: index }))
    })
  }

  const handleResetToDefault = () => {
    setFormItems(DEFAULT_CATALOG_ITEMS.map((item) => ({ ...item })))
    setSaved("기본값(시간/음료/소주/맥주)으로 되돌렸습니다. 저장 버튼을 눌러 반영해 주세요.")
  }

  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-2xl">
        <h2 className="text-xl font-bold sm:text-2xl">가격표 설정</h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">품목 정보를 불러오는 중입니다.</p>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-2xl">
      <h2 className="text-xl font-bold sm:text-2xl">가격표 설정</h2>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">
        시간 품목은 기본 포함되며 단위는 자동 적용됩니다.
      </p>

      <div className="mt-5 space-y-3">
        {formItems.map((item, index) => (
          <div
            key={item.id}
            className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_160px_auto]"
          >
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">품목명</span>
              <input
                value={item.name}
                onChange={(event) => handleChangeItem(index, "name", event.target.value)}
                className="h-11 w-full rounded-lg border bg-background px-3 text-base"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">단가</span>
              <CurrencyInput
                value={item.price}
                onValueChange={(value) => handleChangeItem(index, "price", value)}
                className="h-11 w-full rounded-lg border bg-background px-3 text-base"
              />
            </label>
            <button
              type="button"
              onClick={() => handleRemoveItem(item.id)}
              disabled={item.category === "time"}
              className="h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-40"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddItem}
        className="mt-4 h-12 w-full rounded-lg border text-base font-semibold sm:w-56"
      >
        품목 추가
      </button>

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="mt-5 h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-50 sm:w-56"
      >
        {isSaving ? "저장 중..." : "품목 저장"}
      </button>
      <button
        type="button"
        onClick={handleResetToDefault}
        className="mt-2 h-12 w-full rounded-lg border text-base font-semibold sm:w-56"
      >
        기본값 되돌리기
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

