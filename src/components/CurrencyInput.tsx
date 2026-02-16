import { parseNumberFromInput, formatNumberWithComma } from "@/lib/number"

type CurrencyInputProps = {
  value: number
  onValueChange: (value: number) => void
  className?: string
  placeholder?: string
  readOnly?: boolean
}

function CurrencyInput({
  value,
  onValueChange,
  className,
  placeholder,
  readOnly = false,
}: CurrencyInputProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatNumberWithComma(value)}
      onChange={(event) => onValueChange(parseNumberFromInput(event.target.value))}
      className={className}
      placeholder={placeholder}
      readOnly={readOnly}
    />
  )
}

export default CurrencyInput

