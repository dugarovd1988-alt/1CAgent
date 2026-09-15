import { AlertTriangle, CheckCircle2, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { initialsOf, type JournalStatus } from '../lib/journal'

const META: Record<JournalStatus, { label: string; cls: string; icon: ReactNode }> = {
  success: {
    label: 'Создан',
    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  error: {
    label: 'Ошибка',
    cls: 'bg-amber-50 text-amber-700 ring-amber-200',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  clarification: {
    label: 'На уточнении',
    cls: 'bg-blue-50 text-blue-700 ring-blue-200',
    icon: <Inbox className="h-3.5 w-3.5" />,
  },
}

export function StatusBadge({ status }: { status: JournalStatus }) {
  const meta = META[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.cls}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  )
}

export function UserChip({ name }: { name: string }) {
  return (
    <span
      title={name}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200"
    >
      {initialsOf(name)}
    </span>
  )
}

export function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div
        title={typeof value === 'string' ? value : undefined}
        className={`mt-1 truncate rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 ${
          mono ? 'font-mono text-[13px]' : ''
        }`}
      >
        {value}
      </div>
    </div>
  )
}
