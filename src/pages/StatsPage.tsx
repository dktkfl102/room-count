import { useCallback, useMemo, useState } from "react";
import {
    createKstMidnightUtcMs,
    DAY_MS,
    startOfKstDayMs,
    startOfKstMonthMs,
    startOfKstWeekMs,
    toKstParts,
} from "@/lib/utils";
import { formatCurrency, useAppStore, type SaleRecord } from "@/store/appStore";
import DayDetailLookupCard from "../components/DayDetailLookupCard";

type StatsUnit = "day" | "week" | "month";
type StatsMetric = "sales" | "count" | "actual";

type StatsPoint = {
    key: number;
    label: string;
    total: number;
    count: number;
    actualTotal: number;
};

const UNIT_CONFIG: Record<
    StatsUnit,
    { label: string; size: number; rangeText: string }
> = {
    day: { label: "일별", size: 7, rangeText: "최근 7일" },
    week: { label: "주별", size: 8, rangeText: "최근 8주" },
    month: { label: "월별", size: 6, rangeText: "최근 6개월" },
};

const getBucketStartMs = (date: Date, unit: StatsUnit) => {
    if (unit === "day") {
        return startOfKstDayMs(date);
    }
    if (unit === "week") {
        return startOfKstWeekMs(date);
    }
    return startOfKstMonthMs(date);
};

const moveBucketMs = (
    bucketStartMs: number,
    unit: StatsUnit,
    amount: number,
) => {
    if (unit === "day") {
        return bucketStartMs + amount * DAY_MS;
    }
    if (unit === "week") {
        return bucketStartMs + amount * 7 * DAY_MS;
    }
    const { year, month } = toKstParts(bucketStartMs);
    return createKstMidnightUtcMs(year, month + amount, 1);
};

const formatBucketLabel = (bucketStartMs: number, unit: StatsUnit) => {
    const { month, day } = toKstParts(bucketStartMs);
    if (unit === "day") {
        return `${month}/${day}`;
    }
    if (unit === "week") {
        return `${month}월 ${day}일~`;
    }
    return `${month}월`;
};

const formatMetricValue = (metric: StatsMetric, value: number) => {
    if (metric === "sales" || metric === "actual") {
        return `${formatCurrency(Math.round(value))}원`;
    }
    return `${Math.round(value).toLocaleString()}건`;
};

