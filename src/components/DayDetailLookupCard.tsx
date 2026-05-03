import { useEffect, useMemo, useState } from "react";
import {
    convertToKST,
    createKstMidnightUtcMs,
    startOfKstDayMs,
    toKstParts,
} from "@/lib/utils";
import { formatCurrency, type SaleRecord } from "@/store/appStore";

type DayDetailRecord = {
    id: string;
    roomName: string;
    startTimeLabel: string;
    total: number;
    actualTotal: number;
    cashAmount: number;
    cardAmount: number;
    memo: string;
    itemSummary: string;
};

type DayDetailLookupCardProps = {
    salesHistory: SaleRecord[];
    getActualSaleAmount: (sale: SaleRecord) => number;
};

const RECENT_DATES_STORAGE_KEY = "stats:recentDates";

const normalizeDateDigits = (value: string) =>
    value.replace(/\D/g, "").slice(0, 8);

const formatDateInputValue = (digits: string) => {
    if (digits.length <= 4) {
        return digits;
    }
    if (digits.length <= 6) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
};

const parseDateDigitsToDayStartMs = (digits: string) => {
    if (!/^\d{8}$/.test(digits)) {
        return null;
    }
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    const day = Number(digits.slice(6, 8));
    const dayStartMs = createKstMidnightUtcMs(year, month, day);
    const kstParts = toKstParts(dayStartMs);
    if (
        kstParts.year !== year ||
        kstParts.month !== month ||
        kstParts.day !== day
    ) {
        return null;
    }
    return dayStartMs;
};

