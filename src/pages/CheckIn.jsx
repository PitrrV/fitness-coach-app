import { useEffect, useState } from 'react'
import { ClipboardList, ScanLine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/api'
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
  muscleMassKg: '',
  visceralFat: '',
  measurementSource: 'manual',
  notes: '',
}

const SOURCE_LABELS = {
  inbody: 'InBody',
  caliper: 'Kaliper',
  smart_scale: 'Chytrá váha',
  manual: 'Ručně',
  unknown: 'Neznámý',
}

const FIELD_TO_KEY = {
  weight_kg: 'weightKg',
  body_fat_pct: 'bodyFatPct',
  waist_cm: 'waistCm',
  hip_cm: 'hipCm',
  chest_cm: 'chestCm',
  arm_cm: 'armCm',
  thigh_cm: 'thighCm',
  muscle_mass_kg: 'muscleMassKg',
  visceral_fat: 'visceralFat',
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('Čtení souboru se nezdařilo.'))
    reader.readAsDataURL(file)
  })
}

export default function CheckIn({ user }) {
  const [form, setForm] = useState(emptyForm)
  const [photo, setPhoto] = useState(null)
  const [confidence, setConfidence] = useState({})
  const [ocrLoading, setOcrLoading] = useState(false)
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

  async function handleFileSelected(file) {
    setPhoto(file)
    setConfidence({})
    if (!file) return

    setOcrLoading(true)
    try {
      let imageFile = file
      if (file.type === 'application/pdf') {
        const { pdfFirstPageToImageFile } = await import('../lib/pdfToImage')
        imageFile = await pdfFirstPageToImageFile(file)
      }
      const imageBase64 = await fileToBase64(imageFile)
      const result = await callFunction('ocr-measurement', {
        imageBase64,
        mimeType: imageFile.type,
      })

      setForm((f) => {
        const next = { ...f }
        for (const [apiKey, formKey] of Object.entries(FIELD_TO_KEY)) {
          const value = result.values?.[apiKey]
          if (value != null) next[formKey] = value
        }
        if (result.measurement_source) next.measurementSource = result.measurement_source
        return next
      })
      setConfidence(result.confidence ?? {})
      toast.success('Hodnoty načteny — zkontroluj je před uložením.')
    } catch (err) {
      toast.error(err.message || 'Přečtení skenu se nezdařilo, zadej hodnoty ručně.')
    } finally {
      setOcrLoading(false)
    }
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
        muscle_mass_kg: form.muscleMassKg ? Number(form.muscleMassKg) : null,
        visceral_fat: form.visceralFat ? Number(form.visceralFat) : null,
        measurement_source: form.measurementSource,
        notes: form.notes || null,
        photo_path: photoPath,
      }

      const { error } = await supabase.from('check_ins').insert(payload)
      if (error) throw error

      toast.success('Check-in uložen.')
      setForm(emptyForm)
      setPhoto(null)
      setConfidence({})
      await loadHistory()
    } catch (err) {
      toast.error(err.message || 'Uložení check-inu se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  function fieldHint(apiKey) {
    const level = confidence[apiKey]
    if (level === 'low') return 'AI si touto hodnotou není jistá — zkontroluj ji'
    return undefined
  }

  return (
    <div className="space-y-4">
      <Card>
        <Eyebrow className="mb-3">Nový check-in</Eyebrow>

        <Field label="Sken měření" hint="Foto nebo PDF z InBody, kaliperu nebo chytré váhy — AI se pokusí hodnoty přečíst a předvyplnit">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted hover:border-accent/60">
            <ScanLine className="h-4 w-4" />
            {ocrLoading ? 'Čtu hodnoty…' : photo ? photo.name : 'Vybrat foto nebo PDF'}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={ocrLoading}
              onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>

        <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Váha (kg)" hint={fieldHint('weight_kg')}>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.weightKg}
                onChange={(e) => update('weightKg', e.target.value)}
              />
            </Field>
            <Field label="Tělesný tuk (%)" hint={fieldHint('body_fat_pct')}>
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
            <Field label="Svalová hmota (kg)" hint={fieldHint('muscle_mass_kg')}>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.muscleMassKg}
                onChange={(e) => update('muscleMassKg', e.target.value)}
              />
            </Field>
            <Field label="Viscerální tuk" hint={fieldHint('visceral_fat')}>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.visceralFat}
                onChange={(e) => update('visceralFat', e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Pas (cm)" hint={fieldHint('waist_cm')}>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.waistCm}
                onChange={(e) => update('waistCm', e.target.value)}
              />
            </Field>
            <Field label="Boky (cm)" hint={fieldHint('hip_cm')}>
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
            <Field label="Hrudník (cm)" hint={fieldHint('chest_cm')}>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.chestCm}
                onChange={(e) => update('chestCm', e.target.value)}
              />
            </Field>
            <Field label="Paže (cm)" hint={fieldHint('arm_cm')}>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.armCm}
                onChange={(e) => update('armCm', e.target.value)}
              />
            </Field>
            <Field label="Stehno (cm)" hint={fieldHint('thigh_cm')}>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.thighCm}
                onChange={(e) => update('thighCm', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Zdroj měření">
            <select
              className={inputCls}
              value={form.measurementSource}
              onChange={(e) => update('measurementSource', e.target.value)}
            >
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Poznámka">
            <textarea
              rows={2}
              className={inputCls}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
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
