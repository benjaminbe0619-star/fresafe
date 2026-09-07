import { useMemo, useState } from 'react'
import { useStore, RecordItem } from '../store/useStore'
import { formatMXN, parseToCents, formatAmountInput } from '../lib/money'
import { Card, ConfirmDelete, Field, FormButtons, Modal, inputCls, fmtDate } from '../components/ui'

export default function Cortes() {
  const sales = useStore((s) => s.sales)
  const records = useStore((s) => s.records)
  const changeFundCents = useStore((s) => s.changeFundCents)
  const addRecord = useStore((s) => s.addRecord)
  const deleteRecord = useStore((s) => s.deleteRecord)

  const cortes = useMemo(
    () => records.filter((r) => r.kind === 'corte').sort((a, b) => b.ts - a.ts),
    [records],
  )
  const lastCorteTs = cortes[0]?.ts ?? 0

  // Efectivo esperado: fondo de cambio + ventas en efectivo desde el último corte.
  const efectivoDesdeCorte = useMemo(
    () =>
      sales
        .filter((s) => s.method === 'efectivo' && s.timestamp > lastCorteTs)
        .reduce((a, s) => a + s.totalCents, 0),
    [sales, lastCorteTs],
  )
  const esperadoCents = changeFundCents + efectivoDesdeCorte

  const [open, setOpen] = useState(false)
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [toDelete, setToDelete] = useState<RecordItem | null>(null)

  const openNew = () => {
    setCounted('')
    setNote('')
    setOpen(true)
  }
  const save = () => {
    const countedCents = parseToCents(counted)
    if (countedCents < 0) return
    addRecord('corte', {
      expectedCents: esperadoCents,
      countedCents,
      note: note.trim() || undefined,
    }).catch((e) => alert('No se pudo guardar: ' + e.message))
    setOpen(false)
  }

  const diffOf = (r: RecordItem) => (r.data.countedCents ?? 0) - (r.data.expectedCents ?? 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
        <div className="text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400">
          Efectivo que debería haber en caja
        </div>
        <div className="text-3xl font-bold mt-1 tabular-nums">{formatMXN(esperadoCents)}</div>
        <div className="text-xs text-slate-400 mt-1">
          Fondo de cambio ({formatMXN(changeFundCents)}) + efectivo vendido desde el último corte
          {lastCorteTs > 0 ? ` (${fmtDate(lastCorteTs)})` : ''}.
        </div>
        <button
          onClick={openNew}
          className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg"
        >
          Hacer corte de caja
        </button>
      </div>

      <Card title="Historial de cortes">
        {cortes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            Al cerrar el día, cuenta el efectivo y regístralo.
          </p>
        ) : (
          <div className="space-y-1">
            {cortes.map((r) => {
              const diff = diffOf(r)
              return (
                <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-800 font-medium">{fmtDate(r.ts)}</span>
                    <span className="block text-xs text-slate-400">
                      Esperado {formatMXN(r.data.expectedCents ?? 0)} · Contado {formatMXN(r.data.countedCents ?? 0)}
                      {r.data.note ? ` · ${r.data.note}` : ''}
                    </span>
                  </div>
                  <span
                    className={
                      'text-sm font-bold tabular-nums whitespace-nowrap ' +
                      (diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-emerald-600' : 'text-red-600')
                    }
                  >
                    {diff === 0 ? 'Cuadró ✓' : (diff > 0 ? 'Sobran ' : 'Faltan ') + formatMXN(Math.abs(diff))}
                  </span>
                  <button
                    onClick={() => setToDelete(r)}
                    className="text-xs font-medium text-slate-300 hover:text-red-600 px-1.5 py-1"
                  >
                    Eliminar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {open && (
        <Modal title="Corte de caja" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex justify-between items-baseline">
              <span className="text-sm text-slate-600">Debería haber</span>
              <span className="font-bold text-lg tabular-nums">{formatMXN(esperadoCents)}</span>
            </div>
            <Field label="¿Cuánto hay contado? (MXN)">
              <input
                value={counted}
                onChange={(e) => setCounted(formatAmountInput(e.target.value))}
                inputMode="decimal"
                className={inputCls}
                placeholder="0.00"
                autoFocus
              />
            </Field>
            {counted && (
              <p className="text-sm">
                {parseToCents(counted) - esperadoCents === 0 ? (
                  <span className="text-emerald-600 font-semibold">La caja cuadra perfecto.</span>
                ) : parseToCents(counted) - esperadoCents > 0 ? (
                  <span className="text-emerald-600 font-semibold">
                    Sobran {formatMXN(parseToCents(counted) - esperadoCents)}
                  </span>
                ) : (
                  <span className="text-red-600 font-semibold">
                    Faltan {formatMXN(esperadoCents - parseToCents(counted))}
                  </span>
                )}
              </p>
            )}
            <Field label="Nota (opcional)">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputCls}
                placeholder="Ej. Se pagó el agua de la caja"
              />
            </Field>
          </div>
          <FormButtons onCancel={() => setOpen(false)} onSave={save} saveLabel="Registrar corte" disabled={!counted} />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDelete
          text={`Se eliminará el corte del ${fmtDate(toDelete.ts)}.`}
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            deleteRecord(toDelete.id).catch(() => {})
            setToDelete(null)
          }}
        />
      )}
    </div>
  )
}
