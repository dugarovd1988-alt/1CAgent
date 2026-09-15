import { useState } from 'react'
import { ClipboardPaste, FilePlus2, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import ResultPanel, { type ResultState } from './ResultPanel'
import { Field } from './ui'
import { CURRENT_USER, formatFullDate, formatRequestNumber } from '../lib/journal'

const SAMPLE_FULL = `Добрый день!

Просим поставить товар: канцелярские наборы, 50 шт.
Контрагент: ООО "Ромашка", ИНН 7712345678, КПП 771201001.
Сумма поставки: 100 000 руб., оплата по счету № 145 от 12.05.2025.

С уважением,
отдел закупок`

const SAMPLE_INCOMPLETE = `Добрый день!

Просим поставить товар: канцелярские наборы, 50 шт.
От нашей компании ООО "Ромашки".
Сумма поставки: 100 000 руб.

С уважением,
отдел закупок`

interface NewRequestFormProps {
  requestNumber: number
  text: string
  onTextChange: (text: string) => void
  processing: boolean
  onProcess: () => void
}

export default function NewRequestForm({
  requestNumber,
  text,
  onTextChange,
  processing,
  onProcess,
}: NewRequestFormProps) {
  const [createdAt] = useState(() => Date.now())
  const panelState: ResultState = processing ? 'loading' : 'idle'

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip) onTextChange(clip)
    } catch {
      /* нет доступа к буферу — пользователь вставит вручную */
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Панель документа */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 px-6 py-4">
        <FilePlus2 className="h-5 w-5 text-blue-600" />
        <h2 className="text-sm font-semibold text-slate-800">Новый запрос</h2>
        <span className="ml-auto text-xs text-slate-400">
          Создание документа на основе текста письма
        </span>
      </div>

      {/* Шапка документа: номер, дата, оператор, статус */}
      <div className="grid grid-cols-2 gap-4 border-b border-slate-100 px-6 py-4 md:grid-cols-4">
        <Field label="Номер" value={formatRequestNumber(requestNumber)} mono />
        <Field label="Дата" value={formatFullDate(createdAt)} />
        <Field label="Оператор" value={`${CURRENT_USER.name} · ${CURRENT_USER.role}`} />
        <Field
          label="Статус"
          value={
            processing ? (
              <span className="flex items-center gap-1.5 text-blue-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Обрабатывается…
              </span>
            ) : (
              'Черновик'
            )
          }
        />
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        {/* Исходный текст */}
        <div className="flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Исходный текст письма
            </p>
            <button
              onClick={handlePaste}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Вставить из буфера
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Вставьте текст письма или заявки для создания документа..."
            className="min-h-[280px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onTextChange(SAMPLE_FULL)}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Пример: полные данные
              </button>
              <button
                onClick={() => onTextChange(SAMPLE_INCOMPLETE)}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Пример: не хватает данных
              </button>
            </div>
            <button
              onClick={() => onTextChange('')}
              title="Очистить текст"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={onProcess}
            disabled={!text.trim() || processing}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Обрабатываю…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Обработать и создать документ
              </>
            )}
          </button>
        </div>

        {/* Результат обработки */}
        <div className="flex flex-col">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Результат обработки
          </p>
          <div className="min-h-[380px] flex-1 rounded-xl border border-slate-100">
            <ResultPanel state={panelState} entry={null} requestNumber={0} onClarified={() => {}} />
          </div>
        </div>
      </div>
    </section>
  )
}
