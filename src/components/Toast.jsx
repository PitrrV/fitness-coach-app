import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'

const ToastContext = createContext(null)

const VARIANT = {
  success: { icon: CheckCircle2, cls: 'border-teal/40 text-teal' },
  error: { icon: XCircle, cls: 'border-danger/40 text-danger' },
  info: { icon: Info, cls: 'border-accent/40 text-accent' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (message, variant = 'info', duration = 4000) => {
      const id = ++idRef.current
      setToasts((list) => [...list, { id, message, variant }])
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss]
  )

  const toast = {
    success: (message, duration) => notify(message, 'success', duration),
    error: (message, duration) => notify(message, 'error', duration),
    info: (message, duration) => notify(message, 'info', duration),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-4">
        {toasts.map((t) => {
          const { icon: Icon, cls } = VARIANT[t.variant] ?? VARIANT.info
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border bg-surface
                px-3.5 py-3 shadow-lg shadow-black/30 ${cls}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1 text-sm text-text">{t.message}</div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-muted hover:text-text"
                aria-label="Zavřít"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast musí být použit uvnitř <ToastProvider>.')
  return ctx
}
