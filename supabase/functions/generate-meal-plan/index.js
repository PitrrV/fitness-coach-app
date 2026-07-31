import { corsHeaders } from '../_shared/cors.js'
import { calcProfileTargets } from '../_shared/calc.js'
import { buildPreferencesPrompt, callAI, checkRateLimit, jsonResponse, parseAIJson, verifyAuth } from '../_shared/shared.js'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Metoda není povolena.' }, corsHeaders)
  }

  try {
    const { user, supabase } = await verifyAuth(req)
    await checkRateLimit(supabase, user.id)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile) {
      return jsonResponse(400, { error: 'Nejdřív vyplň svůj profil.' }, corsHeaders)
    }

    const body = await req.json().catch(() => ({}))
    const days = Math.min(7, Math.max(1, Number(body.days) || 1))
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
${buildPreferencesPrompt(profile)}
Používej běžně dostupné potraviny v ČR. Rozděl každý den na 3–4 jídla, u každé položky uveď
gramáž. Přidej souhrnný nákupní seznam za všechny dny (bez duplicit). Odpověz VÝHRADNĚ platným
JSON přesně v této struktuře, bez dalšího textu:
${MEAL_PLAN_SCHEMA}`

    const text = await callAI({
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

    return jsonResponse(200, { plan: saved }, corsHeaders)
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message || 'Neočekávaná chyba.' }, corsHeaders)
  }
})
