export const formatNumberWithComma = (value: number) =>
  new Intl.NumberFormat("ko-KR").format(Math.max(0, Math.floor(value || 0)))

export const parseNumberFromInput = (value: string) => {
  const digitsOnly = value.replace(/[^\d]/g, "")
  if (!digitsOnly) {
    return 0
  }
  return Number(digitsOnly)
}

