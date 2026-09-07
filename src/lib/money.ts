const fmt = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatMXN = (cents: number): string => fmt.format(cents / 100)

export const parseToCents = (input: string): number => {
  const cleaned = String(input).replace(/[^\d.-]/g, '')
  const n = parseFloat(cleaned)
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100)
}

// Formatea mientras se escribe: comas de miles automáticas y máximo 2 decimales.
// "1234567.891" -> "1,234,567.89"
export const formatAmountInput = (raw: string): string => {
  let v = String(raw).replace(/[^\d.]/g, '')
  const firstDot = v.indexOf('.')
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '')
  }
  const [intRaw, dec] = v.split('.')
  const int = intRaw.replace(/^0+(?=\d)/, '')
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (dec !== undefined) return `${withCommas}.${dec.slice(0, 2)}`
  return withCommas
}
