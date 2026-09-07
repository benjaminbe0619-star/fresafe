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
