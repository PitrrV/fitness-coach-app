import { corsHeaders } from '../_shared/cors.js'
import { calcProfileTargets } from '../_shared/calc.js'
import {
  buildBodyCompositionPrompt,
  buildPreferencesPrompt,
  callAI,
  checkRateLimit,
  jsonResponse,
  parseAIJson,
  verifyAuth,
} from '../_shared/shared.js'

const WEEKDAYS = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle']
const DAYS = WEEKDAYS.length

const MEAL_PLAN_SCHEMA = `{
  "days": [
    {
      "day": 1,
      "weekday": "pondělí",
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

const CALORIE_TOLERANCE = 0.08 // ±8 % od cílových kalorií za den
const MACRO_TOLERANCE = 0.15 // ±15 % od cílových gramů makra za den

/** Zkontroluje, jestli jsou kalorie I VŠECHNA TŘI makra KAŽDÉHO dne v toleranci od cíle. */
function isWithinTolerance(planJson, targets) {
  const days = planJson?.days
  if (!Array.isArray(days) || days.length === 0) return false
  return days.every((d) => {
    const t = d?.totals
    if (!t) return false
    const within = (value, target, tolerance) =>
      typeof value === 'number' && Math.abs(value - target) / target <= tolerance
    return (
      within(t.kcal, targets.calories, CALORIE_TOLERANCE) &&
      within(t.protein, targets.protein.g, MACRO_TOLERANCE) &&
      within(t.fat, targets.fat.g, MACRO_TOLERANCE) &&
      within(t.carbs, targets.carbs.g, MACRO_TOLERANCE)
    )
  })
}

function buildPrompt({ profile, targets, preferences, bodyComposition, mealsPerDay, correction }) {
  const calMin = Math.round(targets.calories * (1 - CALORIE_TOLERANCE))
  const calMax = Math.round(targets.calories * (1 + CALORIE_TOLERANCE))
  const proteinMin = Math.round(targets.protein.g * (1 - MACRO_TOLERANCE))
  const proteinMax = Math.round(targets.protein.g * (1 + MACRO_TOLERANCE))
  const fatMin = Math.round(targets.fat.g * (1 - MACRO_TOLERANCE))
  const fatMax = Math.round(targets.fat.g * (1 + MACRO_TOLERANCE))
  const carbsMin = Math.round(targets.carbs.g * (1 - MACRO_TOLERANCE))
  const carbsMax = Math.round(targets.carbs.g * (1 + MACRO_TOLERANCE))

  return `Sestav jídelníček na celý týden — přesně ${DAYS} dní, den 1 = pondělí až den 7 = neděle
(pole "weekday" u každého dne vyplň názvem dne v týdnu) — pro uživatele:
- cíl: ${profile.goal}
- denní kalorie: ${targets.calories} kcal
- makra: bílkoviny ${targets.protein.g} g, tuky ${targets.fat.g} g, sacharidy ${targets.carbs.g} g
${preferences}${bodyComposition}
DŮLEŽITÉ: Za KAŽDÝ jednotlivý den musí SOUČASNĚ platit:
- kalorie (totals.kcal) v rozmezí ${calMin}–${calMax} kcal
- bílkoviny (totals.protein) v rozmezí ${proteinMin}–${proteinMax} g
- tuky (totals.fat) v rozmezí ${fatMin}–${fatMax} g
- sacharidy (totals.carbs) v rozmezí ${carbsMin}–${carbsMax} g
Než odpovíš, u každého dne sečti kalorie i makra všech jídel a uprav gramáže a skladbu potravin
(víc/míň bílkovinných, tučných či sacharidových položek) tak, aby VŠECHNY čtyři hodnoty do
rozmezí skutečně spadaly — teprve pak je napiš do "totals" daného dne.

Používej běžně dostupné potraviny v ČR, přes týden střídej jídla (ať se nedokola neopakuje totéž).
Každý den rozděl na PŘESNĚ ${mealsPerDay} jídel (ne víc, ne míň). U každé položky uveď gramáž.
Přidej souhrnný nákupní seznam za všechny dny dohromady (bez duplicit). Odpověz VÝHRADNĚ platným
JSON přesně v této struktuře, bez dalšího textu:
${MEAL_PLAN_SCHEMA}${
    correction
      ? `\n\nPředchozí pokus měl u některých dnů kalorie nebo některé z maker (bílkoviny/tuky/
sacharidy) mimo požadovaná rozmezí. Uprav gramáže a poměr potravin a přepočítej totals znovu,
tentokrát přesně pro kalorie i všechna tři makra současně.`
      : ''
  }`
}

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

    const { data: checkIns } = await supabase
      .from('check_ins')
      .select('date, body_fat_pct, muscle_mass_kg, visceral_fat')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(3)

    const targets = calcProfileTargets({
      sex: profile.sex,
      age: profile.age,
      heightCm: profile.height_cm,
      weightKg: profile.weight_kg,
      activityLevel: profile.activity_level,
      goal: profile.goal,
    })

    const body = await req.json().catch(() => ({}))
    const mealsPerDay = [3, 4, 5].includes(Number(body.mealsPerDay)) ? Number(body.mealsPerDay) : 4

    const preferences = buildPreferencesPrompt(profile)
    const bodyComposition = buildBodyCompositionPrompt(checkIns ?? [])
    const system = 'Jsi výživový poradce. Odpovídáš vždy pouze validním JSON bez dalšího komentáře.'

    let planJson = parseAIJson(
      await callAI({
        system,
        prompt: buildPrompt({ profile, targets, preferences, bodyComposition, mealsPerDay }),
      })
    )

    if (!isWithinTolerance(planJson, targets)) {
      planJson = parseAIJson(
        await callAI({
          system,
          prompt: buildPrompt({ profile, targets, preferences, bodyComposition, mealsPerDay, correction: true }),
        })
      )
    }

    const { data: saved, error: saveError } = await supabase
      .from('meal_plans')
      .insert({ user_id: user.id, days: DAYS, plan_json: planJson })
      .select()
      .single()
    if (saveError) throw saveError

    return jsonResponse(200, { plan: saved }, corsHeaders)
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message || 'Neočekávaná chyba.' }, corsHeaders)
  }
})
