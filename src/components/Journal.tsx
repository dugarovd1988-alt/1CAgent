import { useMemo, useState } from 'react'
import { ChevronRight, Clock, FileText, Plus, ScrollText, Search, Trash2, X } from 'lucide-react'
import { StatusBadge, UserChip } from './ui'
import {
  formatDateTime,
  formatRequestNumber,
  type JournalEntry,
  type JournalStatus,
} from '../lib/journal'

type StatusFilter = 'all' | JournalStatus
type Period = 'all' | 'today' | 'week'

const GRID =
  'grid grid-cols-[76px_132px_minmax(0,1.2fr)_minmax(0,1fr)_160px_104px_136px_64px] items-center gap-3'

interface JournalProps {
  entries: JournalEntry[]
  onOpen: (entry: JournalEntry) => void
  onDelete: (id: string) => void
  onCreateNew: () => void
}

export default function Journal({ entries, onOpen, onDelete, onCreateNew }: JournalProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [period, setPeriod] = useState<Period>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = Date.now()
    return entries.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (period === 'today' && now - e.createdAt > 86_400_000) return false
      if (period === 'week' && now - e.createdAt > 7 * 86_400_000) return false
      if (q) {
        const haystack = [
          formatRequestNumber(e.number),
          e.counterparty ?? '',
          e.user,
          e.docNumber ?? '',
          e.docType ?? '',
          e.source,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [entries, statusFilter, period, query])

  const statusCounts = {
    all: entries.length,
    success: entries.filter((e) => e.status === 'success').length,
    error: entries.filter((e) => e.status === 'error').length,
    clarification: entries.filter((e) => e.status === 'clarification').length,
  }

  const periods: { key: Period; label: string }[] = [
    { key: 'all', label: 'За всё время' },
    { key: 'today', label: 'Сегодня' },
    { key: 'week', label: '7 дней' },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <ScrollText className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-800">Журнал запросов и документов</h2>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={onCreateNew}
            title="Новый запрос"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск: контрагент, пользователь, №..."
              className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:w-72"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                title="Очистить поиск"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">Все статусы ({statusCounts.all})</option>
            <option value="success">Проверен / создан ({statusCounts.success})</option>
            <option value="error">Ошибка ({statusCounts.error})</option>
            <option value="clarification">На уточнении ({statusCounts.clarification})</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-b border-slate-100 px-6 py-2.5">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              period === p.key ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          {/* Заголовки столбцов */}
          <div
            className={`${GRID} border-b border-slate-100 bg-slate-50/80 px-6 py-2.5 text-xs font-medium text-slate-400`}
          >
            <span>Номер</span>
            <span>Статус</span>
            <span>Документ</span>
            <span>Контрагент</span>
            <span>Оператор</span>
            <span className="text-right">Сумма</span>
            <span className="text-right">Дата</span>
            <span />
          </div>

          {filtered.length > 0 ? (
            filtered.map((entry) => (
              <div
                key={entry.id}
                onClick={() => onOpen(entry)}
                className={`group ${GRID} cursor-pointer border-b border-slate-100 px-6 py-3 transition-colors last:border-b-0 hover:bg-blue-50/40`}
              >
                <span className="font-mono text-xs font-semibold text-slate-500">
                  {formatRequestNumber(entry.number)}
                </span>
                <StatusBadge status={entry.status} stage={entry.stage} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {entry.docType ?? 'Документ не создан'}
                  </p>
                  <p className="truncate font-mono text-xs text-slate-400">
                    {entry.docNumber ?? '—'}
                  </p>
                </div>
                <p className="truncate text-sm text-slate-700">
                  {entry.counterparty ?? 'Требуются данные'}
                </p>
                <div className="flex min-w-0 items-center gap-2">
                  <UserChip name={entry.user} />
                  <span className="truncate text-xs text-slate-600">{entry.user}</span>
                </div>
                <span className="text-right text-sm font-medium text-slate-900">
                  {entry.amount ?? '—'}
                </span>
                <span className="text-right text-xs text-slate-500">
                  {formatDateTime(entry.createdAt)}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(entry.id)
                    }}
                    title="Удалить запись"
                    className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-blue-500" />
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <FileText className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800">Записей не найдено</p>
              <p className="mt-1 max-w-xs text-sm text-slate-500">
                {query || statusFilter !== 'all'
                  ? 'Попробуйте изменить условия поиска или сбросить фильтры.'
                  : 'Создайте запрос — он появится в журнале.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
