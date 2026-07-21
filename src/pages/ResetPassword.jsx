import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, Field, inputCls } from '../components/ui'
import { useToast } from '../components/Toast'

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Hesla se neshodují.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success('Heslo bylo změněno.')
      onDone?.()
    } catch (err) {
      toast.error(err.message || 'Změna hesla se nezdařila.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-text">Nastav nové heslo</h1>
          <p className="mt-1 text-sm text-muted">Zadej nové heslo ke svému účtu.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Field label="Nové heslo">
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Potvrzení hesla">
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className={inputCls}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>

          <Button type="submit" className="w-full" loading={loading}>
            Uložit nové heslo
          </Button>
        </form>
      </Card>
    </div>
  )
}
