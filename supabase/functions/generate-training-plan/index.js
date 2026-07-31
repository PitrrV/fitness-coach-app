import { corsHeaders } from '../_shared/cors.js'
import { buildBodyCompositionPrompt, callAI, checkRateLimit, jsonResponse, parseAIJson, verifyAuth } from '../_shared/shared.js'

const TRAINING_PLAN_SCHEMA = `{
  "days": [
    {
      "day": 1,
      "focus": "Horní tělo",
      "exercises": [{ "name": "Bench press", "sets": 4, "reps": "8-10" }]
    }
  ]
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

    const { data: checkIns } = await supabase
      .from('check_ins')
      .select('date, body_fat_pct, muscle_mass_kg, visceral_fat')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(3)

    const prompt = `Sestav tréninkový plán na 4 tréninkové dny v týdnu pro uživatele s cílem
"${profile.goal}", úrovní aktivity "${profile.activity_level}", věkem ${profile.age} let.
${buildBodyCompositionPrompt(checkIns ?? [])}
U každého cviku uveď počet sérií a rozsah opakování. Odpověz VÝHRADNĚ platným JSON přesně
v této struktuře, bez dalšího textu:
${TRAINING_PLAN_SCHEMA}`

    const text = await callAI({
      system: 'Jsi trenér silového tréninku. Odpovídáš vždy pouze validním JSON bez dalšího komentáře.',
      prompt,
    })
    const planJson = parseAIJson(text)

    const { data: saved, error: saveError } = await supabase
      .from('training_plans')
      .insert({ user_id: user.id, plan_json: planJson })
      .select()
      .single()
    if (saveError) throw saveError

    return jsonResponse(200, { plan: saved }, corsHeaders)
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message || 'Neočekávaná chyba.' }, corsHeaders)
  }
})
