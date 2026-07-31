import { corsHeaders } from '../_shared/cors.js'
import { calcProfileTargets } from '../_shared/calc.js'
import {
  buildPreferencesPrompt,
  callAIRaw,
  checkRateLimit,
  jsonResponse,
  verifyAuth,
} from '../_shared/shared.js'

const MAX_MESSAGE_LENGTH = 2000
const HISTORY_LIMIT = 20

const MEAL_PLAN_PARAMS = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'integer' },
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { food: { type: 'string' }, grams: { type: 'number' } },
                    required: ['food', 'grams'],
                  },
                },
                totals: {
                  type: 'object',
                  properties: {
                    kcal: { type: 'number' },
                    protein: { type: 'number' },
                    fat: { type: 'number' },
                    carbs: { type: 'number' },
                  },
                  required: ['kcal', 'protein', 'fat', 'carbs'],
                },
              },
              required: ['name', 'items', 'totals'],
            },
          },
          totals: {
            type: 'object',
            properties: {
              kcal: { type: 'number' },
              protein: { type: 'number' },
              fat: { type: 'number' },
              carbs: { type: 'number' },
            },
            required: ['kcal', 'protein', 'fat', 'carbs'],
          },
        },
        required: ['day', 'meals', 'totals'],
      },
    },
    shoppingList: { type: 'array', items: { type: 'string' } },
  },
  required: ['days', 'shoppingList'],
}

const TRAINING_PLAN_PARAMS = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'integer' },
          focus: { type: 'string' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                sets: { type: 'integer' },
                reps: { type: 'string' },
              },
              required: ['name', 'sets', 'reps'],
            },
          },
        },
        required: ['day', 'focus', 'exercises'],
      },
    },
  },
  required: ['days'],
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'update_meal_plan',
      description:
        'Uloží upravený jídelníček uživatele jako novou aktuální verzi. Zavolej jen když se s uživatelem shodneš na konkrétní změně (např. výměna jídla, úprava porce). Pošli VŽDY kompletní jídelníček ve stejné struktuře jako byl původní, ne jen změněnou část.',
      parameters: MEAL_PLAN_PARAMS,
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_training_plan',
      description:
        'Uloží upravený tréninkový plán uživatele jako novou aktuální verzi. Zavolej jen když se s uživatelem shodneš na konkrétní změně. Pošli VŽDY kompletní plán ve stejné struktuře jako byl původní, ne jen změněnou část.',
      parameters: TRAINING_PLAN_PARAMS,
    },
  },
]

function buildSystemPrompt({ profile, targets, mealPlan, trainingPlan }) {
  const parts = [
    'Jsi přátelský AI fitness a výživový kouč v appce Fitness AI Coach. Mluvíš česky, věcně a stručně.',
    'Odpovídáš na dotazy o jídelníčku, tréninku a progresu uživatele, vysvětluješ a radíš.',
    'Pokud se s uživatelem jasně shodnete na konkrétní změně jídelníčku nebo tréninku, ulož ji ' +
      'zavoláním nástroje update_meal_plan / update_training_plan — jinak nástroje nevolej.',
    'Nikdy si nevymýšlej hodnoty, které nemáš k dispozici. Respektuj rozpočet, preference a alergeny uživatele.',
  ]

  if (profile) {
    parts.push(
      `Profil uživatele: cíl ${profile.goal}, denní cíl ${targets.calories} kcal ` +
        `(B ${targets.protein.g} g, T ${targets.fat.g} g, S ${targets.carbs.g} g).` +
        buildPreferencesPrompt(profile)
    )
  } else {
    parts.push('Uživatel zatím nemá vyplněný profil — doporuč mu to udělat, pokud se ptá na jídelníček/trénink.')
  }

  parts.push(
    mealPlan
      ? `Aktuální jídelníček uživatele (JSON): ${JSON.stringify(mealPlan.plan_json)}`
      : 'Uživatel zatím nemá žádný vygenerovaný jídelníček.'
  )
  parts.push(
    trainingPlan
      ? `Aktuální tréninkový plán uživatele (JSON): ${JSON.stringify(trainingPlan.plan_json)}`
      : 'Uživatel zatím nemá žádný vygenerovaný tréninkový plán.'
  )

  return parts.join('\n\n')
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

    const body = await req.json().catch(() => ({}))
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return jsonResponse(400, { error: 'Zpráva nemůže být prázdná.' }, corsHeaders)
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse(400, { error: `Zpráva je příliš dlouhá (max ${MAX_MESSAGE_LENGTH} znaků).` }, corsHeaders)
    }

    const [{ data: profile }, { data: mealPlan }, { data: trainingPlan }, { data: history, error: historyError }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('meal_plans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('training_plans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('chat_messages')
          .select('role, content')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT),
      ])
    if (historyError) throw historyError

    const targets = profile
      ? calcProfileTargets({
          sex: profile.sex,
          age: profile.age,
          heightCm: profile.height_cm,
          weightKg: profile.weight_kg,
          activityLevel: profile.activity_level,
          goal: profile.goal,
        })
      : null

    const { error: insertUserMsgError } = await supabase
      .from('chat_messages')
      .insert({ user_id: user.id, role: 'user', content: message })
    if (insertUserMsgError) throw insertUserMsgError

    const systemPrompt = buildSystemPrompt({ profile, targets, mealPlan, trainingPlan })
    const messages = [
      { role: 'system', content: systemPrompt },
      ...[...(history ?? [])].reverse().map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]

    const firstMessage = await callAIRaw({ messages, tools: TOOLS, maxTokens: 4096 })

    let mealPlanUpdated = false
    let trainingPlanUpdated = false

    if (firstMessage.tool_calls?.length) {
      messages.push(firstMessage)

      for (const call of firstMessage.tool_calls) {
        let args
        try {
          args = JSON.parse(call.function.arguments)
        } catch {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ success: false, error: 'Neplatný formát dat.' }),
          })
          continue
        }

        if (call.function.name === 'update_meal_plan') {
          const days = Array.isArray(args.days) ? args.days.length : 1
          const { error } = mealPlan
            ? await supabase.from('meal_plans').update({ days, plan_json: args }).eq('id', mealPlan.id)
            : await supabase.from('meal_plans').insert({ user_id: user.id, days, plan_json: args })
          mealPlanUpdated = !error
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(error ? { success: false, error: error.message } : { success: true }),
          })
        } else if (call.function.name === 'update_training_plan') {
          const { error } = trainingPlan
            ? await supabase.from('training_plans').update({ plan_json: args }).eq('id', trainingPlan.id)
            : await supabase.from('training_plans').insert({ user_id: user.id, plan_json: args })
          trainingPlanUpdated = !error
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(error ? { success: false, error: error.message } : { success: true }),
          })
        } else {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ success: false, error: 'Neznámý nástroj.' }),
          })
        }
      }

      const finalMessage = await callAIRaw({ messages, maxTokens: 1024 })
      firstMessage.content = finalMessage.content
    }

    const reply = firstMessage.content || 'Omlouvám se, nepodařilo se mi odpovědět.'

    const { error: insertReplyError } = await supabase
      .from('chat_messages')
      .insert({ user_id: user.id, role: 'assistant', content: reply })
    if (insertReplyError) throw insertReplyError

    return jsonResponse(200, { reply, mealPlanUpdated, trainingPlanUpdated }, corsHeaders)
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message || 'Neočekávaná chyba.' }, corsHeaders)
  }
})
