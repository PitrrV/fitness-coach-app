import { useEffect, useState } from 'react'
import { CalendarCheck, ChefHat, Dumbbell, LayoutDashboard, LogOut, User } from 'lucide-react'
import { supabase } from './lib/supabase'
import { useToast } from './components/Toast'
import { Skeleton } from './components/Skeleton'
import Auth from './pages/Auth'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import MealPlan from './pages/MealPlan'
import TrainingPlan from './pages/TrainingPlan'
import CheckIn from './pages/CheckIn'

const TABS = [
  { id: 'dashboard', label: 'Přehled', icon: LayoutDashboard, Page: Dashboard },
  { id: 'mealplan', label: 'Jídelníček', icon: ChefHat, Page: MealPlan },
  { id: 'trainingplan', label: 'Trénink', icon: Dumbbell, Page: TrainingPlan },
  { id: 'checkin', label: 'Check-in', icon: CalendarCheck, Page: CheckIn },
  { id: 'profile', label: 'Profil', icon: User, Page: Profile },
]

function AppSkeleton() {
  return (
    <div className="min-h-screen bg-ink">
      <div className="border-b border-border px-4 py-3.5">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-8 rounded-xl" />
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = zjišťuje se, null = odhlášen
  const [tab, setTab] = useState('dashboard')
  const [recovery, setRecovery] = useState(false)
  const toast = useToast()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) toast.error('Odhlášení se nezdařilo.')
  }

  if (session === undefined) return <AppSkeleton />
  if (recovery) return <ResetPassword onDone={() => setRecovery(false)} />
  if (!session) return <Auth />

  const active = TABS.find((t) => t.id === tab) ?? TABS[0]
  const ActivePage = active.Page

  return (
    <div className="min-h-screen bg-ink pb-20 sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Dumbbell className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-text">Fitness AI Coach</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-text"
            aria-label="Odhlásit se"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Odhlásit</span>
          </button>
        </div>

        <nav className="mx-auto hidden max-w-2xl gap-1 px-4 pb-3 sm:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                t.id === active.id ? 'bg-accent/15 text-accent' : 'text-muted hover:text-text'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        <ActivePage user={session.user} onSaved={() => setTab('dashboard')} />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 backdrop-blur sm:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
              t.id === active.id ? 'text-accent' : 'text-muted'
            }`}
          >
            <t.icon className="h-5 w-5" />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