function StatsPage() {
    const salesHistory = useAppStore((state) => state.salesHistory);
    const priceItems = useAppStore((state) => state.priceItems);
    const [unit, setUnit] = useState<StatsUnit>("day");
    const [metric, setMetric] = useState<StatsMetric>("sales");
    const includedItemIds = useMemo(
        () =>
            new Set(
                priceItems
                    .filter((item) => item.includeInActualSales !== false)
                    .map((item) => item.id),
            ),
        [priceItems],
    );
    const includedItemNames = useMemo(
        () =>
            new Set(
                priceItems
                    .filter((item) => item.includeInActualSales !== false)
                    .map((item) => item.name.trim()),
            ),
        [priceItems],
    );

    const getActualSaleAmount = useCallback(
        (sale: SaleRecord) =>
            sale.items.reduce((sum, item) => {
                const byId = item.itemId ? includedItemIds.has(item.itemId) : false;
                const byName = includedItemNames.has(item.itemName.trim());
                if (!byId && !byName) {
                    return sum;
                }
                return sum + item.unitPrice * item.quantity;
            }, 0),
        [includedItemIds, includedItemNames],
    );

    const points = useMemo(() => {
        const now = new Date();
        const currentStart = getBucketStartMs(now, unit);
        const { size } = UNIT_CONFIG[unit];
        const starts = Array.from({ length: size }, (_, index) =>
            moveBucketMs(currentStart, unit, index - (size - 1)),
        );

        const baseMap = new Map<number, StatsPoint>(
            starts.map((start) => [
                start,
                {
                    key: start,
                    label: formatBucketLabel(start, unit),
                    total: 0,
                    count: 0,
                    actualTotal: 0,
                },
            ]),
        );

        for (const sale of salesHistory) {
            // Use room session start_at as the statistical date basis.
            const baseDate = new Date(sale.startTime);
            const key = getBucketStartMs(baseDate, unit);
            const target = baseMap.get(key);
            if (!target) {
                continue;
            }
            target.total += sale.total;
            target.count += 1;
            target.actualTotal += getActualSaleAmount(sale);
        }

        return starts
            .map((start) => baseMap.get(start))
            .filter((point): point is StatsPoint => Boolean(point));
    }, [getActualSaleAmount, salesHistory, unit]);

    const totals = useMemo(() => {
        const totalSales = points.reduce((sum, point) => sum + point.total, 0);
        const totalCount = points.reduce((sum, point) => sum + point.count, 0);
        const actualSales = points.reduce(
            (sum, point) => sum + point.actualTotal,
            0,
        );
        return { totalSales, totalCount, actualSales };
    }, [points]);

    const graphValues = points.map((point) => {
        if (metric === "sales") {
            return point.total;
        }
        if (metric === "count") {
            return point.count;
        }
        return point.actualTotal;
    });
    const maxValue = Math.max(...graphValues, 1);

    return (
        <section className="mx-auto w-full max-w-4xl">
            <h2 className="text-xl font-bold sm:text-2xl">통계</h2>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {UNIT_CONFIG[unit].rangeText} 기준으로 핵심 지표를 확인할 수
                있습니다.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border p-1 sm:w-fit">
                {(["day", "week", "month"] as StatsUnit[]).map((nextUnit) => (
                    <button
                        key={nextUnit}
                        type="button"
                        onClick={() => setUnit(nextUnit)}
                        className={[
                            "h-10 rounded-md px-4 text-sm font-semibold sm:text-base",
                            unit === nextUnit
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted",
                        ].join(" ")}
                    >
                        {UNIT_CONFIG[nextUnit].label}
                    </button>
                ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">
                        선택 기간 매출
                    </p>
                    <p className="mt-2 text-xl font-bold sm:text-2xl">
                        {formatCurrency(totals.totalSales)}원
                    </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">정산 건수</p>
                    <p className="mt-2 text-xl font-bold sm:text-2xl">
                        {totals.totalCount.toLocaleString()}건
                    </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">실제매출</p>
                    <p className="mt-2 text-xl font-bold sm:text-2xl">
                        {formatCurrency(totals.actualSales)}원
                    </p>
                </div>
            </div>

            <div className="mt-5 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold sm:text-lg">
                        추이 그래프
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                        {(
                            [
                                ["sales", "매출"],
                                ["count", "정산건수"],
                                ["actual", "실제매출"],
                            ] as [StatsMetric, string][]
                        ).map(([nextMetric, label]) => (
                            <button
                                key={nextMetric}
                                type="button"
                                onClick={() => setMetric(nextMetric)}
                                className={[
                                    "h-9 rounded-md border px-3 text-xs font-semibold sm:text-sm",
                                    metric === nextMetric
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-background",
                                ].join(" ")}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div
                    className="mt-4 grid h-52 items-end gap-2 sm:gap-3"
                    style={{
                        gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
                    }}
                >
                    {points.map((point, index) => {
                        const value = graphValues[index] ?? 0;
                        const heightPercent =
                            value > 0
                                ? Math.max(8, (value / maxValue) * 100)
                                : 0;
                        return (
                            <div
                                key={point.key}
                                className="flex h-full flex-col items-center justify-end gap-1"
                            >
                                <div className="text-[10px] text-muted-foreground sm:text-xs">
                                    {value > 0
                                        ? formatMetricValue(metric, value)
                                        : "-"}
                                </div>
                                <div className="flex h-36 w-full items-end rounded-md bg-muted/40 px-1">
                                    <div
                                        className="w-full rounded-sm bg-primary"
                                        style={{ height: `${heightPercent}%` }}
                                    />
                                </div>
                                <div className="text-[10px] text-muted-foreground sm:text-xs">
                                    {point.label}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {unit === "day" ? (
                <DayDetailLookupCard
                    salesHistory={salesHistory}
                    getActualSaleAmount={getActualSaleAmount}
                />
            ) : null}
        </section>
    );
}

export default StatsPage;
