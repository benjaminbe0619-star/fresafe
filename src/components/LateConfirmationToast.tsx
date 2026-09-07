import { useEffect } from 'react'
import { formatMXN } from '../lib/money'

type Props = {
  amountCents: number
  onDismiss: () => void
}

export default function LateConfirmationToast({ amountCents, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 12_000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed top-4 right-4 z-[60] bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-xl p-4 max-w-sm animate-in">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-amber-900">Cobro tardío confirmado</div>
          <div className="text-sm text-slate-700 mt-1 leading-snug">
            Llegó la confirmación de un cobro de{' '}
            <span className="font-bold">{formatMXN(amountCents)}</span> que pensábamos había
            expirado. Se registró automáticamente en Ventas.
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-slate-500 hover:text-slate-900 text-2xl leading-none"
          aria-label="Cerrar aviso"
        >
          ×
        </button>
      </div>
    </div>
  )
}
