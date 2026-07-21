import { useEffect, useState } from 'react'
import { ChefHat, RefreshCw, ShoppingCart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/api'
import { Button, Card, EmptyState, Eyebrow } from '../components/ui'
import { useToast } from '../components/Toast'
import { ListSkeleton } from '../components/Skeleton'

export default function MealPlan({ user }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
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
      else if (data) setPlan(data)
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
      const result = await callFunction('generate-meal-plan', { days: 1 })
      setPlan(result.plan)
      toast.success('Jídelníček vygenerován.')
    } catch (err) {
      toast.error(err.message || 'Generování jídelníčku se nezdařilo.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <ListSkeleton rows={3} />

  const days = plan?.plan_json?.days ?? []
  const shoppingList = plan?.plan_json?.shoppingList ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Eyebrow>Jídelníček</Eyebrow>
        <Button variant="secondary" onClick={handleGenerate} loading={generating}>
          <RefreshCw className="h-4 w-4" />
          {plan ? 'Přegenerovat' : 'Vygenerovat'}
        </Button>
      </div>

      {!plan && !generating && (
        <EmptyState
          icon={ChefHat}
          title="Zatím nemáš jídelníček"
          description="Nech si ho vygenerovat na míru podle tvého profilu a cílů."
          action={<Button onClick={handleGenerate}>Vygenerovat jídelníček</Button>}
        />
      )}

      {days.map((day) => (
        <Card key={day.day}>
          <Eyebrow className="mb-3">Den {day.day}</Eyebrow>
          <div className="space-y-3">
            {day.meals?.map((meal, i) => (
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
          {day.totals && (
            <div className="mt-3 text-sm text-muted">
              Celkem: {day.totals.kcal} kcal · B {day.totals.protein}g · T {day.totals.fat}g · S {day.totals.carbs}g
            </div>
          )}
        </Card>
      ))}

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
