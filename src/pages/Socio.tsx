import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, RecordItem, Settings } from '../store/useStore'
import { formatMXN, parseToCents, formatAmountInput } from '../lib/money'
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
import {
  computeBreakdown,
  currentCutRange,
  partnerBaseCents,
  partnerLedger,
  WEEKDAYS,
} from '../lib/finance'

const SOCIO_MOV_LABELS: Record<string, string> = {
  prestamo: 'Prestó (se le debe)',
  aportacion: 'Aportó por su %',
  'pago-prestamo': 'Abono a préstamo',
  'pago-ganancia': 'Pago de ganancia',
}

export default function Socio() {
  const sales = useStore((s) => s.sales)
  const records = useStore((s) => s.records)
  const settings = useStore((s) => s.settings)
  const saveSettings = useStore((s) => s.saveSettings)
  const addRecord = useStore((s) => s.addRecord)
  const deleteRecord = useStore((s) => s.deleteRecord)

  const [rulesOpen, setRulesOpen] = useState(false)
  const [cfg, setCfg] = useState<Settings['partner']>(settings.partner)
  const patchCfg = (p: Partial<Settings['partner']>) => setCfg((c) => ({ ...c, ...p }))
  const openRules = () => {
    setCfg(settings.partner)
    setRulesOpen(true)
  }
  const saveCfg = () => {
    saveSettings({ ...settings, partner: cfg })
      .then(() => setRulesOpen(false))
      .catch((e) => alert('No se pudo guardar: ' + e.message))
  }

  const cut = useMemo(() => currentCutRange(settings.partner), [settings.partner])
  const b = useMemo(() => computeBreakdown(sales, records, cut), [sales, records, cut])
  const ledger = useMemo(() => partnerLedger(records), [records])
  const socioCents = Math.round(
    (Math.max(0, partnerBaseCents(b, settings.partner.base)) * settings.partner.percent) / 100,
  )

  const movs = records.filter((r) => r.kind === 'socio-mov').sort((a, b2) => b2.ts - a.ts)

  const [movOpen, setMovOpen] = useState(false)
  const [movType, setMovType] = useState('prestamo')
  const [movConcept, setMovConcept] = useState('')
  const [movAmount, setMovAmount] = useState('')
  const [movDate, setMovDate] = useState(tsToDateInput(Date.now()))
  const [toDelete, setToDelete] = useState<RecordItem | null>(null)

  const openMov = (type: string) => {
    setMovType(type)
    setMovConcept('')
    setMovAmount('')
    setMovDate(tsToDateInput(Date.now()))
    setMovOpen(true)
  }
  const saveMov = () => {
    const amountCents = parseToCents(movAmount)
    if (amountCents <= 0) return
    addRecord(
      'socio-mov',
      { type: movType, concept: movConcept.trim() || SOCIO_MOV_LABELS[movType], amountCents },
      dateInputToTs(movDate),
    ).catch((e) => alert('No se pudo guardar: ' + e.message))
    setMovOpen(false)
  }

  return (
    <PageShell>
      <Link to="/administrar" className="text-sm font-semibold text-slate-400 hover:text-slate-700">
        ← Administrar
      </Link>
      <h2 className="text-2xl lg:text-3xl font-bold mt-2 mb-5">Socio</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Card
            title="Corte actual"
            right={
              <button
                onClick={openRules}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg"
              >
                Editar reglas
              </button>
            }
          >
            <p className="text-xs text-slate-400 mb-3">
              Desde el {fmtDate(cut.start)} ·{' '}
              {settings.partner.frequency === 'semanal'
                ? `corte cada ${WEEKDAYS[settings.partner.cutWeekday].toLowerCase()}`
                : `corte el día ${settings.partner.cutMonthday} de cada mes`}
            </p>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-slate-600">
                {settings.partner.base === 'neta'
                  ? 'Ganancia real del periodo'
                  : settings.partner.base === 'bruta'
                    ? 'Ganancia bruta del periodo'
                    : 'Ventas del periodo'}
              </span>
              <span className="font-semibold tabular-nums">
                {formatMXN(Math.max(0, partnerBaseCents(b, settings.partner.base)))}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t border-slate-200 mt-2 pt-2.5">
              <span className="font-bold">
                Le toca a {settings.partner.name} ({settings.partner.percent}%)
              </span>
              <span className="font-bold text-2xl text-slate-900 tabular-nums">{formatMXN(socioCents)}</span>
            </div>
            {ledger.saldoPrestamoCents > 0 && (
              <div className="flex items-baseline justify-between mt-2 text-sm">
                <span className="text-slate-600">Además se le debe (préstamos)</span>
                <span className="font-semibold text-orange-600 tabular-nums">
                  {formatMXN(ledger.saldoPrestamoCents)}
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => openMov('pago-ganancia')}
                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 rounded-lg"
              >
                Registrar pago
              </button>
              <button
                onClick={() => openMov('prestamo')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg"
              >
                Registrar aporte
              </button>
            </div>
          </Card>

        </div>

        <Card title="Estado de cuenta">
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Prestó en total</div>
              <div className="font-bold tabular-nums">{formatMXN(ledger.prestamosCents)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Se le debe de préstamos</div>
              <div className="font-bold text-orange-600 tabular-nums">{formatMXN(ledger.saldoPrestamoCents)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Aportó por su %</div>
              <div className="font-bold tabular-nums">{formatMXN(ledger.aportacionesCents)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Ganancias pagadas</div>
              <div className="font-bold text-slate-900 tabular-nums">{formatMXN(ledger.pagosGananciaCents)}</div>
            </div>
          </div>

          {movs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              Registra aquí lo que el socio prestó (refris, mesas, teles…), lo que aportó por su porcentaje y cada
              pago que se le haga.
            </p>
          ) : (
            <div className="space-y-1">
              {movs.map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-sm text-slate-800">{r.data.concept}</span>
                    <span className="block text-xs text-slate-400">
                      {SOCIO_MOV_LABELS[r.data.type] ?? r.data.type} · {fmtDate(r.ts)}
                    </span>
                  </div>
                  <span
                    className={
                      'font-semibold text-sm tabular-nums whitespace-nowrap ' +
                      (r.data.type === 'pago-prestamo' || r.data.type === 'pago-ganancia'
                        ? 'text-slate-900'
                        : 'text-slate-800')
                    }
                  >
                    {formatMXN(r.data.amountCents ?? 0)}
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
      </div>

      {rulesOpen && (
        <Modal title="Reglas del trato" onClose={() => setRulesOpen(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre">
                <input value={cfg.name} onChange={(e) => patchCfg({ name: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Porcentaje (%)">
                <input
                  value={String(cfg.percent)}
                  onChange={(e) =>
                    patchCfg({ percent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })
                  }
                  inputMode="decimal"
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Su % se calcula sobre…">
              <select
                value={cfg.base}
                onChange={(e) => patchCfg({ base: e.target.value as Settings['partner']['base'] })}
                className={inputCls}
              >
                <option value="neta">Ganancia real (después de gastos) — recomendado</option>
                <option value="bruta">Ganancia bruta (antes de gastos)</option>
                <option value="ventas">Ventas totales</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Se le paga cada…">
                <select
                  value={cfg.frequency}
                  onChange={(e) => patchCfg({ frequency: e.target.value as 'semanal' | 'mensual' })}
                  className={inputCls}
                >
                  <option value="semanal">Semana</option>
                  <option value="mensual">Mes</option>
                </select>
              </Field>
              {cfg.frequency === 'semanal' ? (
                <Field label="Día de corte">
                  <select
                    value={String(cfg.cutWeekday)}
                    onChange={(e) => patchCfg({ cutWeekday: parseInt(e.target.value, 10) })}
                    className={inputCls}
                  >
                    {WEEKDAYS.map((w, i) => (
                      <option key={w} value={i}>
                        {w}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Día del mes (1–28)">
                  <input
                    value={String(cfg.cutMonthday)}
                    onChange={(e) =>
                      patchCfg({ cutMonthday: Math.max(1, Math.min(28, parseInt(e.target.value, 10) || 1)) })
                    }
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>
              )}
            </div>
          </div>
          <FormButtons onCancel={() => setRulesOpen(false)} onSave={saveCfg} saveLabel="Guardar reglas" />
        </Modal>
      )}

      {movOpen && (
        <Modal title="Movimiento del socio" onClose={() => setMovOpen(false)}>
          <div className="space-y-3">
            <Field label="Tipo">
              <select value={movType} onChange={(e) => setMovType(e.target.value)} className={inputCls}>
                <option value="prestamo">Prestó algo (se le debe)</option>
                <option value="aportacion">Aportó por su % (no se le debe)</option>
                <option value="pago-ganancia">Se le pagó su ganancia</option>
                <option value="pago-prestamo">Se le abonó a un préstamo</option>
              </select>
            </Field>
            <Field label="Concepto">
              <input
                value={movConcept}
                onChange={(e) => setMovConcept(e.target.value)}
                className={inputCls}
                placeholder="Ej. Refrigerador, pago semanal…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto (MXN)">
                <input
                  value={movAmount}
                  onChange={(e) => setMovAmount(formatAmountInput(e.target.value))}
                  inputMode="decimal"
                  className={inputCls}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Fecha">
                <input type="date" value={movDate} onChange={(e) => setMovDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>
          <FormButtons onCancel={() => setMovOpen(false)} onSave={saveMov} disabled={parseToCents(movAmount) <= 0} />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDelete
          text={`Se eliminará «${toDelete.data.concept}».`}
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
