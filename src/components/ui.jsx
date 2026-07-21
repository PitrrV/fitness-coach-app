// Sdílené UI komponenty — drží jednotný vizuální styl (tmavé "ink" téma).

export const inputCls =
  'w-full rounded-xl border border-border bg-ink px-3 py-2 text-sm text-text placeholder:text-muted ' +
  'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition'

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-4 sm:p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function Eyebrow({ children, className = '' }) {
  return (
    <div className={`text-xs font-semibold uppercase tracking-wider text-muted ${className}`}>
      {children}
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      {label && <div className="mb-1.5 text-sm font-medium text-text">{label}</div>}
      {children}
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </label>
  )
}

const buttonVariants = {
  primary: 'bg-accent text-ink hover:brightness-110 disabled:opacity-50',
  secondary: 'bg-surface border border-border text-text hover:border-accent/60 disabled:opacity-50',
  ghost: 'text-muted hover:text-text hover:bg-white/5 disabled:opacity-50',
  danger: 'bg-danger text-white hover:brightness-110 disabled:opacity-50',
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  loading = false,
  disabled,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold
        transition disabled:cursor-not-allowed ${buttonVariants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}

export function Metric({ label, value, unit, tone = 'default' }) {
  const toneCls =
    tone === 'accent' ? 'text-accent' : tone === 'teal' ? 'text-teal' : tone === 'danger' ? 'text-danger' : 'text-text'
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold ${toneCls}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
      </div>
    </div>
  )
}

export function MiniMacro({ label, grams, kcal, colorClass = 'bg-accent' }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorClass}`} />
      <div className="flex-1 text-sm">
        <span className="text-text">{label}</span>{' '}
        <span className="text-muted">
          {grams} g · {kcal} kcal
        </span>
      </div>
    </div>
  )
}

/** Vodorovný pruh poměru makroživin. Barvy/šířky řešeny inline stylem (Tailwind purguje dynamické třídy). */
export function MacroSplitBar({ protein, fat, carbs }) {
  const total = Math.max(1, protein.kcal + fat.kcal + carbs.kcal)
  const seg = (kcal, color) => ({ width: `${(kcal / total) * 100}%`, backgroundColor: color })
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink">
      <div style={seg(protein.kcal, '#C9824A')} />
      <div style={seg(fat.kcal, '#4FA398')} />
      <div style={seg(carbs.kcal, '#8B93A7')} />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-muted" />}
      <div className="text-sm font-semibold text-text">{title}</div>
      {description && <div className="mt-1 max-w-xs text-sm text-muted">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
