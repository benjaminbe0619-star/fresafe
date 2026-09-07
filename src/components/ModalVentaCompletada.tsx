import { Sale } from '../store/useStore'
import { formatMXN } from '../lib/money'

export default function ModalVentaCompletada({
  sale,
  onClose,
}: {
  sale: Sale
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 text-center border-b border-slate-200">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg
              className="w-9 h-9 text-emerald-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold">
            {sale.method === 'app' ? '¡Pedido registrado!' : '¡Venta completada!'}
          </h3>
        </div>

        <div className="p-6 space-y-3">
          <Row
            label={sale.method === 'app' ? 'Canal' : 'Método de pago'}
            value={
              sale.method === 'app'
                ? sale.channel === 'uber'
                  ? 'Uber Eats'
                  : 'Rappi'
                : sale.method === 'efectivo'
                  ? 'Efectivo'
                  : 'Tarjeta'
            }
          />
          <Row label="Productos" value={`${sale.items.reduce((a, i) => a + i.qty, 0)} artículo(s)`} />
          <Row label="Monto de la venta" value={formatMXN(sale.totalCents)} />
          {sale.method === 'app' && (sale.channelFeeCents ?? 0) > 0 && (
            <Row
              label="Comisión de la app"
              value={`−${formatMXN(sale.channelFeeCents ?? 0)}`}
            />
          )}
          {sale.method === 'efectivo' && (
            <>
              <Row label="Monto recibido" value={formatMXN(sale.receivedCents)} />
              <Row label="Cambio a entregar" value={formatMXN(sale.changeCents)} highlight />
            </>
          )}
        </div>

        <div className="p-6 pt-0">
          <button
            onClick={onClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg text-lg"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-600">{label}</span>
      <span className={highlight ? 'text-emerald-600 font-bold text-2xl' : 'font-semibold'}>
        {value}
      </span>
    </div>
  )
}
