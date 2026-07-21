// Zrcadlí src/lib/calc.js (BMR/TDEE/makra) — duplikováno místo cross-package
// importu, protože Supabase CLI bundluje každou Edge Function samostatně ze
// supabase/functions/. Při změně vzorců uprav na obou místech.

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

export const GOAL_SETTINGS = {
  cut: { calorieAdjust: -500, proteinPerKg: 2.2 },
  maintain: { calorieAdjust: 0, proteinPerKg: 2.0 },
  bulk: { calorieAdjust: 300, proteinPerKg: 1.8 },
}

export function calcProfileTargets({ sex, age, heightCm, weightKg, activityLevel, goal }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  const bmr = Math.round(sex === 'female' ? base - 161 : base + 5)

  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? ACTIVITY_MULTIPLIERS.sedentary
  const tdee = Math.round(bmr * multiplier)

  const goalSettings = GOAL_SETTINGS[goal] ?? GOAL_SETTINGS.maintain
  const calories = Math.max(1200, Math.round(tdee + goalSettings.calorieAdjust))

  const proteinG = Math.round(weightKg * goalSettings.proteinPerKg)
  const proteinKcal = proteinG * 4
  const fatKcal = Math.round(calories * 0.25)
  const fatG = Math.round(fatKcal / 9)
  const carbsKcal = Math.max(0, calories - proteinKcal - fatKcal)
  const carbsG = Math.round(carbsKcal / 4)

  return {
    bmr,
    tdee,
    calories,
    protein: { g: proteinG, kcal: proteinKcal },
    fat: { g: fatG, kcal: fatKcal },
    carbs: { g: carbsG, kcal: carbsKcal },
  }
}
