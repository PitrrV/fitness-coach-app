import { supabase } from './supabase'

/**
 * Zavolá Netlify Function s auth tokenem aktuální session.
 * Vyhazuje Error se srozumitelnou zprávou při chybě.
 */
export async function callFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Nejsi přihlášen/a.')
  }

  const res = await fetch(`/.netlify/functions/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body ?? {}),
  })

  let payload
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok) {
    const message = payload?.error || `Chyba serveru (${res.status})`
    throw new Error(message)
  }

  return payload
}
