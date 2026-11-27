import { useEffect, useState } from 'react'

interface ToastItem {
  id: number
  text: string
}

let seq = 1
const listeners = new Set<(item: ToastItem) => void>()

export function showToast(text: string) {
  const item: ToastItem = { id: seq++, text }
  listeners.forEach((fn) => fn(item))
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const onToast = (item: ToastItem) => {
      setItems((prev) => [...prev.slice(-2), item])
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id))
      }, 2600)
    }
    listeners.add(onToast)
    return () => {
      listeners.delete(onToast)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="toast-stack no-print" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast-pill">
          <span className="toast-dot" aria-hidden="true" />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
