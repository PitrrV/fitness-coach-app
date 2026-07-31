import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/api'
import { ACTIVITY_LEVELS, ALLERGENS, GOALS, calcProfileTargets } from '../lib/calc'
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
  budgetCzkWeek: '',
  favoriteFoods: '',
  dislikedFoods: '',
  allergens: [],
}

export default function Profile({ user, onSaved }) {
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
          budgetCzkWeek: data.budget_czk_week ?? '',
          favoriteFoods: data.favorite_foods ?? '',
          dislikedFoods: data.disliked_foods ?? '',
          allergens: data.allergens ?? [],
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

  function toggleAllergen(value) {
    setForm((f) => ({
      ...f,
      allergens: f.allergens.includes(value)
        ? f.allergens.filter((a) => a !== value)
        : [...f.allergens, value],
    }))
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
        budget_czk_week: form.budgetCzkWeek ? Number(form.budgetCzkWeek) : null,
        favorite_foods: form.favoriteFoods || null,
        disliked_foods: form.dislikedFoods || null,
        allergens: form.allergens,
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

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      await callFunction('delete-account', {})
      toast.success('Účet a všechna data byla smazána.')
      await supabase.auth.signOut()
    } catch (err) {
      toast.error(err.message || 'Smazání účtu se nezdařilo.')
      setDeleting(false)
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

          <div className="border-t border-border pt-3.5">
            <Eyebrow className="mb-3">Rozpočet a preference jídla</Eyebrow>
          </div>

          <Field
            label="Maximální rozpočet na jídlo (Kč/týden)"
            hint="Nepovinné — AI se ho pokusí dodržet při sestavování jídelníčku"
          >
            <input
              type="number"
              min={0}
              step="10"
              className={inputCls}
              value={form.budgetCzkWeek}
              onChange={(e) => update('budgetCzkWeek', e.target.value)}
            />
          </Field>

          <Field label="Oblíbené potraviny" hint="Nepovinné — co máš rád/a a AI to může zařazovat častěji">
            <textarea
              rows={2}
              className={inputCls}
              value={form.favoriteFoods}
              onChange={(e) => update('favoriteFoods', e.target.value)}
            />
          </Field>

          <Field label="Nechtěné potraviny" hint="Nepovinné — čemu se má AI vyhnout">
            <textarea
              rows={2}
              className={inputCls}
              value={form.dislikedFoods}
              onChange={(e) => update('dislikedFoods', e.target.value)}
            />
          </Field>

          <Field label="Alergeny a intolerance" hint="Vyber vše, co se má v jídelníčku vynechat">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {ALLERGENS.map((a) => {
                const active = form.allergens.includes(a.value)
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => toggleAllergen(a.value)}
                    className={`rounded-xl border px-2.5 py-1.5 text-left text-xs font-medium transition ${
                      active ? 'border-accent/60 bg-accent/15 text-accent' : 'border-border text-muted hover:text-text'
                    }`}
                  >
                    {a.label}
                  </button>
                )
              })}
            </div>
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

      <Card className="border-danger/40">
        <Eyebrow className="mb-3">Nebezpečná zóna</Eyebrow>
        {!confirmDelete ? (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Smazat můj účet a všechna data
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-text">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <p>
                Tohle nevratně smaže tvůj účet, profil, check-iny (včetně fotek), jídelníčky i tréninkové
                plány. Fakt to chceš udělat?
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="danger" onClick={handleDeleteAccount} loading={deleting} className="flex-1">
                Ano, smazat vše
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting} className="flex-1">
                Zrušit
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
