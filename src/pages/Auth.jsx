import { useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, Field, inputCls } from '../components/ui'
import { useToast } from '../components/Toast'

const TITLES = {
  login: 'Přihlas se ke svému účtu',
  register: 'Vytvoř si nový účet',
  forgot: 'Obnov zapomenuté heslo',
}

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [healthConsent, setHealthConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const toast = useToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'register') {
        if (!healthConsent) {
          toast.error('Pro registraci je potřeba souhlasit se zpracováním zdravotních údajů.')
          return
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { health_data_consent: true, health_data_consent_at: new Date().toISOString() },
          },
        })
        if (error) throw error
        toast.success('Účet vytvořen. Zkontroluj e-mail pro potvrzení, pokud je vyžadováno.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setSent(true)
        toast.success('Poslali jsme ti e-mail s odkazem pro obnovení hesla.')
      }
    } catch (err) {
      toast.error(err.message || 'Něco se nezdařilo.')
    } finally {
      setLoading(false)
    }
  }

  function switchMode(next) {
    setMode(next)
    setSent(false)
    setPassword('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Dumbbell className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-text">Fitness AI Coach</h1>
          <p className="mt-1 text-sm text-muted">{TITLES[mode]}</p>
        </div>

        {mode === 'forgot' && sent ? (
          <p className="text-center text-sm text-muted">
            Zkontroluj svou e-mailovou schránku a klikni na odkaz pro nastavení nového hesla.
          </p>
        ) : (
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

            {mode !== 'forgot' && (
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
            )}

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="block text-sm text-muted hover:text-text"
              >
                Zapomenuté heslo?
              </button>
            )}

            {mode === 'register' && (
              <label className="flex items-start gap-2.5 text-sm text-muted">
                <input
                  type="checkbox"
                  required
                  checked={healthConsent}
                  onChange={(e) => setHealthConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-ink text-accent accent-accent"
                />
                <span>
                  Souhlasím se zpracováním svých zdravotních a tělesných údajů (váha, tělesný tuk, míry,
                  fotky z check-inů) za účelem poskytování služby.
                </span>
              </label>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              {mode === 'login' ? 'Přihlásit se' : mode === 'register' ? 'Vytvořit účet' : 'Poslat odkaz pro obnovení'}
            </Button>
          </form>
        )}

        {mode === 'register' && (
          <p className="mt-4 text-center text-xs text-muted">
            Fitness AI Coach neslouží jako náhrada lékařské péče. Před výraznější změnou stravy nebo tréninku
            se poraď s lékařem.
          </p>
        )}

        {mode === 'forgot' ? (
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="mt-4 w-full text-center text-sm text-muted hover:text-text"
          >
            Zpět na přihlášení
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="mt-4 w-full text-center text-sm text-muted hover:text-text"
          >
            {mode === 'login' ? 'Nemáš účet? Zaregistruj se' : 'Už máš účet? Přihlas se'}
          </button>
        )}
      </Card>
    </div>
  )
}
