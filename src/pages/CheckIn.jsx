import { useEffect, useState } from 'react'
import { Camera, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, EmptyState, Eyebrow, Field, inputCls } from '../components/ui'
import { useToast } from '../components/Toast'
import { ListSkeleton } from '../components/Skeleton'
import CheckInDetailModal from '../components/CheckInDetailModal'

const emptyForm = {
  weightKg: '',
  bodyFatPct: '',
  waistCm: '',
  hipCm: '',
  chestCm: '',
  armCm: '',
  thighCm: '',
  notes: '',
}

export default function CheckIn({ user }) {
  const [form, setForm] = useState(emptyForm)
  const [photo, setPhoto] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const toast = useToast()

  async function loadHistory() {
    const { data, error } = await supabase
      .from('check_ins')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(30)
    if (error) toast.error('Nepodařilo se načíst historii.')
    else setHistory(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadHistory()
  }, [user.id])

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let photoPath = null
      if (photo) {
        const ext = photo.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('measurement-photos')
          .upload(path, photo)
        if (uploadError) throw uploadError
        photoPath = path
      }

      const payload = {
        user_id: user.id,
        date: new Date().toISOString().slice(0, 10),
        weight_kg: form.weightKg ? Number(form.weightKg) : null,
        body_fat_pct: form.bodyFatPct ? Number(form.bodyFatPct) : null,
        waist_cm: form.waistCm ? Number(form.waistCm) : null,
        hip_cm: form.hipCm ? Number(form.hipCm) : null,
        chest_cm: form.chestCm ? Number(form.chestCm) : null,
        arm_cm: form.armCm ? Number(form.armCm) : null,
        thigh_cm: form.thighCm ? Number(form.thighCm) : null,
        notes: form.notes || null,
        photo_path: photoPath,
      }

      const { error } = await supabase.from('check_ins').insert(payload)
      if (error) throw error

      toast.success('Check-in uložen.')
      setForm(emptyForm)
      setPhoto(null)
      await loadHistory()
    } catch (err) {
      toast.error(err.message || 'Uložení check-inu se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <Eyebrow className="mb-3">Nový check-in</Eyebrow>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Váha (kg)">
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.weightKg}
                onChange={(e) => update('weightKg', e.target.value)}
              />
            </Field>
            <Field label="Tělesný tuk (%)">
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.bodyFatPct}
                onChange={(e) => update('bodyFatPct', e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Pas (cm)">
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.waistCm}
                onChange={(e) => update('waistCm', e.target.value)}
              />
            </Field>
            <Field label="Boky (cm)">
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.hipCm}
                onChange={(e) => update('hipCm', e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Hrudník (cm)">
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.chestCm}
                onChange={(e) => update('chestCm', e.target.value)}
              />
            </Field>
            <Field label="Paže (cm)">
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.armCm}
                onChange={(e) => update('armCm', e.target.value)}
              />
            </Field>
            <Field label="Stehno (cm)">
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.thighCm}
                onChange={(e) => update('thighCm', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Poznámka">
            <textarea
              rows={2}
              className={inputCls}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </Field>

          <Field label="Fotka" hint="Nepovinné, uloží se do soukromého úložiště">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted hover:border-accent/60">
              <Camera className="h-4 w-4" />
              {photo ? photo.name : 'Vybrat fotku'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          </Field>

          <Button type="submit" className="w-full" loading={saving}>
            Uložit check-in
          </Button>
        </form>
      </Card>

      <Eyebrow>Historie</Eyebrow>
      {loading ? (
        <ListSkeleton rows={3} />
      ) : history.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Zatím žádné záznamy" description="Přidej svůj první check-in výše." />
      ) : (
        <div className="space-y-2.5">
          {history.map((row) => (
            <Card
              key={row.id}
              onClick={() => setSelected(row)}
              className="flex cursor-pointer items-center justify-between hover:border-accent/60"
            >
              <div>
                <div className="text-sm font-semibold text-text">{row.date}</div>
                <div className="text-xs text-muted">
                  {row.weight_kg ? `${row.weight_kg} kg` : '—'}
                  {row.body_fat_pct ? ` · ${row.body_fat_pct} % tuku` : ''}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && <CheckInDetailModal checkIn={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
