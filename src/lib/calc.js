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
