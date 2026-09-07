import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, mergeSettings } from '../store/useStore'
import { formatMXN, parseToCents, formatAmountInput } from '../lib/money'
import { PageShell } from '../components/ui'

export default function Configuracion() {
  const investmentCents = useStore((s) => s.investmentCents)
  const setInvestmentCents = useStore((s) => s.setInvestmentCents)
  const changeFundCents = useStore((s) => s.changeFundCents)
  const setChangeFundCents = useStore((s) => s.setChangeFundCents)
  const cardCommissionPercent = useStore((s) => s.cardCommissionPercent)
  const setCardCommissionPercent = useStore((s) => s.setCardCommissionPercent)

  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const exportData = () => {
    const s = useStore.getState()
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      products: s.products,
      investmentCents: s.investmentCents,
      changeFundCents: s.changeFundCents,
      cardCommissionPercent: s.cardCommissionPercent,
      sales: s.sales,
      records: s.records,
      settings: s.settings,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abi-pos-respaldo-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setImportMsg({ kind: 'ok', text: 'Respaldo descargado.' })
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data?.products)) throw new Error('Archivo inválido (sin productos)')
      useStore.setState({
        products: data.products,
        investmentCents: Number(data.investmentCents) || 0,
        changeFundCents: Number(data.changeFundCents) || 0,
        cardCommissionPercent: Number(data.cardCommissionPercent) || 4.06,
        sales: Array.isArray(data.sales) ? data.sales : [],
        records: Array.isArray(data.records) ? data.records : [],
        settings: mergeSettings(data.settings),
      })
      setImportMsg({
        kind: 'ok',
        text: `Importado: ${data.products.length} producto(s)${
          Array.isArray(data.sales) ? `, ${data.sales.length} venta(s)` : ''
        }.`,
      })
    } catch (err) {
      setImportMsg({
        kind: 'err',
        text: 'No se pudo leer el archivo. Asegúrate de que sea un JSON exportado por este sistema.',
      })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <PageShell width="max-w-3xl">
      <Link to="/administrar" className="text-sm font-semibold text-slate-400 hover:text-slate-700">
        ← Administrar
      </Link>
      <h2 className="text-2xl lg:text-3xl font-bold mt-2 mb-6">Configuración</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <KpiEdit
          label="Inversión"
          cents={investmentCents}
          onChange={setInvestmentCents}
          color="text-orange-600"
          hint="Tu meta a recuperar antes de empezar a ganar."
        />
        <KpiEdit
          label="Fondo de cambio"
          cents={changeFundCents}
          onChange={setChangeFundCents}
          color="text-slate-900"
          hint="No es ganancia ni inversión. Debe quedar igual al final del día."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
        <div className="text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400 mb-1">
          Comisión MP Point
        </div>
        <PercentEdit
          percent={cardCommissionPercent}
          onChange={setCardCommissionPercent}
          color="text-purple-600"
        />
        <div className="text-xs text-slate-500 mt-2 leading-relaxed">
          Porcentaje que MP descuenta por cobro con tarjeta (incluye IVA). Default{' '}
          <b>4.06%</b> = 3.5% + IVA, tarifa al contado con plazo de depósito a 1 mes.
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
        <div className="text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400 mb-1">
          Respaldo y migración
        </div>
        <div className="text-xs text-slate-500 mb-3 leading-relaxed">
          Exporta tus productos, configuración y ventas a un archivo JSON. Útil para mover los
          datos entre dispositivos o respaldar antes de pruebas.
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={exportData}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2.5 rounded text-sm"
          >
            Exportar a archivo
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded text-sm"
          >
            Importar archivo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            className="hidden"
          />
        </div>
        {importMsg && (
          <div
            className={
              'mt-3 text-xs p-2 rounded ' +
              (importMsg.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200')
            }
          >
            {importMsg.text}
          </div>
        )}
        <div className="text-xs text-slate-500 mt-3 leading-relaxed">
          ⚠ Al importar se <b>reemplaza todo</b> lo que tienes ahora (productos, ventas,
          inversión, etc.). Si quieres conservar lo actual, exporta primero.
        </div>
      </div>
      </div>
    </PageShell>
  )
}

function KpiEdit({
  label,
  cents,
  onChange,
  color,
  hint,
}: {
  label: string
  cents: number
  onChange: (cents: number) => void
  color: string
  hint?: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState((cents / 100).toFixed(2))

  const start = () => {
    setValue((cents / 100).toFixed(2))
    setEditing(true)
  }
  const save = () => {
    onChange(parseToCents(value))
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
      <div className="text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400 mb-1">{label}</div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(formatAmountInput(e.target.value))}
            inputMode="decimal"
            className="flex-1 min-w-0 border border-slate-200 rounded px-2 py-1 text-xl font-bold"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
          <button
            onClick={save}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm px-3 py-1.5 rounded font-semibold"
          >
            OK
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className={`text-3xl font-bold ${color}`}>{formatMXN(cents)}</div>
          <button
            onClick={start}
            className="text-xs text-slate-500 hover:text-slate-900 hover:underline font-medium"
          >
            Editar
          </button>
        </div>
      )}
      {hint && <div className="text-xs text-slate-500 mt-2">{hint}</div>}
    </div>
  )
}

function PercentEdit({
  percent,
  onChange,
  color,
}: {
  percent: number
  onChange: (p: number) => void
  color: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(percent.toFixed(2))

  const start = () => {
    setValue(percent.toFixed(2))
    setEditing(true)
  }
  const save = () => {
    const n = parseFloat(value)
    onChange(Number.isNaN(n) ? 0 : n)
    setEditing(false)
  }

  return editing ? (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="decimal"
        className="flex-1 min-w-0 border border-slate-200 rounded px-2 py-1 text-xl font-bold"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
      <span className="font-bold text-slate-500">%</span>
      <button
        onClick={save}
        className="bg-slate-900 hover:bg-slate-800 text-white text-sm px-3 py-1.5 rounded font-semibold"
      >
        OK
      </button>
    </div>
  ) : (
    <div className="flex items-center justify-between">
      <div className={`text-3xl font-bold ${color}`}>{percent.toFixed(2)}%</div>
      <button
        onClick={start}
        className="text-xs text-slate-500 hover:text-slate-900 hover:underline font-medium"
      >
        Editar
      </button>
    </div>
  )
}
