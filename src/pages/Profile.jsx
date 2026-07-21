import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ACTIVITY_LEVELS, GOALS, calcProfileTargets } from '../lib/calc'
import { Button, Card, Eyebrow, Field, MacroSplitBar, Metric, MiniMacro, inputCls } from '../components/ui'
import { useToast } from '../components/Toast'
import { ListSkeleton } from '../components/Skeleton'

const emptyForm = {
  name: '',
  sex: 'male',
  age: '',
  heightCm: '',
  weightKg: '',
  activityLevel: 'moderate',
  goal: 'maintain',
  targetWeightKg: '',
}

export default function Profile({ user, onSaved }) {
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!active) return
      if (error) {
        toast.error('Nepodařilo se načíst profil.')
      } else if (data) {
        setForm({
          name: data.name ?? '',
          sex: data.sex ?? 'male',
          age: data.age ?? '',
          heightCm: data.height_cm ?? '',
          weightKg: data.weight_kg ?? '',
          activityLevel: data.activity_level ?? 'moderate',
          goal: data.goal ?? 'maintain',
          targetWeightKg: data.target_weight_kg ?? '',
        })
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [user.id])

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const isComplete = form.age && form.heightCm && form.weightKg
  const targets = isComplete
    ? calcProfileTargets({
        sex: form.sex,
        age: Number(form.age),
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        activityLevel: form.activityLevel,
        goal: form.goal,
      })
    : null

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        name: form.name || null,
        sex: form.sex,
        age: Number(form.age),
        height_cm: Number(form.heightCm),
        weight_kg: Number(form.weightKg),
        activity_level: form.activityLevel,
        goal: form.goal,
        target_weight_kg: form.targetWeightKg ? Number(form.targetWeightKg) : null,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' })
      if (error) throw error
      toast.success('Profil uložen.')
      onSaved?.()
    } catch (err) {
      toast.error(err.message || 'Uložení profilu se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <ListSkeleton rows={3} />

  return (
    <div className="space-y-4">
      <Card>
        <Eyebrow className="mb-3">Osobní údaje</Eyebrow>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Field label="Jméno">
            <input className={inputCls} value={form.name} onChange={(e) => update('name', e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Pohlaví">
              <select className={inputCls} value={form.sex} onChange={(e) => update('sex', e.target.value)}>
                <option value="male">Muž</option>
                <option value="female">Žena</option>
              </select>
            </Field>
            <Field label="Věk">
              <input
                type="number"
                required
                min={10}
                max={100}
                className={inputCls}
                value={form.age}
                onChange={(e) => update('age', e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Výška (cm)">
              <input
                type="number"
                required
                min={100}
                max={250}
                className={inputCls}
                value={form.heightCm}
                onChange={(e) => update('heightCm', e.target.value)}
              />
            </Field>
            <Field label="Váha (kg)">
              <input
                type="number"
                required
                min={30}
                max={300}
                step="0.1"
                className={inputCls}
                value={form.weightKg}
                onChange={(e) => update('weightKg', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Úroveň aktivity">
            <select
              className={inputCls}
              value={form.activityLevel}
              onChange={(e) => update('activityLevel', e.target.value)}
            >
              {Object.entries(ACTIVITY_LEVELS).map(([key, v]) => (
                <option key={key} value={key}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cíl">
            <select className={inputCls} value={form.goal} onChange={(e) => update('goal', e.target.value)}>
              {Object.entries(GOALS).map(([key, v]) => (
                <option key={key} value={key}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cílová váha (kg)" hint="Nepovinné">
            <input
              type="number"
              step="0.1"
              className={inputCls}
              value={form.targetWeightKg}
              onChange={(e) => update('targetWeightKg', e.target.value)}
            />
          </Field>

          <Button type="submit" className="w-full" loading={saving}>
            Uložit profil
          </Button>
        </form>
      </Card>

      {targets && (
        <Card>
          <Eyebrow className="mb-3">Tvoje denní cíle</Eyebrow>
          <div className="grid grid-cols-3 gap-4">
            <Metric label="BMR" value={targets.bmr} unit="kcal" />
            <Metric label="TDEE" value={targets.tdee} unit="kcal" />
            <Metric label="Cíl" value={targets.calories} unit="kcal" tone="accent" />
          </div>
          <div className="mt-4">
            <MacroSplitBar protein={targets.protein} fat={targets.fat} carbs={targets.carbs} />
            <div className="mt-3 space-y-1.5">
              <MiniMacro label="Bílkoviny" grams={targets.protein.g} kcal={targets.protein.kcal} colorClass="bg-accent" />
              <MiniMacro label="Tuky" grams={targets.fat.g} kcal={targets.fat.kcal} colorClass="bg-teal" />
              <MiniMacro label="Sacharidy" grams={targets.carbs.g} kcal={targets.carbs.kcal} colorClass="bg-muted" />
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
