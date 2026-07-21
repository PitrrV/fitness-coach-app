import { useEffect, useState } from 'react'

/**
 * Lokální (localStorage) checklist stav pro daný klíč — např. odškrtnuté série
 * tréninku nebo položky nákupního seznamu. Přežije refresh, ale je jen po
 * jednom zařízení (nejde o data v Supabase).
 */
export function useChecklist(key) {
  const [checked, setChecked] = useState({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      setChecked(raw ? JSON.parse(raw) : {})
    } catch {
      setChecked({})
    }
  }, [key])

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(checked))
    } catch {
      // úložiště nedostupné (privátní režim apod.) — checklist prostě nepřežije refresh
    }
  }, [key, checked])

  function toggle(itemKey) {
    setChecked((c) => ({ ...c, [itemKey]: !c[itemKey] }))
  }

  return [checked, toggle]
}
