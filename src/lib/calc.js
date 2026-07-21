// Výpočty BMR/TDEE/maker podle Mifflin–St Jeor.

export const ACTIVITY_LEVELS = {
  sedentary: { label: 'Sedavý (málo/žádný pohyb)', multiplier: 1.2 },
  light: { label: 'Lehce aktivní (1–3× týdně)', multiplier: 1.375 },
  moderate: { label: 'Středně aktivní (3–5× týdně)', multiplier: 1.55 },
  active: { label: 'Velmi aktivní (6–7× týdně)', multiplier: 1.725 },
  very_active: { label: 'Extrémně aktivní (fyzická práce + trénink)', multiplier: 1.9 },
}

export const GOALS = {
  cut: { label: 'Hubnutí (cut)', calorieAdjust: -500, proteinPerKg: 2.2 },
  maintain: { label: 'Udržení váhy', calorieAdjust: 0, proteinPerKg: 2.0 },
  bulk: { label: 'Nabírání (bulk)', calorieAdjust: 300, proteinPerKg: 1.8 },
}

/** BMR podle Mifflin–St Jeor. sex: 'male' | 'female' */
export function calcBMR({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'female' ? base - 161 : base + 5)
}

/** TDEE = BMR × koeficient aktivity. */
export function calcTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_LEVELS[activityLevel]?.multiplier ?? ACTIVITY_LEVELS.sedentary.multiplier
  return Math.round(bmr * multiplier)
}

/** Cílové kalorie podle TDEE a cíle (cut/maintain/bulk). */
export function calcGoalCalories(tdee, goal) {
  const adjust = GOALS[goal]?.calorieAdjust ?? 0
  return Math.max(1200, Math.round(tdee + adjust))
}

/**
 * Rozpočet makroživin.
 * Bílkoviny: g/kg podle cíle. Tuky: 25 % kalorií. Sacharidy: zbytek.
 */
export function calcMacros({ weightKg, goal, calories }) {
  const proteinPerKg = GOALS[goal]?.proteinPerKg ?? GOALS.maintain.proteinPerKg
  const proteinG = Math.round(weightKg * proteinPerKg)
  const proteinKcal = proteinG * 4

  const fatKcal = Math.round(calories * 0.25)
  const fatG = Math.round(fatKcal / 9)

  const carbsKcal = Math.max(0, calories - proteinKcal - fatKcal)
  const carbsG = Math.round(carbsKcal / 4)

  return {
    calories,
    protein: { g: proteinG, kcal: proteinKcal },
    fat: { g: fatG, kcal: fatKcal },
    carbs: { g: carbsG, kcal: carbsKcal },
  }
}

/** Kompletní výpočet z profilu uživatele. */
export function calcProfileTargets(profile) {
  const bmr = calcBMR(profile)
  const tdee = calcTDEE(bmr, profile.activityLevel)
  const calories = calcGoalCalories(tdee, profile.goal)
  const macros = calcMacros({ weightKg: profile.weightKg, goal: profile.goal, calories })
  return { bmr, tdee, ...macros }
}

function round1(n) {
  return Math.round(n * 10) / 10
}

/**
 * Změna váhy mezi nejstarším check-inem v posledních `days` dnech a
 * nejnovějším check-inem. checkIns musí být seřazené vzestupně podle data
 * a obsahovat pole `date` a `weight_kg`. Vrací null, pokud nejsou aspoň 2 záznamy.
 */
export function calcWeightChange(checkIns, days = 30) {
  const withWeight = checkIns.filter((c) => c.weight_kg != null)
  if (withWeight.length < 2) return null

  const latest = withWeight[withWeight.length - 1]
  const cutoff = new Date(latest.date)
  cutoff.setDate(cutoff.getDate() - days)
  const base = withWeight.find((c) => new Date(c.date) >= cutoff) ?? withWeight[0]

  if (base === latest) return null

  return {
    changeKg: round1(latest.weight_kg - base.weight_kg),
    fromDate: base.date,
    toDate: latest.date,
  }
}

