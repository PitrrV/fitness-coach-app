import { useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Lightbulb, LineChart as LineChartIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  calcAdaptiveRecommendation,
  calcBodyFatTrend,
  calcCheckInStreak,
  calcMuscleMassTrend,
  calcProfileTargets,
  calcVisceralFatTrend,
  calcWeightChange,
} from '../lib/calc'
import { Card, EmptyState, Eyebrow, MacroSplitBar, Metric, MiniMacro } from '../components/ui'
import { useToast } from '../components/Toast'
import { DashboardSkeleton } from '../components/Skeleton'

const CHART_METRICS = {
  weight: { label: 'Váha', field: 'weight_kg', unit: 'kg', color: '#C9824A' },
  bodyFat: { label: 'Tělesný tuk', field: 'body_fat_pct', unit: '%', color: '#4FA398' },
  muscleMass: { label: 'Svalová hmota', field: 'muscle_mass_kg', unit: 'kg', color: '#8B93A7' },
  visceralFat: { label: 'Viscerální tuk', field: 'visceral_fat', unit: '', color: '#C0524A' },
}

export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null)
  const [checkIns, setCheckIns] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartMetric, setChartMetric] = useState('weight')
  const toast = useToast()

  useEffect(() => {
    let active = true
    async function load() {
      const [profileRes, checkInsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('check_ins')
          .select('date, weight_kg, body_fat_pct, muscle_mass_kg, visceral_fat')
          .eq('user_id', user.id)
          .order('date', { ascending: true })
          .limit(60),
      ])
      if (!active) return
      if (profileRes.error || checkInsRes.error) {
        toast.error('Nepodařilo se načíst data přehledu.')
      } else {
        setProfile(profileRes.data)
        setCheckIns(checkInsRes.data ?? [])
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [user.id])

  if (loading) return <DashboardSkeleton />

  if (!profile) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="Nejdřív vyplň profil"
        description="Přehled se zobrazí, jakmile nastavíš svůj profil v záložce Profil."
      />
    )
  }

  const targets = calcProfileTargets({
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.height_cm,
    weightKg: profile.weight_kg,
    activityLevel: profile.activity_level,
    goal: profile.goal,
  })

  const weightChange = calcWeightChange(checkIns)
  const bodyFatTrend = calcBodyFatTrend(checkIns)
  const muscleMassTrend = calcMuscleMassTrend(checkIns)
  const visceralFatTrend = calcVisceralFatTrend(checkIns)
  const streak = calcCheckInStreak(checkIns)
  const recommendation = calcAdaptiveRecommendation({ checkIns, goal: profile.goal })

  const metric = CHART_METRICS[chartMetric]
  const chartData = checkIns
    .filter((c) => c[metric.field] != null)
    .map((c) => ({ date: c.date.slice(5), value: c[metric.field] }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <Metric label="BMR" value={targets.bmr} unit="kcal" />
        </Card>
        <Card>
          <Metric label="TDEE" value={targets.tdee} unit="kcal" />
        </Card>
        <Card>
          <Metric label="Denní cíl" value={targets.calories} unit="kcal" tone="accent" />
        </Card>
        <Card>
          <Metric label="Check-inů" value={checkIns.length} tone="teal" />
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <Metric
            label="Váha (30 dní)"
            value={weightChange ? `${weightChange.changeKg > 0 ? '+' : ''}${weightChange.changeKg}` : '—'}
            unit={weightChange ? 'kg' : ''}
          />
        </Card>
        <Card>
          <Metric
            label="Tuk (30 dní)"
            value={bodyFatTrend ? `${bodyFatTrend.changePct > 0 ? '+' : ''}${bodyFatTrend.changePct}` : '—'}
            unit={bodyFatTrend ? '%' : ''}
          />
        </Card>
        <Card>
          <Metric label="Streak" value={streak} unit="v řadě" tone="teal" />
        </Card>
      </div>

      {(muscleMassTrend || visceralFatTrend) && (
        <div className="grid grid-cols-2 gap-3">
          {muscleMassTrend && (
            <Card>
              <Metric
                label="Svaly (30 dní)"
                value={`${muscleMassTrend.change > 0 ? '+' : ''}${muscleMassTrend.change}`}
                unit="kg"
              />
            </Card>
          )}
          {visceralFatTrend && (
            <Card>
              <Metric
                label="Viscerální tuk (30 dní)"
                value={`${visceralFatTrend.change > 0 ? '+' : ''}${visceralFatTrend.change}`}
              />
            </Card>
          )}
        </div>
      )}

      {recommendation && (
        <Card className="border-accent/40">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <Eyebrow>Doporučení</Eyebrow>
              <p className="mt-1 text-sm text-text">{recommendation.message}</p>
              <p className="mt-1 text-xs text-muted">
                Jde jen o doporučení — cíl a kalorie si uprav ručně v Profilu, pokud s ním souhlasíš.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow>Vývoj</Eyebrow>
          <div className="flex rounded-xl border border-border p-0.5">
            {Object.entries(CHART_METRICS).map(([key, m]) => (
              <button
                key={key}
                onClick={() => setChartMetric(key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  chartMetric === key ? 'bg-accent/15 text-accent' : 'text-muted hover:text-text'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {chartData.length < 2 ? (
          <EmptyState
            icon={LineChartIcon}
            title="Zatím málo dat"
            description="Přidej alespoň dva check-iny s touto hodnotou pro zobrazení grafu."
          />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#8B93A7" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#8B93A7"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={['dataMin - 1', 'dataMax + 1']}
                />
                <Tooltip
                  contentStyle={{ background: '#141826', border: '1px solid #242B3D', borderRadius: 12 }}
                  labelStyle={{ color: '#8B93A7' }}
                  formatter={(value) => [`${value} ${metric.unit}`, metric.label]}
                />
                <Line type="monotone" dataKey="value" stroke={metric.color} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow className="mb-3">Makra dne</Eyebrow>
        <MacroSplitBar protein={targets.protein} fat={targets.fat} carbs={targets.carbs} />
        <div className="mt-3 space-y-1.5">
          <MiniMacro label="Bílkoviny" grams={targets.protein.g} kcal={targets.protein.kcal} colorClass="bg-accent" />
          <MiniMacro label="Tuky" grams={targets.fat.g} kcal={targets.fat.kcal} colorClass="bg-teal" />
          <MiniMacro label="Sacharidy" grams={targets.carbs.g} kcal={targets.carbs.kcal} colorClass="bg-muted" />
        </div>
      </Card>
    </div>
  )
}
