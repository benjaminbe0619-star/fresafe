export type Denomination = {
  id: string
  cents: number
  label: string
  kind: 'bill' | 'coin'
  img: string
}

export const DENOMINATIONS: Denomination[] = [
  { id: 'b1000', cents: 100000, label: '$1000', kind: 'bill', img: '/imagenes/1000.png' },
  { id: 'b500', cents: 50000, label: '$500', kind: 'bill', img: '/imagenes/500.png' },
  { id: 'b200', cents: 20000, label: '$200', kind: 'bill', img: '/imagenes/200.png' },
  { id: 'b100', cents: 10000, label: '$100', kind: 'bill', img: '/imagenes/100.png' },
  { id: 'b50', cents: 5000, label: '$50', kind: 'bill', img: '/imagenes/50.png' },
  { id: 'b20', cents: 2000, label: '$20', kind: 'bill', img: '/imagenes/20.png' },
  { id: 'c20', cents: 2000, label: '$20', kind: 'coin', img: '/imagenes/moneda20.png' },
  { id: 'c10', cents: 1000, label: '$10', kind: 'coin', img: '/imagenes/moneda10.png' },
  { id: 'c5', cents: 500, label: '$5', kind: 'coin', img: '/imagenes/moneda5.png' },
  { id: 'c2', cents: 200, label: '$2', kind: 'coin', img: '/imagenes/moneda2.png' },
  { id: 'c1', cents: 100, label: '$1', kind: 'coin', img: '/imagenes/moneda1.png' },
  { id: 'c50c', cents: 50, label: '$0.50', kind: 'coin', img: '/imagenes/moneda50c.png' },
]
