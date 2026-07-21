import { useEffect, useState } from 'react'
import { Dumbbell, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/api'
import { Button, Card, EmptyState, Eyebrow } from '../components/ui'
import { useToast } from '../components/Toast'
import { ListSkeleton } from '../components/Skeleton'

export default function TrainingPlan({ user }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error } = await supabase
        .from('training_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!active) return
      if (error) toast.error('Nepodařilo se načíst tréninkový plán.')
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
      const result = await callFunction('generate-training-plan', {})
      setPlan(result.plan)
      toast.success('Tréninkový plán vygenerován.')
    } catch (err) {
      toast.error(err.message || 'Generování tréninkového plánu se nezdařilo.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <ListSkeleton rows={3} />

  const days = plan?.plan_json?.days ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Eyebrow>Trénink</Eyebrow>
        <Button variant="secondary" onClick={handleGenerate} loading={generating}>
          <RefreshCw className="h-4 w-4" />
          {plan ? 'Přegenerovat' : 'Vygenerovat'}
        </Button>
      </div>

      {!plan && !generating && (
        <EmptyState
          icon={Dumbbell}
          title="Zatím nemáš tréninkový plán"
          description="Nech si ho vygenerovat na míru podle tvého profilu a cílů."
          action={<Button onClick={handleGenerate}>Vygenerovat plán</Button>}
        />
      )}

      {days.map((day, i) => (
        <Card key={i}>
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow>Den {day.day}</Eyebrow>
            {day.focus && <span className="text-xs text-muted">{day.focus}</span>}
          </div>
          <div className="space-y-2">
            {day.exercises?.map((ex, j) => (
              <div key={j} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="text-sm text-text">{ex.name}</div>
                <div className="text-xs text-muted">
                  {ex.sets} × {ex.reps}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
