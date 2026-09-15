import { ArrowLeft, FileText, RotateCcw, Trash2 } from 'lucide-react'
import ResultPanel, { type ResultState } from './ResultPanel'
import Logs from './Logs'
import Comments from './Comments'
import { Field, StatusBadge } from './ui'
import {
  formatDateTime,
  formatFullDate,
  formatRequestNumber,
  type JournalEntry,
  type Requester,
} from '../lib/journal'

interface RequestDocumentProps {
  entry: JournalEntry
  text: string
  onTextChange: (text: string) => void
  processing: boolean
  onReprocess: () => void
  onClarified: (requester: Requester) => void
  onAddComment: (text: string) => void
  onBack: () => void
  onDelete: (id: string) => void
  onCreate?: () => void
}

export default function RequestDocument({
  entry,
  text,
  onTextChange,
  processing,
  onReprocess,
  onClarified,
  onAddComment,
  onBack,
  onDelete,
  onCreate,
}: RequestDocumentProps) {
  const panelState: ResultState = processing ? 'loading' : entry.status
  const dirty = text.trim().length > 0 && text !== entry.source

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        К журналу
      </button>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Шапка запроса */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
          <FileText className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Запрос {formatRequestNumber(entry.number)}
          </h2>
          <StatusBadge status={entry.status} stage={entry.stage} />
          <div className="ml-auto flex items-center gap-2">
            {entry.stage === 'created' && <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Создано в демо-адаптере</span>}
            <button
              onClick={onReprocess}
              disabled={!dirty || processing}
              title={dirty ? 'Обработать с уточнённым текстом' : 'Измените текст запроса слева'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Обработать повторно
            </button>
            <button
              onClick={() => onDelete(entry.id)}
              title="Удалить запрос"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Реквизиты запроса */}
        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 px-6 py-4 md:grid-cols-3 lg:grid-cols-6">
          <Field label="Дата создания" value={formatFullDate(entry.createdAt)} />
          <Field label="Оператор" value={entry.user} />
          <Field label="Контрагент" value={entry.counterparty ?? '—'} />
          <Field label="Сумма" value={entry.amount ?? '—'} />
          <Field label="Демо-документ" value={entry.docNumber ?? '—'} mono />
          <Field
            label="Обновлён"
            value={entry.updatedAt ? formatDateTime(entry.updatedAt) : formatDateTime(entry.createdAt)}
          />
        </div>

        {/* Текст запроса + результат */}
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <div className="flex flex-col">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Исходный текст запроса
            </p>
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              className="min-h-[280px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
            <p className="mt-2 text-xs text-slate-400">
              {dirty
                ? 'Текст изменён — нажмите «Обработать повторно», чтобы заново проверить черновик.'
                : 'Уточните текст запроса (например, добавьте ИНН), чтобы обработать его повторно.'}
            </p>
          </div>

          <div className="flex flex-col">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Результат обработки
            </p>
            <div className="min-h-[380px] flex-1 rounded-xl border border-slate-100">
              <ResultPanel
                state={panelState}
                entry={entry}
                requestNumber={entry.number}
                onClarified={onClarified}
                onCreate={onCreate}
              />
            </div>
          </div>
        </div>

        {/* Лог и комментарии */}
        <div className="grid gap-4 border-t border-slate-100 px-6 py-4 lg:grid-cols-2">
          <Logs entry={entry} />
          <Comments entry={entry} onAdd={onAddComment} />
        </div>
      </section>
    </div>
  )
}
