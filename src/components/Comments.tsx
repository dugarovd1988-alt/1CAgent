import { useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { formatDateTime, type JournalEntry } from '../lib/journal'
import { UserChip } from './ui'

interface CommentsProps {
  entry: JournalEntry
  onAdd: (text: string) => void
}

export default function Comments({ entry, onAdd }: CommentsProps) {
  const [value, setValue] = useState('')
  const comments = entry.comments ?? []

  const submit = () => {
    const text = value.trim()
    if (!text) return
    onAdd(text)
    setValue('')
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <MessageSquare className="h-3.5 w-3.5" />
        Комментарии и заметки
      </p>

      <div className="mt-3 space-y-3">
        {comments.length === 0 ? (
          <p className="text-xs text-slate-400">
            Комментариев пока нет — добавьте внутреннюю заметку по запросу.
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <UserChip name={c.author} />
              <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2">
                <p className="flex flex-wrap items-center justify-between gap-x-2 text-xs">
                  <span className="font-medium text-slate-700">{c.author}</span>
                  <span className="text-slate-400">{formatDateTime(c.time)}</span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-800">{c.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Добавьте комментарий или заметку..."
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
        <button
          onClick={submit}
          disabled={!value.trim()}
          title="Добавить комментарий"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
