import { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Loader2,
  ExternalLink,
  Building2,
  FileSpreadsheet,
  Wallet,
  Hash,
  Mail,
  Send,
  UserCheck,
  Inbox,
} from 'lucide-react'
import { REQUESTERS, formatRequestNumber, type JournalEntry, type Requester } from '../lib/journal'

export type ResultState = 'idle' | 'loading' | 'success' | 'error' | 'clarification'

interface ResultPanelProps {
  state: ResultState
  entry: JournalEntry | null
  requestNumber: number
  onClarified: (requester: Requester) => void
  onCreate?: () => void
}

function StateShell({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'neutral' | 'success' | 'warning' | 'info'
  icon: React.ReactNode
  title: string
  children?: React.ReactNode
}) {
  const toneMap = {
    neutral: 'text-slate-400 bg-slate-100',
    success: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    info: 'text-blue-600 bg-blue-50',
  } as const

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-10 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${toneMap[tone]}`}>
        {icon}
      </div>
      <p className="mt-4 text-base font-semibold text-slate-800">{title}</p>
      {children}
    </div>
  )
}

function RequestNumberChip({ number }: { number: number }) {
  return (
    <div className="flex items-center justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        <Hash className="h-3 w-3" />
        Запрос {formatRequestNumber(number)}
      </span>
    </div>
  )
}

function SuccessCard({ entry, onCreate }: { entry: JournalEntry | null; onCreate?: () => void }) {
  const rows = [
    {
      icon: <FileSpreadsheet className="h-4 w-4 text-slate-400" />,
      label: 'Тип документа',
      value: entry?.docType ?? 'Поступление товаров и услуг',
    },
    {
      icon: <Hash className="h-4 w-4 text-slate-400" />,
      label: 'Номер демо-документа',
      value: entry?.docNumber ?? 'Будет присвоен после подтверждения',
      mono: true,
    },
    {
      icon: <Building2 className="h-4 w-4 text-slate-400" />,
      label: 'Контрагент',
      value: entry?.counterparty ?? 'ООО «Ромашка»',
    },
    {
      icon: <Wallet className="h-4 w-4 text-slate-400" />,
      label: 'Сумма',
      value: entry?.amount ?? '100 000 руб.',
    },
  ]

  return (
    <div className="mt-6 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm">
      <dl className="space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4">
            <dt className="flex items-center gap-2 text-sm text-slate-500">
              {row.icon}
              {row.label}
            </dt>
            <dd
              className={`text-right text-sm font-medium text-slate-900 ${row.mono ? 'font-mono text-[13px]' : ''}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {entry?.draft && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Извлечённые позиции</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {entry.draft.items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                {item.name || 'Без наименования'} — {item.quantity ?? '—'} × {item.price ?? '—'} = {item.amount ?? '—'} руб.
              </li>
            ))}
          </ul>
          {!!entry.validation?.warnings.length && <p className="mt-3 text-xs text-amber-700">{entry.validation.warnings.join('; ')}</p>}
        </div>
      )}
      <button
        onClick={onCreate}
        disabled={!onCreate || !!entry?.docNumber}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <ExternalLink className="h-4 w-4" />
        {entry?.docNumber ? 'Демо-документ создан' : 'Подтвердить и создать демо-документ'}
      </button>
    </div>
  )
}

function ErrorList({ entry }: { entry: JournalEntry | null }) {
  const issues = entry?.issues ?? [
    'Не указан ИНН контрагента',
    'Не совпадает наименование организации со справочником 1С',
  ]

  return (
    <ul className="mt-6 w-full max-w-sm space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-5 text-left">
      {issues.map((issue) => (
        <li key={issue} className="flex items-start gap-2.5 text-sm text-slate-700">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          {issue}
        </li>
      ))}
      {entry?.validation?.warnings.map((warning) => (
        <li key={warning} className="flex items-start gap-2.5 text-sm text-amber-800">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
          Предупреждение: {warning}
        </li>
      ))}
    </ul>
  )
}

