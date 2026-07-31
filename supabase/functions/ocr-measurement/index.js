import { corsHeaders } from '../_shared/cors.js'
import { callAIRaw, checkRateLimit, jsonResponse, parseAIJson, verifyAuth } from '../_shared/shared.js'

const MAX_BASE64_LENGTH = 12_000_000 // ~9 MB dekódovaný obrázek
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

const RESULT_SCHEMA = `{
  "values": {
    "weight_kg": number | null,
    "body_fat_pct": number | null,
    "muscle_mass_kg": number | null,
    "visceral_fat": number | null,
    "waist_cm": number | null,
    "hip_cm": number | null,
    "chest_cm": number | null,
    "arm_cm": number | null,
    "thigh_cm": number | null
  },
  "confidence": {
    "weight_kg": "high" | "low" | null,
    "body_fat_pct": "high" | "low" | null,
    "muscle_mass_kg": "high" | "low" | null,
    "visceral_fat": "high" | "low" | null,
    "waist_cm": "high" | "low" | null,
    "hip_cm": "high" | "low" | null,
    "chest_cm": "high" | "low" | null,
    "arm_cm": "high" | "low" | null,
    "thigh_cm": "high" | "low" | null
  },
  "measurement_source": "inbody" | "caliper" | "smart_scale" | "unknown"
}`

const SYSTEM_PROMPT = `Jsi asistent, který čte fotografie výsledkových listů tělesného složení (InBody, kaliper,
chytrá váha apod.) a vytáhne z nich číselné hodnoty.

Pravidla:
- Pokud si hodnotou nejsi jistý/á nebo není na obrázku čitelná/přítomná, vrať pro ni null a
  confidence null. NIKDY si hodnotu nevymýšlej ani neodhaduj z jiných čísel.
- confidence "high" jen když je číslo v obrázku jasně a jednoznačně čitelné.
- measurement_source odhadni podle vzhledu listu (InBody má typicky logo a specifický layout,
  kaliper bývá ruční zápis, chytrá váha appka na displeji telefonu). Pokud si nejsi jistý, "unknown".
- Odpověz VÝHRADNĚ platným JSON přesně v této struktuře, bez dalšího textu:
${RESULT_SCHEMA}`

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
    const { imageBase64, mimeType } = body

    if (typeof imageBase64 !== 'string' || !imageBase64) {
      return jsonResponse(400, { error: 'Chybí obrázek.' }, corsHeaders)
    }
    if (!ALLOWED_MIME.includes(mimeType)) {
      return jsonResponse(400, { error: 'Nepodporovaný formát obrázku.' }, corsHeaders)
    }
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return jsonResponse(400, { error: 'Obrázek je příliš velký (max ~9 MB).' }, corsHeaders)
    }

    const message = await callAIRaw({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Přečti hodnoty z tohoto výsledkového listu.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
      maxTokens: 1024,
    })

    const parsed = parseAIJson(message.content ?? '')

    return jsonResponse(200, parsed, corsHeaders)
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message || 'Neočekávaná chyba.' }, corsHeaders)
  }
})
