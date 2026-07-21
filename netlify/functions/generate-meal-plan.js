import { callAnthropic, checkRateLimit, jsonResponse, parseAIJson, verifyAuth } from './utils/shared.js'
import { calcProfileTargets } from '../../src/lib/calc.js'

const MEAL_PLAN_SCHEMA = `{
  "days": [
    {
      "day": 1,
      "meals": [
        {
          "name": "Snídaně",
          "items": [{ "food": "název potraviny", "grams": 100 }],
          "totals": { "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }
        }
      ],
      "totals": { "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 }
    }
  ],
  "shoppingList": ["položka 1", "položka 2"]
}`

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Metoda není povolena.' })
  }

  try {
    const { user, supabase } = await verifyAuth(event)
    await checkRateLimit(supabase, user.id)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile) {
      return jsonResponse(400, { error: 'Nejdřív vyplň svůj profil.' })
    }

    const days = Math.min(7, Math.max(1, Number(JSON.parse(event.body || '{}').days) || 1))
    const targets = calcProfileTargets({
      sex: profile.sex,
      age: profile.age,
      heightCm: profile.height_cm,
      weightKg: profile.weight_kg,
      activityLevel: profile.activity_level,
      goal: profile.goal,
    })

    const prompt = `Sestav jídelníček na ${days} ${days === 1 ? 'den' : days < 5 ? 'dny' : 'dní'} pro uživatele:
- cíl: ${profile.goal}
- denní kalorie: ${targets.calories} kcal
- makra: bílkoviny ${targets.protein.g} g, tuky ${targets.fat.g} g, sacharidy ${targets.carbs.g} g

Používej běžně dostupné potraviny v ČR. Rozděl každý den na 3–4 jídla, u každé položky uveď
gramáž. Přidej souhrnný nákupní seznam za všechny dny (bez duplicit). Odpověz VÝHRADNĚ platným
JSON přesně v této struktuře, bez dalšího textu:
${MEAL_PLAN_SCHEMA}`

    const text = await callAnthropic({
      system: 'Jsi výživový poradce. Odpovídáš vždy pouze validním JSON bez dalšího komentáře.',
      prompt,
    })
    const planJson = parseAIJson(text)

    const { data: saved, error: saveError } = await supabase
      .from('meal_plans')
      .insert({ user_id: user.id, days, plan_json: planJson })
      .select()
      .single()
    if (saveError) throw saveError

    return jsonResponse(200, { plan: saved })
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message || 'Neočekávaná chyba.' })
  }
}
