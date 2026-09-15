import { ScrollText } from 'lucide-react'
import { formatTime, type JournalEntry } from '../lib/journal'

export default function Logs({ entry }: { entry: JournalEntry }) {
  const logs = [...entry.logs].sort((a, b) => a.time - b.time)
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <ScrollText className="h-3.5 w-3.5" />
        Лог обработки
      </p>
      <ol className="mt-2.5 space-y-2">
        {logs.map((log, i) => (
          <li key={`${log.time}-${i}`} className="flex items-start gap-2.5">
            <span className="mt-1 w-16 shrink-0 font-mono text-[11px] text-slate-400">
              {formatTime(log.time)}
            </span>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
            <span className="text-xs leading-relaxed text-slate-700">{log.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
