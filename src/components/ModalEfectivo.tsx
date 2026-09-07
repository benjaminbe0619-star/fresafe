import { useState } from 'react'
import { DENOMINATIONS, Denomination } from '../lib/denominations'
import { formatMXN } from '../lib/money'

type Props = {
  totalCents: number
  onCancel: () => void
  onConfirm: (
    receivedCents: number,
    denominations: { id: string; cents: number; qty: number }[],
  ) => void
}

export default function ModalEfectivo({ totalCents, onCancel, onConfirm }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({})

  const inc = (id: string, delta: number) =>
    setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }))
  const toggle = (id: string) =>
    setCounts((c) => ({ ...c, [id]: (c[id] || 0) > 0 ? 0 : 1 }))

  const receivedCents = DENOMINATIONS.reduce(
    (acc, d) => acc + d.cents * (counts[d.id] || 0),
    0,
  )
  const enough = receivedCents >= totalCents
  const diff = receivedCents - totalCents

  const confirm = () => {
    const denoms = DENOMINATIONS.filter((d) => (counts[d.id] || 0) > 0).map((d) => ({
      id: d.id,
      cents: d.cents,
      qty: counts[d.id],
    }))
    onConfirm(receivedCents, denoms)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-xl font-bold">¿Con qué pagará el cliente?</h3>
          <div className="text-sm text-slate-500 mt-1">
            Total a cobrar:{' '}
            <span className="font-bold text-slate-900">{formatMXN(totalCents)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5 flex flex-col lg:flex-row gap-5">
          <div className="flex-1 min-w-0 space-y-5">
            <div>
              <h4 className="font-semibold text-xs uppercase text-slate-500 mb-3">Billetes</h4>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {DENOMINATIONS.filter((d) => d.kind === 'bill').map((d) => (
                  <DenomCard
                    key={d.id}
                    d={d}
                    qty={counts[d.id] || 0}
                    onToggle={() => toggle(d.id)}
                    onAdd={() => inc(d.id, 1)}
                    onSub={() => inc(d.id, -1)}
                  />
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-xs uppercase text-slate-500 mb-3">Monedas</h4>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {DENOMINATIONS.filter((d) => d.kind === 'coin').map((d) => (
                  <DenomCard
                    key={d.id}
                    d={d}
                    qty={counts[d.id] || 0}
                    onToggle={() => toggle(d.id)}
                    onAdd={() => inc(d.id, 1)}
                    onSub={() => inc(d.id, -1)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div
            className={
              'w-full lg:w-72 shrink-0 rounded-xl p-5 lg:self-start lg:sticky lg:top-0 border-2 ' +
              (enough ? 'bg-pink-50 border-pink-300' : 'bg-red-50 border-red-300')
            }
          >
            <div className="text-xs uppercase text-slate-600 font-semibold">Total venta</div>
            <div className="text-2xl font-bold mb-3">{formatMXN(totalCents)}</div>
            <div className="text-xs uppercase text-slate-600 font-semibold">Recibido</div>
            <div className="text-2xl font-bold mb-4">{formatMXN(receivedCents)}</div>
            <div className="border-t border-slate-200 pt-3">
              {enough ? (
                <>
                  <div className="text-sm text-slate-900 font-semibold uppercase">
                    Cambio a entregar
                  </div>
                  <div className="text-4xl font-bold text-slate-900">{formatMXN(diff)}</div>
                </>
              ) : (
                <>
                  <div className="text-sm text-red-700 font-semibold uppercase">Faltan</div>
                  <div className="text-4xl font-bold text-red-600">{formatMXN(-diff)}</div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-100 hover:bg-slate-200 font-semibold py-3 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={!enough}
            className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg"
          >
            Cobrar
          </button>
        </div>
      </div>
    </div>
  )
}

function DenomCard({
  d,
  qty,
  onToggle,
  onAdd,
  onSub,
}: {
  d: Denomination
  qty: number
  onToggle: () => void
  onAdd: () => void
  onSub: () => void
}) {
  const selected = qty > 0
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onToggle}
        className={
          'relative rounded-lg overflow-hidden border-2 cursor-pointer select-none w-full transition active:scale-95 ' +
          (selected
            ? 'bg-violet-50 border-violet-500 ring-2 ring-violet-300'
            : 'bg-white border-slate-200 hover:border-slate-200')
        }
        aria-label={selected ? `Deseleccionar ${d.label}` : `Seleccionar ${d.label}`}
      >
        <span className="pointer-events-none flex flex-col items-center justify-center px-2 py-2 h-24">
          <img
            src={d.img}
            alt={d.label}
            draggable={false}
            loading="eager"
            decoding="async"
            className="max-h-14 max-w-full object-contain pointer-events-none select-none"
          />
          <span
            className={
              'text-xs font-semibold mt-1 ' +
              (selected ? 'text-violet-800' : 'text-slate-600')
            }
          >
            {d.label}
          </span>
        </span>
      </button>
      <div className="h-7 mt-1 flex items-center gap-1.5">
        {selected && (
          <>
            <button
              type="button"
              onClick={onSub}
              className="w-6 h-6 rounded bg-red-100 hover:bg-red-200 text-red-700 font-bold text-sm flex items-center justify-center leading-none"
              aria-label={`Quitar uno de ${d.label}`}
            >
              −
            </button>
            <span className="text-base font-bold text-slate-900 leading-none w-5 text-center">
              {qty}
            </span>
            <button
              type="button"
              onClick={onAdd}
              className="w-6 h-6 rounded bg-pink-100 hover:bg-pink-200 text-slate-900 font-bold text-sm flex items-center justify-center leading-none"
              aria-label={`Agregar uno de ${d.label}`}
            >
              +
            </button>
          </>
        )}
      </div>
    </div>
  )
}
