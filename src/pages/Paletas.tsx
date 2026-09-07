import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, RecordItem } from '../store/useStore'
import { formatMXN, parseToCents } from '../lib/money'
import {
  Card,
  ConfirmDelete,
  Field,
  FormButtons,
  Modal,
  dateInputToTs,
  fmtDate,
  inputCls,
  tsToDateInput,
  PageShell,
} from '../components/ui'
import { paleteroLedger } from '../lib/finance'

export default function Paletas() {
  const sales = useStore((s) => s.sales)
  const products = useStore((s) => s.products)
  const records = useStore((s) => s.records)
  const settings = useStore((s) => s.settings)
  const saveSettings = useStore((s) => s.saveSettings)
  const addRecord = useStore((s) => s.addRecord)
  const deleteRecord = useStore((s) => s.deleteRecord)

  const ledger = useMemo(() => paleteroLedger(sales, records), [sales, records])
  const paleteroProducts = products.filter((p) => p.owner === 'paletero')
  const pagos = records.filter((r) => r.kind === 'paletero-pago').sort((a, b) => b.ts - a.ts)

  const [rulesOpen, setRulesOpen] = useState(false)
  const [cfgName, setCfgName] = useState(settings.paletero.name)
  const [cfgPercent, setCfgPercent] = useState(String(settings.paletero.fresafePercent))
  const openRules = () => {
    setCfgName(settings.paletero.name)
    setCfgPercent(String(settings.paletero.fresafePercent))
    setRulesOpen(true)
  }
  const saveCfg = () => {
    const pct = Math.max(0, Math.min(100, parseFloat(cfgPercent) || 0))
    saveSettings({ ...settings, paletero: { name: cfgName.trim() || 'Paletero', fresafePercent: pct } })
      .then(() => setRulesOpen(false))
      .catch((e) => alert('No se pudo guardar: ' + e.message))
  }

  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(tsToDateInput(Date.now()))
  const [toDelete, setToDelete] = useState<RecordItem | null>(null)

  const openPay = () => {
    setPayAmount(ledger.saldoCents > 0 ? (ledger.saldoCents / 100).toFixed(2) : '')
    setPayDate(tsToDateInput(Date.now()))
    setPayOpen(true)
  }
  const savePay = () => {
    const amountCents = parseToCents(payAmount)
    if (amountCents <= 0) return
    addRecord('paletero-pago', { amountCents, note: 'Pago de paletas' }, dateInputToTs(payDate)).catch((e) =>
      alert('No se pudo guardar: ' + e.message),
    )
    setPayOpen(false)
  }

  return (
    <PageShell>
      <Link to="/administrar" className="text-sm font-semibold text-slate-400 hover:text-slate-700">
        ← Administrar
      </Link>
      <h2 className="text-2xl lg:text-3xl font-bold mt-2 mb-5">Paletas</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Card
            title={`Cuenta con ${settings.paletero.name}`}
            right={
              <button
                onClick={openRules}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg"
              >
                Editar reglas
              </button>
            }
          >
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Vendido de sus paletas</span>
                <span className="font-semibold tabular-nums">{formatMXN(ledger.vendidoCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Comisión de FresaFé ({settings.paletero.fresafePercent}%)</span>
                <span className="font-semibold text-slate-900 tabular-nums">{formatMXN(ledger.comisionCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Su parte</span>
                <span className="font-semibold tabular-nums">{formatMXN(ledger.suParteCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Ya se le pagó</span>
                <span className="font-semibold tabular-nums">−{formatMXN(ledger.pagadoCents)}</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between border-t border-slate-200 mt-3 pt-3">
              <span className="font-bold">Se le debe</span>
              <span
                className={
                  'font-bold text-2xl tabular-nums ' + (ledger.saldoCents > 0 ? 'text-orange-600' : 'text-slate-800')
                }
              >
                {formatMXN(ledger.saldoCents)}
              </span>
            </div>
            <button
              onClick={openPay}
              className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg"
            >
              Registrar pago
            </button>
          </Card>

        </div>

        <div className="space-y-4">
          <Card title="Sus productos">
            {paleteroProducts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                En el Menú, marca un producto como «De paletero» y aparecerá aquí. Al venderlo, la cuenta se lleva
                sola.
              </p>
            ) : (
              <div className="space-y-1">
                {paleteroProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="min-w-0 truncate text-slate-800">{p.name}</span>
                    <span className="font-semibold tabular-nums">{formatMXN(p.priceCents)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Pagos hechos">
            {pagos.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Aún no hay pagos registrados.</p>
            ) : (
              <div className="space-y-1">
                {pagos.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                    <span className="flex-1 text-sm text-slate-800">{fmtDate(r.ts)}</span>
                    <span className="font-semibold text-sm tabular-nums">{formatMXN(r.data.amountCents ?? 0)}</span>
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
        </div>
      </div>

      {rulesOpen && (
        <Modal title="Reglas de la consignación" onClose={() => setRulesOpen(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre">
                <input value={cfgName} onChange={(e) => setCfgName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="% para FresaFé">
                <input
                  value={cfgPercent}
                  onChange={(e) => setCfgPercent(e.target.value)}
                  inputMode="decimal"
                  className={inputCls}
                />
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              De cada paleta vendida, FresaFé se queda este porcentaje y el resto es del{' '}
              {cfgName.trim() || 'paletero'}. Aplica a ventas nuevas.
            </p>
          </div>
          <FormButtons onCancel={() => setRulesOpen(false)} onSave={saveCfg} />
        </Modal>
      )}

      {payOpen && (
        <Modal title={`Pago a ${settings.paletero.name}`} onClose={() => setPayOpen(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto (MXN)">
                <input
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  inputMode="decimal"
                  className={inputCls}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Fecha">
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
            {ledger.saldoCents > 0 && (
              <p className="text-xs text-slate-500">Saldo pendiente: {formatMXN(ledger.saldoCents)}</p>
            )}
          </div>
          <FormButtons onCancel={() => setPayOpen(false)} onSave={savePay} saveLabel="Registrar" disabled={parseToCents(payAmount) <= 0} />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDelete
          text="Se eliminará este pago."
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
