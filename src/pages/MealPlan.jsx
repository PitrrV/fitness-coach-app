import { useEffect, useMemo, useState } from 'react'
import { CheckSquare, ChefHat, RefreshCw, Square, ShoppingCart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/api'
import { Button, Card, EmptyState, Eyebrow } from '../components/ui'
import { useToast } from '../components/Toast'
import { ListSkeleton } from '../components/Skeleton'
import { useChecklist } from '../lib/useChecklist'

const WEEKDAYS = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle']
const WEEKDAYS_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

export default function MealPlan({ user }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeDay, setActiveDay] = useState(1)
  const toast = useToast()
  const [checkedItems, toggleItem] = useChecklist(`meal-checks-${plan?.id ?? 'none'}`)

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!active) return
      if (error) toast.error('Nepodařilo se načíst jídelníček.')
      else if (data) {
        setPlan(data)
        setActiveDay(1)
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [user.id])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const result = await callFunction('generate-meal-plan', {})
      setPlan(result.plan)
      setActiveDay(1)
      toast.success('Jídelníček vygenerován.')
    } catch (err) {
      toast.error(err.message || 'Generování jídelníčku se nezdařilo.')
    } finally {
      setGenerating(false)
    }
  }

  const days = plan?.plan_json?.days ?? []
  const shoppingList = plan?.plan_json?.shoppingList ?? []
  const currentDay = useMemo(() => days.find((d) => d.day === activeDay) ?? days[0], [days, activeDay])

  if (loading) return <ListSkeleton rows={3} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Eyebrow>Jídelníček na týden (Po–Ne)</Eyebrow>
        <Button variant="secondary" onClick={handleGenerate} loading={generating}>
          <RefreshCw className="h-4 w-4" />
          {plan ? 'Přegenerovat' : 'Vygenerovat'}
        </Button>
      </div>

      {!plan && !generating && (
        <EmptyState
          icon={ChefHat}
          title="Zatím nemáš jídelníček"
          description="Nech si ho vygenerovat na míru podle tvého profilu a cílů — appka vždy sestaví celý týden, pondělí až neděle."
          action={<Button onClick={handleGenerate}>Vygenerovat jídelníček</Button>}
        />
      )}

      {days.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {days.map((day) => (
            <button
              key={day.day}
              onClick={() => setActiveDay(day.day)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                day.day === currentDay?.day ? 'bg-accent/15 text-accent' : 'bg-surface text-muted hover:text-text'
              }`}
            >
              {WEEKDAYS_SHORT[day.day - 1] ?? `Den ${day.day}`}
            </button>
          ))}
        </div>
      )}

      {currentDay && (
        <Card>
          <Eyebrow className="mb-3">{WEEKDAYS[currentDay.day - 1] ?? `Den ${currentDay.day}`}</Eyebrow>
          <div className="space-y-3">
            {currentDay.meals?.map((meal, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-text">{meal.name}</div>
                  <div className="text-xs text-muted">{meal.totals?.kcal} kcal</div>
                </div>
                <ul className="mt-2 space-y-1">
                  {meal.items?.map((item, j) => (
                    <li key={j} className="text-sm text-muted">
                      {item.food} — {item.grams} g
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {currentDay.totals && (
            <div className="mt-3 text-sm text-muted">
              Celkem: {currentDay.totals.kcal} kcal · B {currentDay.totals.protein}g · T {currentDay.totals.fat}g · S{' '}
              {currentDay.totals.carbs}g
            </div>
          )}
        </Card>
      )}

      {shoppingList.length > 0 && (
        <Card>
          <Eyebrow className="mb-3 flex items-center gap-2">
            <ShoppingCart className="h-3.5 w-3.5" />
            Nákupní seznam
          </Eyebrow>
          <ul className="space-y-1">
            {shoppingList.map((item, i) => {
              const done = !!checkedItems[i]
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggleItem(i)}
                    className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-white/5"
                  >
                    {done ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-teal" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-muted" />
                    )}
                    <span className={`text-sm ${done ? 'text-muted line-through' : 'text-text'}`}>{item}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
