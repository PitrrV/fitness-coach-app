// CORS hlavičky pro Edge Functions volané z GitHub Pages (jiná origin než Supabase).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