const formatKstDateLabel = (dayStartMs: number) => {
    const kstDate = convertToKST(dayStartMs);
    const { year, month, day } = toKstParts(dayStartMs);
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")} (${
        dayNames[kstDate.getUTCDay()]
    })`;
};

const formatKstTimeLabel = (date: Date | string | number) => {
    const kstDate = convertToKST(date);
    const hours = String(kstDate.getUTCHours()).padStart(2, "0");
    const minutes = String(kstDate.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
};

function DayDetailLookupCard(props: DayDetailLookupCardProps) {
    const { salesHistory, getActualSaleAmount } = props;
    const [dateInputDigits, setDateInputDigits] = useState("");
    const [searchedDayStartMs, setSearchedDayStartMs] = useState<number | null>(
        null,
    );
    const [searchError, setSearchError] = useState<string | null>(null);
    const [recentDates, setRecentDates] = useState<string[]>([]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        try {
            const raw = window.localStorage.getItem(RECENT_DATES_STORAGE_KEY);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return;
            }
            const safeDates = parsed
                .filter((value): value is string => /^\d{8}$/.test(value))
                .slice(0, 3);
            setRecentDates(safeDates);
        } catch {
            // Ignore broken localStorage payload.
        }
    }, []);

    const searchedDayDetail = useMemo(() => {
        if (searchedDayStartMs === null) {
            return null;
        }
        const records: DayDetailRecord[] = salesHistory
            .filter(
                (sale) =>
                    startOfKstDayMs(sale.startTime) === searchedDayStartMs,
            )
            .map((sale) => {
                const itemSummary = sale.items
                    .filter((item) => item.quantity > 0)
                    .map((item) => `${item.itemName} x${item.quantity}`)
                    .join(", ");
                return {
                    id: sale.id,
                    roomName: sale.roomName,
                    startTimeLabel: formatKstTimeLabel(sale.startTime),
                    total: sale.total,
                    actualTotal: getActualSaleAmount(sale),
                    cashAmount: sale.cashAmount,
                    cardAmount: sale.cardAmount,
                    memo: sale.memo.trim(),
                    itemSummary,
                };
            })
            .sort((a, b) => a.startTimeLabel.localeCompare(b.startTimeLabel));

        const totalSales = records.reduce((sum, record) => sum + record.total, 0);
        const totalCount = records.length;
        const actualSales = records.reduce(
            (sum, record) => sum + record.actualTotal,
            0,
        );

        return {
            label: formatKstDateLabel(searchedDayStartMs),
            totalSales,
            totalCount,
            actualSales,
            records,
        };
    }, [getActualSaleAmount, salesHistory, searchedDayStartMs]);

    const saveRecentDate = (digits: string) => {
        setRecentDates((prev) => {
            const next = [digits, ...prev.filter((value) => value !== digits)].slice(
                0,
                3,
            );
            if (typeof window !== "undefined") {
                window.localStorage.setItem(
                    RECENT_DATES_STORAGE_KEY,
                    JSON.stringify(next),
                );
            }
            return next;
        });
    };

    const runDateSearch = (targetDigits: string) => {
        if (targetDigits.length !== 8) {
            setSearchError("날짜는 yyyymmdd 8자리 숫자로 입력해 주세요.");
            return;
        }
        const parsedDayStartMs = parseDateDigitsToDayStartMs(targetDigits);
        if (parsedDayStartMs === null) {
            setSearchError("존재하지 않는 날짜예요.");
            return;
        }
        setSearchError(null);
        setSearchedDayStartMs(parsedDayStartMs);
        saveRecentDate(targetDigits);
    };

    return (
        <div className="mt-5 rounded-lg border p-4">
            <h3 className="text-base font-semibold sm:text-lg">과거 날짜 상세 조회</h3>
            <p className="mt-1 text-sm text-muted-foreground">
                날짜를 입력하고 조회 버튼을 눌러 확인해 주세요.
            </p>

            <form
                className="mt-4 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    runDateSearch(dateInputDigits);
                }}
            >
                <input
                    type="text"
                    inputMode="numeric"
                    value={formatDateInputValue(dateInputDigits)}
                    onChange={(event) => {
                        setDateInputDigits(normalizeDateDigits(event.target.value));
                        if (searchError) {
                            setSearchError(null);
                        }
                    }}
                    className="h-10 w-44 rounded-md border px-3 text-sm sm:text-base"
                    placeholder="예) 20260503"
                    aria-label="조회 날짜 입력"
                />
                <button
                    type="submit"
                    className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground sm:text-base"
                >
                    조회
                </button>
            </form>

            {recentDates.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground sm:text-sm">
                        최근 조회
                    </span>
                    {recentDates.map((digits) => (
                        <button
                            key={digits}
                            type="button"
                            onClick={() => {
                                setDateInputDigits(digits);
                                runDateSearch(digits);
                            }}
                            className="h-8 rounded-full border px-3 text-xs font-semibold hover:bg-muted sm:text-sm"
                        >
                            {formatDateInputValue(digits)}
                        </button>
                    ))}
                </div>
            ) : null}

            {searchError ? (
                <p className="mt-3 text-sm text-destructive">{searchError}</p>
            ) : null}

            {searchedDayDetail ? (
                <div className="mt-4 space-y-3">
                    <div className="rounded-md bg-muted/30 p-3 text-sm font-semibold sm:text-base">
                        조회 날짜: {searchedDayDetail.label}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="rounded-md border bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground sm:text-sm">
                                매출
                            </p>
                            <p className="mt-1 text-sm font-bold sm:text-base">
                                {formatCurrency(searchedDayDetail.totalSales)}원
                            </p>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground sm:text-sm">
                                정산 건수
                            </p>
                            <p className="mt-1 text-sm font-bold sm:text-base">
                                {searchedDayDetail.totalCount.toLocaleString()}건
                            </p>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground sm:text-sm">
                                실제매출
                            </p>
                            <p className="mt-1 text-sm font-bold sm:text-base">
                                {formatCurrency(searchedDayDetail.actualSales)}원
                            </p>
                        </div>
                    </div>

                    {searchedDayDetail.records.length === 0 ? (
                        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                            해당 날짜 정산 내역이 없어요.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {searchedDayDetail.records.map((record) => (
                                <div key={record.id} className="rounded-md border p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold sm:text-base">
                                            {record.roomName}
                                        </p>
                                        <p className="text-xs text-muted-foreground sm:text-sm">
                                            {record.startTimeLabel}
                                        </p>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 sm:text-sm">
                                        <p>매출 {formatCurrency(record.total)}원</p>
                                        <p>실매출 {formatCurrency(record.actualTotal)}원</p>
                                        <p>현금 {formatCurrency(record.cashAmount)}원</p>
                                        <p>카드 {formatCurrency(record.cardAmount)}원</p>
                                    </div>
                                    {record.itemSummary ? (
                                        <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                                            품목: {record.itemSummary}
                                        </p>
                                    ) : null}
                                    {record.memo ? (
                                        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                                            메모: {record.memo}
                                        </p>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}

export default DayDetailLookupCard;
