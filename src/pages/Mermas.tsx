import { useState } from 'react'
import { useStore, RecordItem } from '../store/useStore'
import { formatMXN, parseToCents, formatAmountInput } from '../lib/money'
import {
  Card,
  ConfirmDelete,
  Field,
  FormButtons,
  Modal,
  PageHeader,
  primaryBtn,
  StatTile,
  fmtDate,
  inputCls,
  PageShell,
} from '../components/ui'
import { periodRange } from '../lib/finance'

const MERMA_REASONS = ['Se echó a perder', 'Se cayó / rompió', 'Error de preparación', 'Degustación', 'Otro']

export default function Mermas() {
  const products = useStore((s) => s.products)
  const records = useStore((s) => s.records)
  const addRecord = useStore((s) => s.addRecord)
  const deleteRecord = useStore((s) => s.deleteRecord)

  const mermas = records.filter((r) => r.kind === 'merma').sort((a, b) => b.ts - a.ts)

  const [open, setOpen] = useState(false)
  const [productId, setProductId] = useState('')
  const [freeName, setFreeName] = useState('')
  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState('')
  const [reason, setReason] = useState(MERMA_REASONS[0])
  const [toDelete, setToDelete] = useState<RecordItem | null>(null)

  const openNew = () => {
    setProductId('')
    setFreeName('')
    setQty('1')
    setCost('')
    setReason(MERMA_REASONS[0])
    setOpen(true)
  }

  const onPickProduct = (id: string) => {
    setProductId(id)
    const p = products.find((x) => x.id === id)
    if (p) {
      const q = Math.max(1, parseInt(qty, 10) || 1)
      setCost(((p.costCents * q) / 100).toFixed(2))
    }
  }
  const onQty = (v: string) => {
    setQty(v)
    const p = products.find((x) => x.id === productId)
    if (p) {
      const q = Math.max(1, parseInt(v, 10) || 1)
      setCost(((p.costCents * q) / 100).toFixed(2))
    }
  }

  const save = () => {
    const p = products.find((x) => x.id === productId)
    const name = p ? p.name : freeName.trim()
    const costCents = parseToCents(cost)
    if (!name || costCents <= 0) return
    addRecord('merma', {
      name,
      productId: p?.id,
      qty: Math.max(1, parseInt(qty, 10) || 1),
      costCents,
      reason,
    }).catch((e) => alert('No se pudo guardar: ' + e.message))
    setOpen(false)
  }

  const mesRange = periodRange('mes')
  const mermasMes = mermas
    .filter((r) => r.ts >= mesRange.start)
    .reduce((a, r) => a + (r.data.costCents ?? 0), 0)

  return (
    <PageShell>
      <PageHeader
        title="Mermas"
        subtitle="Lo que se pierde también cuesta. Regístralo para que la ganancia sea real y sepas dónde apretar."
        back={{ to: '/administrar', label: 'Administrar' }}
        actions={
          <button onClick={openNew} className={primaryBtn}>
            + Registrar merma
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 mb-4 lg:mb-5">
        <StatTile label="Perdido este mes" value={formatMXN(mermasMes)} color="text-red-600" />
        <StatTile
          label="Registros este mes"
          value={String(mermas.filter((r) => r.ts >= mesRange.start).length)}
        />
        <StatTile
          label="Perdido en total"
          value={formatMXN(mermas.reduce((a, r) => a + (r.data.costCents ?? 0), 0))}
        />
      </div>

      <Card title="Historial de mermas">
        {mermas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            Cuando algo se pierda (se cayó, caducó, salió mal), regístralo aquí en dos toques.
          </p>
        ) : (
          <div className="space-y-1">
            {mermas.slice(0, 50).map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-sm text-slate-800">
                    {r.data.qty > 1 ? `${r.data.qty}× ` : ''}
                    {r.data.name}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {r.data.reason} · {fmtDate(r.ts)}
                  </span>
                </div>
                <span className="font-semibold text-sm text-red-600 tabular-nums whitespace-nowrap">
                  −{formatMXN(r.data.costCents ?? 0)}
                </span>
                <button
                  onClick={() => setToDelete(r)}
                  className="text-xs font-medium text-slate-300 hover:text-red-600 px-1.5 py-1"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {open && (
        <Modal title="Registrar merma" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <Field label="Producto">
              <select value={productId} onChange={(e) => onPickProduct(e.target.value)} className={inputCls}>
                <option value="">Otro (escribir abajo)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            {!productId && (
              <Field label="¿Qué se perdió?">
                <input
                  value={freeName}
                  onChange={(e) => setFreeName(e.target.value)}
                  className={inputCls}
                  placeholder="Ej. Bote de crema"
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad">
                <input value={qty} onChange={(e) => onQty(e.target.value)} inputMode="numeric" className={inputCls} />
              </Field>
              <Field label="Costo perdido (MXN)">
                <input
                  value={cost}
                  onChange={(e) => setCost(formatAmountInput(e.target.value))}
                  inputMode="decimal"
                  className={inputCls}
                  placeholder="0.00"
                />
              </Field>
            </div>
            <Field label="Motivo">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
                {MERMA_REASONS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <FormButtons
            onCancel={() => setOpen(false)}
            onSave={save}
            disabled={(!productId && !freeName.trim()) || parseToCents(cost) <= 0}
          />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDelete
          text={`Se eliminará la merma «${toDelete.data.name}».`}
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            deleteRecord(toDelete.id).catch(() => {})
            setToDelete(null)
          }}
        />
      )}
    </PageShell>
  )
}
