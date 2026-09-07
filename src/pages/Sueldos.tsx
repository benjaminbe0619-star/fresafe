import { useMemo, useState } from 'react'
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
  primaryBtn,
  tsToDateInput,
  PageShell,
} from '../components/ui'
import { monthlySalaryCents } from '../lib/finance'

const FREQ_LABELS: Record<string, string> = {
  semanal: 'a la semana',
  quincenal: 'a la quincena',
  mensual: 'al mes',
}

export default function Sueldos() {
  const records = useStore((s) => s.records)
  const addRecord = useStore((s) => s.addRecord)
  const updateRecord = useStore((s) => s.updateRecord)
  const deleteRecord = useStore((s) => s.deleteRecord)

  const empleados = useMemo(() => records.filter((r) => r.kind === 'empleado'), [records])
  const pagos = useMemo(
    () => records.filter((r) => r.kind === 'sueldo-pago').sort((a, b) => b.ts - a.ts),
    [records],
  )
  const adelantos = useMemo(
    () => records.filter((r) => r.kind === 'sueldo-adelanto').sort((a, b) => b.ts - a.ts),
    [records],
  )

  const nominaMensual = empleados
    .filter((r) => r.data.active !== false)
    .reduce((a, r) => a + monthlySalaryCents(r.data.salaryCents ?? 0, r.data.frequency ?? 'mensual'), 0)

  // Saldo de adelantos por empleado: lo adelantado menos los pagos marcados como abono.
  const saldoAdelanto = (employeeId: string) =>
    adelantos.filter((r) => r.data.employeeId === employeeId).reduce((a, r) => a + (r.data.amountCents ?? 0), 0) -
    pagos
      .filter((r) => r.data.employeeId === employeeId && r.data.esAbonoAdelanto)
      .reduce((a, r) => a + (r.data.amountCents ?? 0), 0)

  // ---- alta / edición de empleado ----
  const [empOpen, setEmpOpen] = useState(false)
  const [empId, setEmpId] = useState<string | null>(null)
  const [empName, setEmpName] = useState('')
  const [empRole, setEmpRole] = useState('')
  const [empSalary, setEmpSalary] = useState('')
  const [empFreq, setEmpFreq] = useState('semanal')

  const openEmp = (r?: RecordItem) => {
    setEmpId(r?.id ?? null)
    setEmpName(r?.data.name ?? '')
    setEmpRole(r?.data.role ?? '')
    setEmpSalary(r ? ((r.data.salaryCents ?? 0) / 100).toFixed(2) : '')
    setEmpFreq(r?.data.frequency ?? 'semanal')
    setEmpOpen(true)
  }
  const saveEmp = () => {
    const salaryCents = parseToCents(empSalary)
    if (!empName.trim() || salaryCents <= 0) return
    const err = (e: Error) => alert('No se pudo guardar: ' + e.message)
    if (empId) {
      const prev = empleados.find((r) => r.id === empId)
      updateRecord(empId, {
        data: { ...prev?.data, name: empName.trim(), role: empRole.trim(), salaryCents, frequency: empFreq },
      }).catch(err)
    } else {
      addRecord('empleado', {
        name: empName.trim(),
        role: empRole.trim(),
        salaryCents,
        frequency: empFreq,
        active: true,
      }).catch(err)
    }
    setEmpOpen(false)
  }

  // ---- pago / adelanto ----
  const [movOpen, setMovOpen] = useState<'pago' | 'adelanto' | null>(null)
  const [movEmp, setMovEmp] = useState<RecordItem | null>(null)
  const [movAmount, setMovAmount] = useState('')
  const [movDate, setMovDate] = useState(tsToDateInput(Date.now()))
  const [movAbono, setMovAbono] = useState(false)
  const [movConcept, setMovConcept] = useState('')

  const openMov = (kind: 'pago' | 'adelanto', emp: RecordItem) => {
    setMovEmp(emp)
    setMovAmount(kind === 'pago' ? ((emp.data.salaryCents ?? 0) / 100).toFixed(2) : '')
    setMovDate(tsToDateInput(Date.now()))
    setMovAbono(false)
    setMovConcept('')
    setMovOpen(kind)
  }
  const saveMov = () => {
    if (!movEmp) return
    const amountCents = parseToCents(movAmount)
    if (amountCents <= 0) return
    const err = (e: Error) => alert('No se pudo guardar: ' + e.message)
    if (movOpen === 'pago') {
      addRecord(
        'sueldo-pago',
        { employeeId: movEmp.id, amountCents, esAbonoAdelanto: movAbono },
        dateInputToTs(movDate),
      ).catch(err)
    } else {
      addRecord(
        'sueldo-adelanto',
        { employeeId: movEmp.id, amountCents, concept: movConcept.trim() || 'Adelanto' },
        dateInputToTs(movDate),
      ).catch(err)
    }
    setMovOpen(null)
  }

  const [toDelete, setToDelete] = useState<RecordItem | null>(null)
  const empName2 = (id: string) => empleados.find((e) => e.id === id)?.data.name ?? 'Empleado'

  const historial = [...pagos, ...adelantos].sort((a, b) => b.ts - a.ts).slice(0, 30)

  return (
    <PageShell>
      <PageHeader
        title="Sueldos"
        subtitle="Empleados, pagos y adelantos. La nómina se descuenta sola de la ganancia, día a día."
        back={{ to: '/administrar', label: 'Administrar' }}
        actions={
          <button onClick={() => openEmp()} className={primaryBtn}>
            + Añadir empleado
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 mb-4 lg:mb-5">
        <StatTile label="Nómina mensual" value={formatMXN(nominaMensual)} sub="cuenta sola en la ganancia" />
        <StatTile
          label="Empleados activos"
          value={String(empleados.filter((r) => r.data.active !== false).length)}
        />
        <StatTile
          label="Adelantos pendientes"
          value={formatMXN(empleados.reduce((a, r) => a + Math.max(0, saldoAdelanto(r.id)), 0))}
          color="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
        <Card title="Empleados">
          {empleados.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              Da de alta a cada empleado con su sueldo. Se descuenta solo de la ganancia, día a día.
            </p>
          ) : (
            <div className="space-y-3">
              {empleados.map((r) => {
                const saldo = saldoAdelanto(r.id)
                const activo = r.data.active !== false
                return (
                  <div key={r.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <span className={'block font-semibold truncate ' + (activo ? 'text-slate-900' : 'text-slate-400 line-through')}>
                          {r.data.name}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {r.data.role ? `${r.data.role} · ` : ''}
                          {formatMXN(r.data.salaryCents ?? 0)} {FREQ_LABELS[r.data.frequency] ?? ''}
                        </span>
                        {saldo > 0 && (
                          <span className="block text-xs text-orange-600 font-semibold mt-0.5">
                            Debe {formatMXN(saldo)} de adelantos
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          updateRecord(r.id, { data: { ...r.data, active: !activo } }).catch(() => {})
                        }
                        className={'w-9 h-5 rounded-full relative transition shrink-0 ' + (activo ? 'bg-emerald-500' : 'bg-slate-300')}
                        title={activo ? 'Activo (su sueldo cuenta)' : 'Dado de baja (no cuenta)'}
                      >
                        <span className={'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ' + (activo ? 'left-[18px]' : 'left-0.5')} />
                      </button>
                    </div>
                    <div className="flex gap-2 mt-2.5">
                      <button
                        onClick={() => openMov('pago', r)}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2 rounded-lg"
                      >
                        Registrar pago
                      </button>
                      <button
                        onClick={() => openMov('adelanto', r)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 rounded-lg"
                      >
                        Adelanto
                      </button>
                      <button
                        onClick={() => openEmp(r)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card title="Historial de pagos y adelantos">
          {historial.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aún no hay movimientos.</p>
          ) : (
            <div className="space-y-1">
              {historial.map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-sm text-slate-800">
                      {empName2(r.data.employeeId)}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {r.kind === 'sueldo-pago'
                        ? r.data.esAbonoAdelanto
                          ? 'Pago (abono a adelanto)'
                          : 'Pago de sueldo'
                        : `Adelanto${r.data.concept && r.data.concept !== 'Adelanto' ? ` · ${r.data.concept}` : ''}`}{' '}
                      · {fmtDate(r.ts)}
                    </span>
                  </div>
                  <span
                    className={
                      'font-semibold text-sm tabular-nums whitespace-nowrap ' +
                      (r.kind === 'sueldo-pago' ? 'text-slate-900' : 'text-orange-600')
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

      {empOpen && (
        <Modal title={empId ? 'Editar empleado' : 'Nuevo empleado'} onClose={() => setEmpOpen(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre">
                <input value={empName} onChange={(e) => setEmpName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Puesto (opcional)">
                <input value={empRole} onChange={(e) => setEmpRole(e.target.value)} className={inputCls} placeholder="Ej. Mostrador" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sueldo (MXN)">
                <input value={empSalary} onChange={(e) => setEmpSalary(formatAmountInput(e.target.value))} inputMode="decimal" className={inputCls} placeholder="0.00" />
              </Field>
              <Field label="Se le paga cada…">
                <select value={empFreq} onChange={(e) => setEmpFreq(e.target.value)} className={inputCls}>
                  <option value="semanal">Semana</option>
                  <option value="quincenal">Quincena</option>
                  <option value="mensual">Mes</option>
                </select>
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              El sueldo se descuenta de la ganancia real automáticamente, prorrateado por día.
            </p>
          </div>
          <FormButtons
            onCancel={() => setEmpOpen(false)}
            onSave={saveEmp}
            disabled={!empName.trim() || parseToCents(empSalary) <= 0}
          />
        </Modal>
      )}

      {movOpen && movEmp && (
        <Modal
          title={(movOpen === 'pago' ? 'Pago a ' : 'Adelanto a ') + movEmp.data.name}
          onClose={() => setMovOpen(null)}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto (MXN)">
                <input value={movAmount} onChange={(e) => setMovAmount(formatAmountInput(e.target.value))} inputMode="decimal" className={inputCls} placeholder="0.00" autoFocus />
              </Field>
              <Field label="Fecha">
                <input type="date" value={movDate} onChange={(e) => setMovDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
            {movOpen === 'pago' ? (
              <>
                {saldoAdelanto(movEmp.id) > 0 && (
                  <label className="flex items-center gap-2.5 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={movAbono}
                      onChange={(e) => setMovAbono(e.target.checked)}
                      className="w-4 h-4 accent-slate-900"
                    />
                    <span className="text-sm">
                      Es abono a sus adelantos{' '}
                      <span className="text-slate-400">(debe {formatMXN(saldoAdelanto(movEmp.id))})</span>
                    </span>
                  </label>
                )}
              </>
            ) : (
              <Field label="Concepto (opcional)">
                <input value={movConcept} onChange={(e) => setMovConcept(e.target.value)} className={inputCls} placeholder="Ej. Emergencia" />
              </Field>
            )}
          </div>
          <FormButtons
            onCancel={() => setMovOpen(null)}
            onSave={saveMov}
            saveLabel="Registrar"
            disabled={parseToCents(movAmount) <= 0}
          />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDelete
          text="Se eliminará este movimiento."
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
