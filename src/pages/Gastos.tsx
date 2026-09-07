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
  StatTile,
  dateInputToTs,
  fmtDate,
  inputCls,
  tsToDateInput,
  PageShell,
} from '../components/ui'
import { fixedExpensesForRange, periodRange } from '../lib/finance'

export default function Gastos() {
  const records = useStore((s) => s.records)
  const addRecord = useStore((s) => s.addRecord)
  const updateRecord = useStore((s) => s.updateRecord)
  const deleteRecord = useStore((s) => s.deleteRecord)

  const fijos = records.filter((r) => r.kind === 'gasto-fijo')
  const variables = records.filter((r) => r.kind === 'gasto').sort((a, b) => b.ts - a.ts)

  const [modal, setModal] = useState<'fijo' | 'variable' | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(tsToDateInput(Date.now()))
  const [toDelete, setToDelete] = useState<RecordItem | null>(null)

  const openNew = (kind: 'fijo' | 'variable') => {
    setEditId(null)
    setName('')
    setAmount('')
    setDate(tsToDateInput(Date.now()))
    setModal(kind)
  }
  const openEdit = (r: RecordItem) => {
    setEditId(r.id)
    setName(r.data.name ?? '')
    setAmount(((r.data.amountCents ?? 0) / 100).toFixed(2))
    setDate(tsToDateInput(r.ts))
    setModal(r.kind === 'gasto-fijo' ? 'fijo' : 'variable')
  }
  const save = () => {
    const amountCents = parseToCents(amount)
    if (!name.trim() || amountCents <= 0) return
    const err = (e: Error) => alert('No se pudo guardar: ' + e.message)
    if (modal === 'fijo') {
      if (editId) {
        const prev = fijos.find((r) => r.id === editId)
        updateRecord(editId, {
          ts: dateInputToTs(date),
          data: { ...prev?.data, name: name.trim(), amountCents },
        }).catch(err)
      } else {
        addRecord('gasto-fijo', { name: name.trim(), amountCents, active: true }, dateInputToTs(date)).catch(err)
      }
    } else {
      if (editId) {
        updateRecord(editId, { ts: dateInputToTs(date), data: { name: name.trim(), amountCents } }).catch(err)
      } else {
        addRecord('gasto', { name: name.trim(), amountCents }, dateInputToTs(date)).catch(err)
      }
    }
    setModal(null)
  }

  const fijosActivosTotal = fijos
    .filter((r) => r.data.active !== false)
    .reduce((a, r) => a + (r.data.amountCents ?? 0), 0)
  const mesRange = periodRange('mes')
  const variablesMes = variables
    .filter((r) => r.ts >= mesRange.start)
    .reduce((a, r) => a + (r.data.amountCents ?? 0), 0)

  return (
    <PageShell>
      <PageHeader
        title="Gastos"
        subtitle="Todo lo que sale de dinero."
        back={{ to: '/administrar', label: 'Administrar' }}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 mb-4 lg:mb-5">
        <StatTile label="Fijos al mes" value={formatMXN(fijosActivosTotal)} sub="activos" />
        <StatTile label="Variables este mes" value={formatMXN(variablesMes)} />
        <StatTile
          label="Total este mes"
          value={formatMXN(variablesMes + fixedExpensesForRange(records, mesRange))}
          sub="fijos prorrateados + variables"
          color="text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
        <Card
          title="Gastos fijos (mensuales)"
          right={
            <button
              onClick={() => openNew('fijo')}
              className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-3 py-1.5 rounded-lg"
            >
              + Añadir
            </button>
          }
        >
          {fijos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              Renta, luz, internet…
            </p>
          ) : (
            <div className="space-y-1">
              {fijos.map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                  <button
                    onClick={() =>
                      updateRecord(r.id, { data: { ...r.data, active: r.data.active === false } }).catch(() => {})
                    }
                    className={
                      'w-9 h-5 rounded-full relative transition shrink-0 ' +
                      (r.data.active !== false ? 'bg-emerald-500' : 'bg-slate-300')
                    }
                    title={r.data.active !== false ? 'Activo (cuenta en la ganancia)' : 'Pausado (no cuenta)'}
                  >
                    <span
                      className={
                        'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ' +
                        (r.data.active !== false ? 'left-[18px]' : 'left-0.5')
                      }
                    />
                  </button>
                  <span
                    className={
                      'flex-1 min-w-0 truncate text-sm ' +
                      (r.data.active !== false ? 'text-slate-800' : 'text-slate-400 line-through')
                    }
                  >
                    {r.data.name}
                  </span>
                  <span className="font-semibold text-sm tabular-nums whitespace-nowrap">
                    {formatMXN(r.data.amountCents ?? 0)}/mes
                  </span>
                  <button
                    onClick={() => openEdit(r)}
                    className="text-xs font-medium text-slate-400 hover:text-slate-800 px-1.5 py-1"
                  >
                    Editar
                  </button>
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

        <Card
          title="Gastos variables"
          right={
            <button
              onClick={() => openNew('variable')}
              className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-3 py-1.5 rounded-lg"
            >
              + Añadir
            </button>
          }
        >
          {variables.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              Fresas, crema, desechables…
            </p>
          ) : (
            <div className="space-y-1">
              {variables.slice(0, 30).map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                  <span className="flex-1 min-w-0 truncate text-sm text-slate-800">{r.data.name}</span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{fmtDate(r.ts)}</span>
                  <span className="font-semibold text-sm tabular-nums whitespace-nowrap">
                    {formatMXN(r.data.amountCents ?? 0)}
                  </span>
                  <button
                    onClick={() => openEdit(r)}
                    className="text-xs font-medium text-slate-400 hover:text-slate-800 px-1.5 py-1"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setToDelete(r)}
                    className="text-xs font-medium text-slate-300 hover:text-red-600 px-1.5 py-1"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
              {variables.length > 30 && (
                <p className="text-xs text-slate-400 text-center pt-2">Mostrando los 30 más recientes.</p>
              )}
            </div>
          )}
        </Card>
      </div>

      {modal && (
        <Modal
          title={(editId ? 'Editar' : 'Nuevo') + (modal === 'fijo' ? ' gasto fijo' : ' gasto')}
          onClose={() => setModal(null)}
        >
          <div className="space-y-3">
            <Field label="Concepto">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder={modal === 'fijo' ? 'Ej. Renta del local' : 'Ej. Caja de fresas'}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={modal === 'fijo' ? 'Monto mensual (MXN)' : 'Monto (MXN)'}>
                <input
                  value={amount}
                  onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                  inputMode="decimal"
                  className={inputCls}
                  placeholder="0.00"
                />
              </Field>
              <Field label={modal === 'fijo' ? 'Cuenta desde' : 'Fecha'}>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
            {modal === 'fijo' && (
              <p className="text-xs text-slate-500">
                Se prorratea por día desde la fecha indicada.
              </p>
            )}
          </div>
          <FormButtons
            onCancel={() => setModal(null)}
            onSave={save}
            disabled={!name.trim() || parseToCents(amount) <= 0}
          />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDelete
          text={`Se eliminará «${toDelete.data.name}».`}
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
