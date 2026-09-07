import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, Product } from '../store/useStore'
import { formatMXN, parseToCents, formatAmountInput } from '../lib/money'
import {
  CategoryPicker,
  ConfirmDelete,
  ImagePicker,
  Modal,
  PageShell,
} from '../components/ui'

type FormState = {
  name: string
  price: string
  cost: string
  imageDataUrl: string
  category: string
  owner: 'propio' | 'paletero'
  active: boolean
}
const emptyForm: FormState = {
  name: '',
  price: '',
  cost: '',
  imageDataUrl: '',
  category: '',
  owner: 'propio',
  active: true,
}

export default function Menu() {
  const products = useStore((s) => s.products)
  const addProduct = useStore((s) => s.addProduct)
  const updateProduct = useStore((s) => s.updateProduct)
  const deleteProduct = useStore((s) => s.deleteProduct)

  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)

  // --- administración de categorías ---
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort() as string[]
  const countIn = (c: string) => products.filter((p) => p.category === c).length
  const [catsOpen, setCatsOpen] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [catToDelete, setCatToDelete] = useState<string | null>(null)
  const [catBusy, setCatBusy] = useState(false)

  // Renombrar o vaciar ('' = sin categoría) una categoría en todos sus productos.
  const applyToCategory = async (from: string, to: string) => {
    setCatBusy(true)
    try {
      for (const p of products.filter((x) => x.category === from)) {
        await updateProduct(p.id, { category: to })
      }
    } catch (e) {
      alert('No se pudo actualizar: ' + (e as Error).message)
    } finally {
      setCatBusy(false)
    }
  }
  const commitRename = async () => {
    const to = renameValue.trim()
    if (renaming && to && to !== renaming) await applyToCategory(renaming, to)
    setRenaming(null)
  }

  const startNew = () => {
    setEditing('new')
    setForm(emptyForm)
  }
  const startEdit = (p: Product) => {
    setEditing(p.id)
    setForm({
      name: p.name,
      price: (p.priceCents / 100).toFixed(2),
      cost: (p.costCents / 100).toFixed(2),
      imageDataUrl: p.imageDataUrl ?? '',
      category: p.category ?? '',
      owner: p.owner === 'paletero' ? 'paletero' : 'propio',
      active: p.active !== false,
    })
  }
  const cancel = () => setEditing(null)
  const save = () => {
    const data = {
      name: form.name.trim(),
      priceCents: parseToCents(form.price),
      costCents: parseToCents(form.cost),
      imageDataUrl: form.imageDataUrl || null,
      category: form.category.trim(),
      owner: form.owner,
      active: form.active,
    }
    if (!data.name) return
    if (editing === 'new') {
      addProduct(data).catch((e) => alert('No se pudo guardar: ' + e.message))
    } else if (editing) {
      updateProduct(editing, data).catch((e) => alert('No se pudo actualizar: ' + e.message))
    }
    setEditing(null)
  }

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <Link to="/administrar" className="text-sm font-semibold text-slate-400 hover:text-slate-700">
            ← Administrar
          </Link>
          <h2 className="text-2xl lg:text-3xl font-bold mt-1">Menú</h2>
          <p className="hidden lg:block text-sm text-slate-500 mt-1">
            Administra los productos que se venden. Edita precios, costos e imágenes aquí.
          </p>
        </div>
        <div className="shrink-0 flex gap-2">
          <button
            onClick={() => setCatsOpen(true)}
            className="bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg font-semibold text-sm whitespace-nowrap"
          >
            Categorías
          </button>
          <button
            onClick={startNew}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 lg:px-5 py-2 lg:py-2.5 rounded-lg font-semibold text-sm lg:text-base whitespace-nowrap"
          >
            + Añadir <span className="hidden sm:inline">producto</span>
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-400">
          No hay productos. Toca «Añadir producto» para empezar.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Productos</h3>
            <span className="text-xs text-slate-400">
              {products.length} {products.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="text-left text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400 px-5 py-3 w-20">
                    Foto
                  </th>
                  <th className="text-left text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400 px-5 py-3">
                    Producto
                  </th>
                  <th className="text-right text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400 px-5 py-3 whitespace-nowrap">
                    Precio venta
                  </th>
                  <th className="text-right text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400 px-5 py-3 whitespace-nowrap">
                    Costo
                  </th>
                  <th className="text-right text-[11px] uppercase font-bold tracking-[0.08em] text-slate-400 px-5 py-3 w-48">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                        {p.imageDataUrl ? (
                          <img
                            src={p.imageDataUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400 text-center px-1 leading-tight">
                            Sin foto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className={'font-semibold ' + (p.active === false ? 'text-slate-400' : 'text-slate-900')}>
                        {p.name}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.category && (
                          <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {p.category}
                          </span>
                        )}
                        {p.owner === 'paletero' && (
                          <span className="text-[10px] font-bold uppercase bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded">
                            Paleta · consignación
                          </span>
                        )}
                        {p.active === false && (
                          <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            Pausado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <span className="font-bold text-slate-900">
                        {formatMXN(p.priceCents)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <span className="text-slate-600">{formatMXN(p.costCents)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(p)}
                          className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded text-sm font-semibold"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(p)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded text-sm font-semibold"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden">
            {products.map((p) => (
              <div
                key={p.id}
                className="border-t border-slate-100 first:border-0 p-4 flex gap-3"
              >
                <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                  {p.imageDataUrl ? (
                    <img
                      src={p.imageDataUrl}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 text-center px-1 leading-tight">
                      Sin foto
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={
                      'font-semibold leading-tight mb-1 truncate ' +
                      (p.active === false ? 'text-slate-400' : 'text-slate-900')
                    }
                  >
                    {p.name}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {p.category && (
                      <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {p.category}
                      </span>
                    )}
                    {p.owner === 'paletero' && (
                      <span className="text-[10px] font-bold uppercase bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded">
                        Paleta
                      </span>
                    )}
                    {p.active === false && (
                      <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        Pausado
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-bold text-slate-900">
                      {formatMXN(p.priceCents)}
                    </span>
                    <span className="text-xs text-slate-500">
                      Costo {formatMXN(p.costCents)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(p)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded text-sm font-semibold"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setConfirmDelete(p)}
                      className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded text-sm font-semibold"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {catsOpen && (
        <Modal title="Categorías" onClose={() => setCatsOpen(false)}>
          {categories.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              Aún no hay categorías. Se crean desde el formulario del producto.
            </p>
          ) : (
            <div className="space-y-1">
              {categories.map((c) => (
                <div key={c} className="flex items-center gap-2 py-2.5 border-b border-slate-100 last:border-0">
                  {renaming === c ? (
                    <>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setRenaming(null)
                        }}
                        className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-slate-500"
                      />
                      <button
                        onClick={commitRename}
                        disabled={catBusy || !renameValue.trim()}
                        className="bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white text-xs font-semibold px-3 py-2 rounded-lg"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setRenaming(null)}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-700 px-1"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 truncate">{c}</span>
                        <span className="block text-xs text-slate-400">
                          {countIn(c)} producto{countIn(c) === 1 ? '' : 's'}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setRenaming(c)
                          setRenameValue(c)
                        }}
                        disabled={catBusy}
                        className="text-xs font-medium text-slate-400 hover:text-slate-800 px-1.5 py-1"
                      >
                        Renombrar
                      </button>
                      <button
                        onClick={() => setCatToDelete(c)}
                        disabled={catBusy}
                        className="text-xs font-medium text-slate-300 hover:text-red-600 px-1.5 py-1"
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-4">
            Al renombrar, todos sus productos se actualizan. Al eliminar, los productos no se
            borran: quedan «Sin categoría».
          </p>
          <button
            onClick={() => setCatsOpen(false)}
            className="w-full mt-4 bg-slate-100 hover:bg-slate-200 font-semibold py-2.5 rounded-lg"
          >
            Cerrar
          </button>
        </Modal>
      )}

      {catToDelete && (
        <ConfirmDelete
          text={`Se eliminará la categoría «${catToDelete}». Sus ${countIn(catToDelete)} producto(s) quedarán sin categoría (no se borran).`}
          onCancel={() => setCatToDelete(null)}
          onConfirm={() => {
            applyToCategory(catToDelete, '')
            setCatToDelete(null)
          }}
        />
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
            <h3 className="text-xl font-bold mb-4">
              {editing === 'new' ? 'Nuevo producto' : 'Editar producto'}
            </h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Nombre</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded px-3 py-2"
                  placeholder="Ej. Paquete de tacos"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Precio (MXN)</span>
                  <input
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: formatAmountInput(e.target.value) })}
                    inputMode="decimal"
                    className="mt-1 w-full border border-slate-200 rounded px-3 py-2"
                    placeholder="0.00"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Costo (MXN)</span>
                  <input
                    value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: formatAmountInput(e.target.value) })}
                    inputMode="decimal"
                    className="mt-1 w-full border border-slate-200 rounded px-3 py-2"
                    placeholder="0.00"
                  />
                </label>
              </div>
              <div>
                <span className="text-sm font-medium">Categoría</span>
                <CategoryPicker
                  options={
                    [...new Set(products.map((p) => p.category).filter(Boolean))].sort() as string[]
                  }
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                />
              </div>
              <label className="block">
                <span className="text-sm font-medium">Dueño del producto</span>
                <select
                  value={form.owner}
                  onChange={(e) =>
                    setForm({ ...form, owner: e.target.value as 'propio' | 'paletero' })
                  }
                  className="mt-1 w-full border border-slate-200 rounded px-3 py-2 bg-white"
                >
                  <option value="propio">De FresaFé (propio)</option>
                  <option value="paletero">Del paletero (consignación, se le paga su parte)</option>
                </select>
              </label>
              <label className="flex items-center gap-2.5 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 accent-slate-900"
                />
                <span className="text-sm font-medium">
                  Activo <span className="text-slate-400 font-normal">(visible en Cobranza)</span>
                </span>
              </label>
              <div>
                <span className="text-sm font-medium">Imagen</span>
                <ImagePicker
                  value={form.imageDataUrl}
                  onChange={(v) => setForm((f) => ({ ...f, imageDataUrl: v }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={cancel}
                className="flex-1 px-4 py-2.5 rounded bg-slate-100 hover:bg-slate-200 font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                className="flex-1 px-4 py-2.5 rounded bg-slate-900 hover:bg-slate-800 text-white font-semibold"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-lg mb-2">¿Estás seguro?</h3>
            <p className="text-slate-600 mb-5">
              Se eliminará el producto «{confirmDelete.name}».
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 font-semibold py-2 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteProduct(confirmDelete.id)
                  setConfirmDelete(null)
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
