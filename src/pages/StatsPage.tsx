import { useCallback, useMemo, useState } from "react";
import {
    createKstMidnightUtcMs,
    DAY_MS,
    startOfKstDayMs,
    startOfKstMonthMs,
    startOfKstWeekMs,
    toKstParts,
} from "@/lib/utils";
import {
    formatCurrency,
    useAppStore,
    type BusinessSession,
    type SaleRecord,
} from "@/store/appStore";
import DayDetailLookupCard from "../components/DayDetailLookupCard";

type StatsUnit = "day" | "week" | "month";
type StatsMetric = "sales" | "count" | "actual";

type StatsPoint = {
    key: number;
    label: string;
    total: number;
    count: number;
    actualTotal: number;
    cardTotal: number;
    cashTotal: number;
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

const formatWonValue = (value: number) =>
    `${formatCurrency(Math.round(value))}원`;

function StatsPage() {
    const salesHistory = useAppStore((state) => state.salesHistory);
    const businessSessions = useAppStore((state) => state.businessSessions);
    const priceItems = useAppStore((state) => state.priceItems);
    const [unit, setUnit] = useState<StatsUnit>("day");
    const [metric, setMetric] = useState<StatsMetric>("sales");
    const [offset, setOffset] = useState(0);
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
                const byId = item.itemId
                    ? includedItemIds.has(item.itemId)
                    : false;
                const byName = includedItemNames.has(item.itemName.trim());
                if (!byId && !byName) {
                    return sum;
                }
                return sum + item.unitPrice * item.quantity;
            }, 0),
        [includedItemIds, includedItemNames],
    );
    const sessionStartTimeById = useMemo(
        () =>
            new Map(
                businessSessions.map((session: BusinessSession) => [
                    session.id,
                    session.startTime,
                ]),
            ),
        [businessSessions],
    );

    const earliestDataMs = useMemo(() => {
        let min: number | null = null;
        for (const sale of salesHistory) {
            const sessionStartTime = sale.businessSessionId
                ? sessionStartTimeById.get(sale.businessSessionId)
                : null;
            const ms = new Date(sessionStartTime ?? sale.startTime).getTime();
            if (min === null || ms < min) {
                min = ms;
            }
        }
        return min;
    }, [salesHistory, sessionStartTimeById]);

    const earliestBucketStartMs = useMemo(
        () =>
            earliestDataMs === null
                ? null
                : getBucketStartMs(new Date(earliestDataMs), unit),
        [earliestDataMs, unit],
    );

    const points = useMemo(() => {
        const now = new Date();
        const currentStart = getBucketStartMs(now, unit);
        const { size } = UNIT_CONFIG[unit];
        const pivotStart = moveBucketMs(currentStart, unit, offset);
        const starts = Array.from({ length: size }, (_, index) =>
            moveBucketMs(pivotStart, unit, index - (size - 1)),
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
                    cardTotal: 0,
                    cashTotal: 0,
                },
            ]),
        );

        for (const sale of salesHistory) {
            const sessionStartTime = sale.businessSessionId
                ? sessionStartTimeById.get(sale.businessSessionId)
                : null;
            const baseDate = new Date(sessionStartTime ?? sale.startTime);
            const key = getBucketStartMs(baseDate, unit);
            const target = baseMap.get(key);
            if (!target) {
                continue;
            }
            target.total += sale.total;
            target.count += 1;
            target.actualTotal += getActualSaleAmount(sale);
            target.cardTotal += sale.cardAmount;
            target.cashTotal += sale.cashAmount;
        }

        return starts
            .map((start) => baseMap.get(start))
            .filter((point): point is StatsPoint => Boolean(point));
    }, [getActualSaleAmount, offset, salesHistory, sessionStartTimeById, unit]);

    const canGoNext = offset < 0;
    const canGoPrev =
        earliestBucketStartMs !== null &&
        points.length > 0 &&
        earliestBucketStartMs < points[0].key;

    const goToPrevPeriod = () => {
        setOffset((prev) => prev - UNIT_CONFIG[unit].size);
    };
    const goToNextPeriod = () => {
        setOffset((prev) => Math.min(0, prev + UNIT_CONFIG[unit].size));
    };

    const totals = useMemo(() => {
        const totalSales = points.reduce((sum, point) => sum + point.total, 0);
        const totalCount = points.reduce((sum, point) => sum + point.count, 0);
        const actualSales = points.reduce(
            (sum, point) => sum + point.actualTotal,
            0,
        );
        return { totalSales, totalCount, actualSales };
    }, [points]);

    const yearToDate = useMemo(() => {
        const { year, month } = toKstParts(new Date());
        const result = {
            year,
            month,
            total: 0,
            count: 0,
            actualTotal: 0,
            cardTotal: 0,
            cashTotal: 0,
        };
        for (const sale of salesHistory) {
            const sessionStartTime = sale.businessSessionId
                ? sessionStartTimeById.get(sale.businessSessionId)
                : null;
            const baseDate = new Date(sessionStartTime ?? sale.startTime);
            if (toKstParts(baseDate).year !== year) {
                continue;
            }
            result.total += sale.total;
            result.count += 1;
            result.actualTotal += getActualSaleAmount(sale);
            result.cardTotal += sale.cardAmount;
            result.cashTotal += sale.cashAmount;
        }
        return result;
    }, [getActualSaleAmount, salesHistory, sessionStartTimeById]);

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
                {offset === 0
                    ? UNIT_CONFIG[unit].rangeText
                    : points.length > 0
                      ? `${points[0].label} ~ ${points[points.length - 1].label}`
                      : UNIT_CONFIG[unit].rangeText}{" "}
                기준으로 핵심 지표를 확인할 수 있습니다.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border p-1 sm:w-fit">
                {(["day", "week", "month"] as StatsUnit[]).map((nextUnit) => (
                    <button
                        key={nextUnit}
                        type="button"
                        onClick={() => {
                            setUnit(nextUnit);
                            setOffset(0);
                        }}
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

                <div className="mt-3 flex items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={goToPrevPeriod}
                        disabled={!canGoPrev}
                        aria-label="이전 기간"
                        className="h-8 w-8 rounded-md border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        ◀
                    </button>
                    <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                        {points.length > 0
                            ? `${points[0].label} ~ ${points[points.length - 1].label}`
                            : UNIT_CONFIG[unit].rangeText}
                    </span>
                    <button
                        type="button"
                        onClick={goToNextPeriod}
                        disabled={!canGoNext}
                        aria-label="다음 기간"
                        className="h-8 w-8 rounded-md border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        ▶
                    </button>
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
                                className="flex h-full flex-col items-center justify-end gap-2"
                            >
                                <div className="min-h-[2.75rem] text-center text-[10px] text-muted-foreground sm:text-xs">
                                    {value > 0 ? (
                                        metric === "sales" ? (
                                            <div className="space-y-0.5">
                                                <div>
                                                    총{" "}
                                                    {formatMetricValue(
                                                        metric,
                                                        value,
                                                    )}
                                                </div>
                                                <div>
                                                    카드{" "}
                                                    {formatWonValue(
                                                        point.cardTotal,
                                                    )}
                                                </div>
                                                <div>
                                                    현금{" "}
                                                    {formatWonValue(
                                                        point.cashTotal,
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            formatMetricValue(metric, value)
                                        )
                                    ) : (
                                        "-"
                                    )}
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

            {unit === "month" ? (
                <div className="mt-5 rounded-lg border p-4">
                    <h3 className="text-base font-semibold sm:text-lg">
                        {yearToDate.year}년 누적 (
                        {yearToDate.month === 1
                            ? "1월"
                            : `1~${yearToDate.month}월`}
                        )
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border bg-muted/30 p-4">
                            <p className="text-sm text-muted-foreground">
                                누적 매출
                            </p>
                            <p className="mt-2 text-xl font-bold sm:text-2xl">
                                {formatWonValue(yearToDate.total)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                                카드 {formatWonValue(yearToDate.cardTotal)} ·
                                현금 {formatWonValue(yearToDate.cashTotal)}
                            </p>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                            <p className="text-sm text-muted-foreground">
                                누적 정산 건수
                            </p>
                            <p className="mt-2 text-xl font-bold sm:text-2xl">
                                {yearToDate.count.toLocaleString()}건
                            </p>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-4">
                            <p className="text-sm text-muted-foreground">
                                누적 실제매출
                            </p>
                            <p className="mt-2 text-xl font-bold sm:text-2xl">
                                {formatWonValue(yearToDate.actualTotal)}
                            </p>
                        </div>
                    </div>
                </div>
            ) : null}

            {unit === "day" ? (
                <DayDetailLookupCard
                    salesHistory={salesHistory}
                    businessSessions={businessSessions}
                    getActualSaleAmount={getActualSaleAmount}
                />
            ) : null}
        </section>
    );
}

export default StatsPage;