function ClarifyForm({ onSend }: { onSend: (requester: Requester) => void }) {
  const [selectedName, setSelectedName] = useState('')
  const [sending, setSending] = useState(false)
  const selected = REQUESTERS.find((r) => r.name === selectedName) ?? null

  const handleSend = () => {
    if (!selected || sending) return
    setSending(true)
    setTimeout(() => onSend(selected), 1200)
  }

  return (
    <div className="mt-6 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Mail className="h-4 w-4 text-blue-600" />
        Запросить недостающие данные у заявителя
      </p>
      <label className="mt-4 block text-xs font-medium text-slate-500">Заявитель</label>
      <select
        value={selectedName}
        onChange={(e) => setSelectedName(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      >
        <option value="">Выберите из справочника 1С...</option>
        {REQUESTERS.map((r) => (
          <option key={r.email} value={r.name}>
            {r.name} — {r.org}
          </option>
        ))}
      </select>

      {selected && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-500">Почта из 1С:</p>
          <p className="text-sm font-medium text-slate-800">{selected.email}</p>
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={!selected || sending}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Отправляю через почтовый сервер...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Отправить письмо заявителю
          </>
        )}
      </button>
    </div>
  )
}

function ClarificationCard({ requester }: { requester: Requester | null }) {
  const r = requester ?? REQUESTERS[0]
  return (
    <div className="mt-6 w-full max-w-sm rounded-xl border border-blue-200 bg-blue-50/60 p-5 text-left">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <UserCheck className="h-4 w-4 text-blue-600" />
        {r.name}
      </p>
      <p className="mt-1 text-sm text-slate-600">{r.org}</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
        <Mail className="h-3.5 w-3.5" />
        {r.email}
      </p>
      <p className="mt-4 border-t border-blue-100 pt-3 text-xs leading-relaxed text-slate-500">
        Письмо с перечнем недостающих данных отправлено через почтовый сервер. После ответа
        заявителя запрос можно обработать повторно из журнала.
      </p>
    </div>
  )
}

export default function ResultPanel({ state, entry, requestNumber, onClarified, onCreate }: ResultPanelProps) {
  const showNumber = requestNumber > 0 && state !== 'idle'

  return (
    <div className="flex h-full flex-col">
      {showNumber && (
        <div className="px-6 pt-5">
          <RequestNumberChip number={requestNumber} />
        </div>
      )}

      <div className="flex-1">
        {state === 'idle' && (
          <StateShell
            tone="neutral"
            icon={<FileText className="h-7 w-7" />}
            title="Ожидание ввода данных"
          >
            <p className="mt-1.5 max-w-xs text-sm text-slate-500">
              Вставьте текст письма слева: ИИ подготовит черновик, а создание потребует подтверждения.
            </p>
          </StateShell>
        )}

        {state === 'loading' && (
          <StateShell
            tone="neutral"
            icon={<Loader2 className="h-7 w-7 animate-spin" />}
            title="Анализирую текст и сверяю данные с 1С ERP..."
          >
            <p className="mt-1.5 text-sm text-slate-500">Обычно это занимает несколько секунд.</p>
          </StateShell>
        )}

        {state === 'success' && (
          <StateShell
            tone="success"
            icon={<CheckCircle2 className="h-7 w-7" />}
            title={entry?.docNumber ? 'Демо-документ создан' : 'Черновик проверен'}
          >
            <SuccessCard entry={entry} onCreate={onCreate} />
          </StateShell>
        )}

        {state === 'error' && (
          <StateShell
            tone="warning"
            icon={<AlertTriangle className="h-7 w-7" />}
            title="Недостаточно данных для создания документа"
          >
            <ErrorList entry={entry} />
            <ClarifyForm onSend={onClarified} />
          </StateShell>
        )}

        {state === 'clarification' && (
          <StateShell
            tone="info"
            icon={<Inbox className="h-7 w-7" />}
            title="На уточнении у заявителя"
          >
            <p className="mt-1.5 text-sm text-slate-500">
              Письмо отправлено, ожидаем ответ с недостающими данными.
            </p>
            <ClarificationCard requester={entry?.requester ?? null} />
          </StateShell>
        )}
      </div>
    </div>
  )
}
