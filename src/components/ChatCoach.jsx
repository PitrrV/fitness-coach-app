import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/api'
import { useToast } from './Toast'
import { inputCls } from './ui'

export default function ChatCoach({ user }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const toast = useToast()
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!open) return
    let active = true
    async function load() {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50)
      if (!active) return
      if (error) toast.error('Nepodařilo se načíst historii konverzace.')
      else setMessages(data ?? [])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [open, user.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, sending])

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setMessages((list) => [...list, { id: `local-${Date.now()}`, role: 'user', content: text }])
    setSending(true)
    try {
      const result = await callFunction('chat-coach', { message: text })
      setMessages((list) => [...list, { id: `local-reply-${Date.now()}`, role: 'assistant', content: result.reply }])
      if (result.mealPlanUpdated) toast.success('Kouč upravil tvůj jídelníček — mrkni na záložku Jídelníček.')
      if (result.trainingPlanUpdated) toast.success('Kouč upravil tvůj trénink — mrkni na záložku Trénink.')
    } catch (err) {
      toast.error(err.message || 'Odeslání zprávy se nezdařilo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Zavřít AI kouče' : 'Otevřít AI kouče'}
        className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full
          bg-accent text-ink shadow-lg shadow-black/40 transition hover:brightness-110 sm:bottom-6 sm:right-6"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {open && (
        <div
          className="fixed inset-x-3 bottom-[9.5rem] z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl
            border border-border bg-surface shadow-xl shadow-black/40 sm:inset-x-auto sm:bottom-24 sm:right-6
            sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-semibold text-text">AI kouč</div>
            <div className="text-xs text-muted">Ptej se na jídelníček, trénink i progres</div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
            {loading && <div className="text-sm text-muted">Načítám konverzaci…</div>}
            {!loading && messages.length === 0 && (
              <div className="text-sm text-muted">
                Ahoj! Zeptej se mě na cokoliv o svém jídelníčku nebo tréninku — klidně chci i konkrétní změnu.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-accent/15 text-text' : 'bg-ink text-text'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <div className="text-sm text-muted">Kouč přemýšlí…</div>}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border p-3">
            <input
              className={inputCls}
              placeholder="Napiš zprávu…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Odeslat"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-ink
                transition hover:brightness-110 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
