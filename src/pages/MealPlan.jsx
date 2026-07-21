import { useEffect, useMemo, useState } from 'react'
import { ChefHat, RefreshCw, ShoppingCart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/api'
import { Button, Card, EmptyState, Eyebrow } from '../components/ui'
import { useToast } from '../components/Toast'
import { ListSkeleton } from '../components/Skeleton'

const DAY_OPTIONS = [1, 3, 7]

export default function MealPlan({ user }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [daysToGenerate, setDaysToGenerate] = useState(1)
  const [activeDay, setActiveDay] = useState(1)
  const toast = useToast()

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
      const result = await callFunction('generate-meal-plan', { days: daysToGenerate })
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
        <Eyebrow>Jídelníček</Eyebrow>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border p-0.5">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDaysToGenerate(d)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  daysToGenerate === d ? 'bg-accent/15 text-accent' : 'text-muted hover:text-text'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={handleGenerate} loading={generating}>
            <RefreshCw className="h-4 w-4" />
            {plan ? 'Přegenerovat' : 'Vygenerovat'}
          </Button>
        </div>
      </div>

      {!plan && !generating && (
        <EmptyState
          icon={ChefHat}
          title="Zatím nemáš jídelníček"
          description="Nech si ho vygenerovat na míru podle tvého profilu a cílů."
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
              Den {day.day}
            </button>
          ))}
        </div>
      )}

      {currentDay && (
        <Card>
          <Eyebrow className="mb-3">Den {currentDay.day}</Eyebrow>
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
          <ul className="space-y-1.5">
            {shoppingList.map((item, i) => (
              <li key={i} className="text-sm text-text">
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
