import { useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { calcProfileTargets } from '../lib/calc'
import { Card, EmptyState, Eyebrow, MacroSplitBar, Metric, MiniMacro } from '../components/ui'
import { useToast } from '../components/Toast'
import { DashboardSkeleton } from '../components/Skeleton'

export default function Dashboard({ user }) {
  const [profile, setProfile] = useState(null)
  const [checkIns, setCheckIns] = useState([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    let active = true
    async function load() {
      const [profileRes, checkInsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('check_ins')
          .select('date, weight_kg')
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

  const chartData = checkIns
    .filter((c) => c.weight_kg != null)
    .map((c) => ({ date: c.date.slice(5), weight: c.weight_kg }))

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

      <Card>
        <Eyebrow className="mb-3">Vývoj váhy</Eyebrow>
        {chartData.length < 2 ? (
          <EmptyState
            icon={LineChartIcon}
            title="Zatím málo dat"
            description="Přidej alespoň dva check-iny s váhou pro zobrazení grafu."
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
                />
                <Line type="monotone" dataKey="weight" stroke="#C9824A" strokeWidth={2} dot={false} />
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