/**
 * Trend tělesného tuku (%) mezi nejstarším a nejnovějším záznamem v posledních
 * `days` dnech. Stejná logika jako calcWeightChange, jen pro body_fat_pct.
 */
export function calcBodyFatTrend(checkIns, days = 30) {
  const withBodyFat = checkIns.filter((c) => c.body_fat_pct != null)
  if (withBodyFat.length < 2) return null

  const latest = withBodyFat[withBodyFat.length - 1]
  const cutoff = new Date(latest.date)
  cutoff.setDate(cutoff.getDate() - days)
  const base = withBodyFat.find((c) => new Date(c.date) >= cutoff) ?? withBodyFat[0]

  if (base === latest) return null

  return {
    changePct: round1(latest.body_fat_pct - base.body_fat_pct),
    fromDate: base.date,
    toDate: latest.date,
  }
}

/**
 * Počet po sobě jdoucích check-inů (od nejnovějšího) s mezerou nejvýš
 * `maxGapDays` dnů mezi sousedními záznamy — přibližuje pravidelnost trackingu.
 */
export function calcCheckInStreak(checkIns, maxGapDays = 8) {
  const dates = [...new Set(checkIns.map((c) => c.date))].sort((a, b) => new Date(b) - new Date(a))
  if (dates.length === 0) return 0

  let streak = 1
  for (let i = 0; i < dates.length - 1; i++) {
    const gapDays = (new Date(dates[i]) - new Date(dates[i + 1])) / 86400000
    if (gapDays > maxGapDays) break
    streak++
  }
  return streak
}

const STAGNATION_THRESHOLD_KG_PER_WEEK = 0.15
const RECOMMENDED_CALORIE_ADJUST = 175

/**
 * Doporučení k úpravě kalorií na základě trendu z posledních 2–3 check-inů.
 * Nikdy nic sám nemění — jen vrací doporučení k zobrazení uživateli.
 * Vrací null, pokud není co doporučit (cíl "maintain", málo dat, nebo je trend v pořádku).
 */
export function calcAdaptiveRecommendation({ checkIns, goal }) {
  if (goal !== 'cut' && goal !== 'bulk') return null

  const withWeight = [...checkIns]
    .filter((c) => c.weight_kg != null)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-3)

  if (withWeight.length < 2) return null

  const first = withWeight[0]
  const last = withWeight[withWeight.length - 1]
  const daysSpan = (new Date(last.date) - new Date(first.date)) / 86400000
  if (daysSpan < 3) return null

  const weeklyChangeKg = ((last.weight_kg - first.weight_kg) / daysSpan) * 7

  if (goal === 'cut' && weeklyChangeKg > -STAGNATION_THRESHOLD_KG_PER_WEEK) {
    return {
      direction: 'decrease',
      amountKcal: RECOMMENDED_CALORIE_ADJUST,
      weeklyChangeKg: round1(weeklyChangeKg),
      message: `Za posledních ${withWeight.length} check-inů váha spíš stagnuje (${round1(
        weeklyChangeKg
      )} kg/týden). Zvaž snížení denního příjmu o ~${RECOMMENDED_CALORIE_ADJUST} kcal.`,
    }
  }

  if (goal === 'bulk' && weeklyChangeKg < STAGNATION_THRESHOLD_KG_PER_WEEK) {
    return {
      direction: 'increase',
      amountKcal: RECOMMENDED_CALORIE_ADJUST,
      weeklyChangeKg: round1(weeklyChangeKg),
      message: `Za posledních ${withWeight.length} check-inů váha téměř neroste (${round1(
        weeklyChangeKg
      )} kg/týden). Zvaž navýšení denního příjmu o ~${RECOMMENDED_CALORIE_ADJUST} kcal.`,
    }
  }

  return null
}
