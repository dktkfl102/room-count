import { clsx } from "clsx"
import type { ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

export const convertToKST = (date: Date | string | number) => {
  const utcDate = new Date(date)
  return new Date(utcDate.getTime() + KST_OFFSET_MS)
}

export const toKstParts = (date: Date | string | number) => {
  const kstDate = convertToKST(date)
  return {
    year: kstDate.getUTCFullYear(),
    month: kstDate.getUTCMonth() + 1,
    day: kstDate.getUTCDate(),
  }
}

export const createKstMidnightUtcMs = (year: number, month: number, day: number) =>
  Date.UTC(year, month - 1, day) - KST_OFFSET_MS

export const startOfKstDayMs = (date: Date | string | number) => {
  const { year, month, day } = toKstParts(date)
  return createKstMidnightUtcMs(year, month, day)
}

export const startOfKstWeekMs = (date: Date | string | number) => {
  const dayStartMs = startOfKstDayMs(date)
  const dayOfWeek = convertToKST(dayStartMs).getUTCDay()
  const mondayOffset = (dayOfWeek + 6) % 7
  return dayStartMs - mondayOffset * DAY_MS
}

export const startOfKstMonthMs = (date: Date | string | number) => {
  const { year, month } = toKstParts(date)
  return createKstMidnightUtcMs(year, month, 1)
}

