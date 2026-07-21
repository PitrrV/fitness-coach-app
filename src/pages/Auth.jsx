import { useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, Field, inputCls } from '../components/ui'
import { useToast } from '../components/Toast'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success('Účet vytvořen. Zkontroluj e-mail pro potvrzení, pokud je vyžadováno.')
      }
    } catch (err) {
      toast.error(err.message || 'Přihlášení se nezdařilo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Dumbbell className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-text">Fitness AI Coach</h1>
          <p className="mt-1 text-sm text-muted">
            {mode === 'login' ? 'Přihlas se ke svému účtu' : 'Vytvoř si nový účet'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Field label="E-mail">
            <input
              type="email"
              required
              autoComplete="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Heslo">
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Button type="submit" className="w-full" loading={loading}>
            {mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-4 w-full text-center text-sm text-muted hover:text-text"
        >
          {mode === 'login' ? 'Nemáš účet? Zaregistruj se' : 'Už máš účet? Přihlas se'}
        </button>
      </Card>
    </div>
  )
}
