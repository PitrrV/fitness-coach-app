import { corsHeaders } from '../_shared/cors.js'
import { jsonResponse, verifyAuth } from '../_shared/shared.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Metoda není povolena.' }, corsHeaders)
  }

  try {
    const { user, supabase } = await verifyAuth(req)

    const { data: files } = await supabase.storage.from('measurement-photos').list(user.id)
    if (files?.length) {
      const paths = files.map((f) => `${user.id}/${f.name}`)
      await supabase.storage.from('measurement-photos').remove(paths)
    }

    // FK sloupce (profiles/check_ins/meal_plans/training_plans/ai_usage) mají
    // ON DELETE CASCADE na auth.users, takže smazáním uživatele zmizí i data.
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) throw error

    return jsonResponse(200, { success: true }, corsHeaders)
  } catch (err) {
    return jsonResponse(err.statusCode || 500, { error: err.message || 'Smazání účtu se nezdařilo.' }, corsHeaders)
  }
})
