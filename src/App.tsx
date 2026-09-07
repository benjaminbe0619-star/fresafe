import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar, { MobileTabBar } from './components/Sidebar'
import LateConfirmationToast from './components/LateConfirmationToast'
import { useLateConfirmations } from './hooks/useLateConfirmations'
import { DENOMINATIONS } from './lib/denominations'
import { useStore } from './store/useStore'
import Menu from './pages/Menu'
import Configuracion from './pages/Configuracion'
import Cobranza from './pages/Cobranza'
import Pedidos from './pages/Pedidos'
import Reportes from './pages/Reportes'
import Administrar from './pages/Administrar'
import Gastos from './pages/Gastos'
import Sueldos from './pages/Sueldos'
import Mermas from './pages/Mermas'
import Socio from './pages/Socio'
import Paletas from './pages/Paletas'
import Canal from './pages/Canal'

const SYNC_INTERVAL = 10_000

export default function App() {
  const { toast, dismissToast } = useLateConfirmations()
  const syncFromServer = useStore((s) => s.syncFromServer)
  const syncError = useStore((s) => s.syncError)

  useEffect(() => {
    DENOMINATIONS.forEach((d) => {
      const img = new Image()
      img.decoding = 'async'
      img.src = d.img
    })
  }, [])

  useEffect(() => {
    syncFromServer()
    const interval = setInterval(() => {
      syncFromServer()
    }, SYNC_INTERVAL)
    const onFocus = () => syncFromServer()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [syncFromServer])

  return (
    <BrowserRouter>
      <div className="flex flex-col h-full bg-white text-slate-900">
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-hidden">
            <Routes>
              <Route path="/" element={<Navigate to="/cobranza" replace />} />
              <Route path="/cobranza" element={<Cobranza />} />
              <Route path="/pedidos" element={<Pedidos />} />
              <Route path="/reportes" element={<Navigate to="/reportes/resumen" replace />} />
              <Route path="/reportes/:view" element={<Reportes />} />
              <Route path="/administrar" element={<Administrar />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/gastos" element={<Gastos />} />
              <Route path="/sueldos" element={<Sueldos />} />
              <Route path="/mermas" element={<Mermas />} />
              <Route path="/socio" element={<Socio />} />
              <Route path="/paletas" element={<Paletas />} />
              <Route path="/rappi" element={<Canal channel="rappi" />} />
              <Route path="/uber" element={<Canal channel="uber" />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="/ventas" element={<Navigate to="/reportes/ventas" replace />} />
              <Route path="/finanzas" element={<Navigate to="/reportes/finanzas" replace />} />
              <Route path="/estadisticas" element={<Navigate to="/reportes/estadisticas" replace />} />
              <Route path="/delivery" element={<Navigate to="/pedidos" replace />} />
              <Route path="*" element={<Navigate to="/cobranza" replace />} />
            </Routes>
          </main>
        </div>
        <MobileTabBar />
        {toast && (
          <LateConfirmationToast amountCents={toast.amountCents} onDismiss={dismissToast} />
        )}
        {syncError && (
          <div className="fixed bottom-2 left-2 right-2 md:left-auto md:right-4 md:max-w-sm bg-red-50 border border-red-300 rounded-lg p-2 text-xs text-red-800 shadow-lg z-40">
            {syncError}
          </div>
        )}
      </div>
    </BrowserRouter>
  )
}
