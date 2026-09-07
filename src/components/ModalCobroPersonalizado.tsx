import { useState } from 'react'
import { formatMXN, parseToCents } from '../lib/money'
import { useStore } from '../store/useStore'

// Cobro de un monto libre con tarjeta (sin pasar por el catálogo).
export default function ModalCobroPersonalizado({
  onCancel,
  onCharge,
}: {
  onCancel: () => void
  onCharge: (amountCents: number, concept: string) => void
}) {
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const commissionPercent = useStore((s) => s.cardCommissionPercent)

  const amountCents = parseToCents(amount)
  const valid = amountCents >= 500 // mínimo $5.00 de MP Point
  const commissionCents = Math.round((amountCents * commissionPercent) / 100)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-4">
          Cobro personalizado
        </h3>

        <div className="flex items-baseline gap-1 border-b-2 border-slate-200 focus-within:border-slate-900 transition pb-2 mb-1">
          <span className="text-3xl font-bold text-slate-300">$</span>
          <input
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) onCharge(amountCents, concept.trim())
              if (e.key === 'Escape') onCancel()
            }}
            inputMode="decimal"
            placeholder="0.00"
            className="w-full text-4xl font-bold text-slate-900 tabular-nums placeholder:text-slate-200 focus:outline-none"
          />
        </div>
        <div className="h-5 mb-3">
          {amountCents > 0 && !valid && (
            <span className="text-xs text-red-600 font-medium">El mínimo para tarjeta es $5.00</span>
          )}
          {valid && (
            <span className="text-xs text-slate-400 tabular-nums">
              Recibirás {formatMXN(amountCents - commissionCents)} (comisión MP −{formatMXN(commissionCents)})
            </span>
          )}
        </div>

        <label className="block mb-5">
          <span className="text-sm font-medium">Concepto (opcional)</span>
          <input
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ej. Evento, encargo especial…"
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400"
          />
        </label>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-100 hover:bg-slate-200 font-semibold py-3 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={() => onCharge(amountCents, concept.trim())}
            disabled={!valid}
            className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg"
          >
            Cobrar con tarjeta
          </button>
        </div>
      </div>
    </div>
  )
}
