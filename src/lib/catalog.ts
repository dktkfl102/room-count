import { supabase } from "@/lib/supabase"

export type CatalogItem = {
  id: string
  name: string
  unit: string
  price: number
  category: string
  displayOrder: number
  isActive: boolean
}

type CatalogRow = {
  id: string
  category: string | null
  name: string
  unit: string | null
  default_unit_price: number
  display_order: number | null
  is_active: boolean
}

const DEFAULT_CATEGORY_ORDER = ["time", "drink", "soju", "beer"]

export const DEFAULT_CATALOG_ITEMS: CatalogItem[] = [
  {
    id: "default-time",
    name: "시간",
    unit: "시간",
    price: 30000,
    category: "time",
    displayOrder: 0,
    isActive: true,
  },
  {
    id: "default-drink",
    name: "음료",
    unit: "개",
    price: 5000,
    category: "drink",
    displayOrder: 1,
    isActive: true,
  },
  {
    id: "default-soju",
    name: "소주",
    unit: "개",
    price: 10000,
    category: "soju",
    displayOrder: 2,
    isActive: true,
  },
  {
    id: "default-beer",
    name: "맥주",
    unit: "개",
    price: 5000,
    category: "beer",
    displayOrder: 3,
    isActive: true,
  },
]

const normalizeCategory = (value: string) => value.trim().toLowerCase()

const toCatalogCategory = (value: string | null): string => {
  if (!value) {
    return "etc"
  }
  const normalized = normalizeCategory(value)
  if (normalized === "time" || normalized.includes("시간")) {
    return "time"
  }
  if (normalized === "drink" || normalized.includes("음료")) {
    return "drink"
  }
  if (normalized === "soju" || normalized.includes("소주")) {
    return "soju"
  }
  if (normalized === "beer" || normalized.includes("맥주")) {
    return "beer"
  }
  return normalized || "etc"
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const toCatalogItem = (row: CatalogRow): CatalogItem => ({
  id: row.id,
  name: row.name?.trim() || "품목",
  unit: row.unit?.trim() || "개",
  price: Math.max(0, Number(row.default_unit_price) || 0),
  category: toCatalogCategory(row.category ?? row.name),
  displayOrder: Math.max(0, row.display_order ?? 0),
  isActive: row.is_active,
})

const sortCatalogItems = (items: CatalogItem[]) =>
  [...items].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder
    }
    return a.name.localeCompare(b.name, "ko")
  })

const cloneDefaultItems = () => DEFAULT_CATALOG_ITEMS.map((item) => ({ ...item }))

const hasTimeItem = (items: CatalogItem[]) =>
  items.some((item) => toCatalogCategory(item.category ?? item.name) === "time")

const ensureTimeItem = (items: CatalogItem[]) => {
  if (hasTimeItem(items)) {
    return items
  }
  return [{ ...DEFAULT_CATALOG_ITEMS[0] }, ...items].map((item, index) => ({
    ...item,
    displayOrder: index,
  }))
}

const toAutoUnit = (category: string) => (category === "time" ? "시간" : "개")

const toPayloadCategory = (item: CatalogItem) =>
  toCatalogCategory(item.category || item.name || "etc")

export const loadCatalogItems = async (): Promise<CatalogItem[]> => {
  const { data, error } = await supabase
    .from("item_catalog")
    .select("id, category, name, unit, default_unit_price, display_order, is_active")
    .eq("is_active", true)
    .order("display_order", { ascending: true })

  if (error || !data || data.length === 0) {
    const defaults = cloneDefaultItems()
    try {
      await supabase.from("item_catalog").insert(
        defaults.map((item, index) => ({
          name: item.name,
          unit: item.unit,
          default_unit_price: item.price,
          category: item.category,
          display_order: index,
          is_active: true,
        })),
      )
    } catch {
      // RLS/네트워크 실패 시에도 앱은 fallback 기본값으로 동작합니다.
    }
    return defaults
  }

  const rows = data as CatalogRow[]
  const mapped = rows.map(toCatalogItem).filter((item) => item.isActive)
  if (mapped.length === 0) {
    return cloneDefaultItems()
  }
  return sortCatalogItems(ensureTimeItem(mapped))
}

export const saveCatalogItems = async (items: CatalogItem[]) => {
  const normalized = ensureTimeItem(items)
    .map((item, index) => ({
      ...item,
      name: item.name.trim() || `품목 ${index + 1}`,
      category: toPayloadCategory(item),
      unit: toAutoUnit(toPayloadCategory(item)),
      price: Math.max(0, Number(item.price) || 0),
      displayOrder: index,
      isActive: true,
    }))
    .filter((item) => item.name.length > 0)

  const ordered =
    normalized.length > 0
      ? normalized
      : cloneDefaultItems().map((item, index) => ({ ...item, displayOrder: index }))

  const { data: existingRows, error: existingError } = await supabase
    .from("item_catalog")
    .select("id")
    .eq("is_active", true)

  if (existingError) {
    throw existingError
  }

  const activeIds = new Set((existingRows ?? []).map((row) => row.id))
  const keptIds = new Set<string>()

  for (const item of ordered) {
    const payload = {
      name: item.name,
      unit: item.unit,
      default_unit_price: item.price,
      category: item.category,
      display_order: item.displayOrder,
      is_active: true,
    }

    if (isUuid(item.id)) {
      const { error: updateError } = await supabase
        .from("item_catalog")
        .update(payload)
        .eq("id", item.id)
      if (updateError) {
        throw updateError
      }
      keptIds.add(item.id)
      continue
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from("item_catalog")
      .insert(payload)
      .select("id")
      .limit(1)
    if (insertError) {
      throw insertError
    }
    const insertedId = insertedRows?.[0]?.id
    if (insertedId) {
      keptIds.add(insertedId)
    }
  }

  const idsToDeactivate = [...activeIds].filter((id) => !keptIds.has(id))
  if (idsToDeactivate.length > 0) {
    const { error: deactivateError } = await supabase
      .from("item_catalog")
      .update({ is_active: false })
      .in("id", idsToDeactivate)

    if (deactivateError) {
      throw deactivateError
    }
  }

  const refreshed = await loadCatalogItems()
  return sortCatalogItems(
    ensureTimeItem(refreshed).map((item, index) => ({
      ...item,
      displayOrder:
        DEFAULT_CATEGORY_ORDER.indexOf(item.category) >= 0
          ? DEFAULT_CATEGORY_ORDER.indexOf(item.category)
          : index,
    })),
  )
}

export const toPriceMapByCategory = (items: CatalogItem[]) => {
  const priceMap: Record<string, number> = {}
  for (const item of items) {
    priceMap[item.category] = item.price
  }
  return priceMap
}
