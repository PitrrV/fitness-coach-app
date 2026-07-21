import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Card } from './ui'

const FIELDS = [
  ['weight_kg', 'Váha', 'kg'],
  ['body_fat_pct', 'Tělesný tuk', '%'],
  ['waist_cm', 'Pas', 'cm'],
  ['hip_cm', 'Boky', 'cm'],
  ['chest_cm', 'Hrudník', 'cm'],
  ['arm_cm', 'Paže', 'cm'],
  ['thigh_cm', 'Stehno', 'cm'],
]

export default function CheckInDetailModal({ checkIn, onClose }) {
  const [photoUrl, setPhotoUrl] = useState(null)

  useEffect(() => {
    let active = true
    if (!checkIn.photo_path) {
      setPhotoUrl(null)
      return
    }
    supabase.storage
      .from('measurement-photos')
      .createSignedUrl(checkIn.photo_path, 60)
      .then(({ data }) => {
        if (active) setPhotoUrl(data?.signedUrl ?? null)
      })
    return () => {
      active = false
    }
  }, [checkIn.photo_path])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-0 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <Card
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-b-none sm:rounded-b-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-text">{checkIn.date}</div>
          <button onClick={onClose} className="text-muted hover:text-text" aria-label="Zavřít">
            <X className="h-4 w-4" />
          </button>
        </div>

        {photoUrl && (
          <img src={photoUrl} alt="Fotka z check-inu" className="mb-4 w-full rounded-xl object-cover" />
        )}

        <div className="space-y-2">
          {FIELDS.map(([key, label, unit]) =>
            checkIn[key] != null ? (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span className="text-text">
                  {checkIn[key]} {unit}
                </span>
              </div>
            ) : null
          )}
        </div>

        {checkIn.notes && (
          <div className="mt-4 rounded-xl border border-border p-3 text-sm text-muted">{checkIn.notes}</div>
        )}
      </Card>
    </div>
  )
}
