import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// Piezas de UI compartidas por las páginas de control (gastos, mermas, socio, paletas, sueldos)

export const inputCls = 'mt-1 w-full border border-slate-200 rounded px-3 py-2'

export const dateInputToTs = (v: string): number => {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0).getTime()
}

export const tsToDateInput = (ts: number): string => {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

export function FormButtons({
  onCancel,
  onSave,
  saveLabel = 'Guardar',
  disabled,
}: {
  onCancel: () => void
  onSave: () => void
  saveLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="flex gap-2 mt-5">
      <button
        onClick={onCancel}
        className="flex-1 px-4 py-2.5 rounded bg-slate-100 hover:bg-slate-200 font-semibold"
      >
        Cancelar
      </button>
      <button
        onClick={onSave}
        disabled={disabled}
        className="flex-1 px-4 py-2.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold"
      >
        {saveLabel}
      </button>
    </div>
  )
}

// Contenedor de página: centra el contenido y le da aire, para que nada quede
// amontonado a la izquierda en pantallas grandes.
export function PageShell({
  children,
  width = 'max-w-5xl',
}: {
  children: React.ReactNode
  width?: string
}) {
  return (
    <div className="h-full overflow-auto">
      <div className={`${width} mx-auto p-4 lg:px-8 lg:py-7 pb-10`}>{children}</div>
    </div>
  )
}

export function Card({
  title,
  right,
  children,
}: {
  title?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 lg:p-6">
      {(title || right) && (
        <div className="flex items-center justify-between gap-2 mb-4">
          {title && (
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              {title}
            </h3>
          )}
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

export function ConfirmDelete({
  text,
  onCancel,
  onConfirm,
}: {
  text: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
        <h3 className="font-bold text-lg mb-2">¿Estás seguro?</h3>
        <p className="text-slate-600 mb-5">{text}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-slate-100 hover:bg-slate-200 font-semibold py-2 rounded">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

export function StatTile({
  label,
  value,
  color = 'text-slate-900',
  sub,
}: {
  label: string
  value: string
  color?: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 lg:p-5">
      <div className="text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400">{label}</div>
      <div className={`text-2xl lg:text-[1.7rem] font-bold mt-1 tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export function PillSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={
            'px-3.5 py-1.5 rounded-lg text-sm font-semibold transition whitespace-nowrap ' +
            (value === o.key
              ? 'bg-white shadow-sm text-slate-900'
              : 'text-slate-500 hover:text-slate-800')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Selector de categoría por chips: elige con un clic o crea una nueva al vuelo.
export function CategoryPicker({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const all = [...new Set([...options, ...(value && !options.includes(value) ? [value] : [])])]

  const commit = () => {
    const v = draft.trim()
    if (v) onChange(v)
    setAdding(false)
    setDraft('')
  }

  const chip = (selected: boolean) =>
    'px-3.5 py-1.5 rounded-full text-sm font-semibold transition ' +
    (selected
      ? 'bg-slate-900 text-white shadow-sm'
      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900')

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => onChange('')} className={chip(!value)}>
        Sin categoría
      </button>
      {all.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} className={chip(value === c)}>
          {c}
        </button>
      ))}
      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setAdding(false)
              setDraft('')
            }
          }}
          onBlur={commit}
          placeholder="Nombre…"
          className="px-3.5 py-1.5 rounded-full text-sm font-semibold border-2 border-slate-400 bg-white text-slate-900 placeholder:text-slate-300 focus:outline-none w-40"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="px-3.5 py-1.5 rounded-full text-sm font-semibold border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-700 transition"
        >
          + Nueva
        </button>
      )}
    </div>
  )
}

// Selector de imagen: zona para arrastrar o hacer clic, con vista previa.
export function ImagePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (dataUrl: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // Comprime la foto al subirla (máx. 900px, JPEG) para que la app vuele
  // y el almacenamiento nunca se llene.
  const readFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX = 900
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          onChange(reader.result as string)
          return
        }
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        onChange(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = () => onChange(reader.result as string)
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    readFile(e.dataTransfer.files?.[0])
  }

  return (
    <div className="mt-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          readFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 group">
          <img src={value} alt="Vista previa" className="w-full h-40 object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 p-2 bg-gradient-to-t from-black/40 to-transparent">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-white/95 hover:bg-white text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="bg-white/95 hover:bg-white text-red-600 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm"
            >
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={
            'w-full rounded-xl border-2 border-dashed px-4 py-8 flex flex-col items-center gap-2 transition ' +
            (dragging
              ? 'border-slate-400 bg-slate-50'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={'w-8 h-8 ' + (dragging ? 'text-slate-500' : 'text-slate-300')}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
            />
          </svg>
          <span className="text-sm font-medium text-slate-600">
            {dragging ? 'Suelta la imagen aquí' : 'Arrastra una imagen o haz clic para elegir'}
          </span>
          <span className="text-xs text-slate-400">JPG o PNG</span>
        </button>
      )}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string
  subtitle?: string
  back?: { to: string; label: string }
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-5 lg:mb-6 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="text-sm font-semibold text-slate-400 hover:text-slate-700">
            ← {back.label}
          </Link>
        )}
        <h2 className={'text-2xl lg:text-3xl font-bold' + (back ? ' mt-2' : '')}>{title}</h2>
        {subtitle && <p className="hidden lg:block text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0 flex gap-2 pt-1">{actions}</div>}
    </div>
  )
}

// Botón primario estándar de página (para PageHeader.actions)
export const primaryBtn =
  'bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold text-sm whitespace-nowrap'
