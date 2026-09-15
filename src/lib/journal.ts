export type JournalStatus = 'success' | 'error' | 'clarification'

export interface Requester {
  name: string
  email: string
  org: string
}

export interface LogEntry {
  time: number
  text: string
}

export interface Comment {
  id: string
  author: string
  text: string
  time: number
}

export interface JournalEntry {
  id: string
  number: number
  createdAt: number
  updatedAt?: number
  status: JournalStatus
  user: string
  docType?: string
  docNumber?: string
  counterparty?: string
  amount?: string
  issues?: string[]
  requester?: Requester
  source: string
  logs: LogEntry[]
  comments?: Comment[]
}

export const CURRENT_USER = { name: 'Анна Смирнова', role: 'Бухгалтер' }

export const USERS: { name: string; role: string }[] = [
  CURRENT_USER,
  { name: 'Дмитрий Орлов', role: 'Бухгалтер' },
  { name: 'Елена Кузнецова', role: 'Старший бухгалтер' },
]

export const REQUESTERS: Requester[] = [
  { name: 'Мария Иванова', email: 'm.ivanova@romashka.ru', org: 'ООО «Ромашка»' },
  { name: 'Сергей Петров', email: 's.petrov@vektor.ru', org: 'ООО «Вектор»' },
  { name: 'Ольга Смирнова', email: 'o.smirnova@stroytorg.ru', org: 'ООО «Стройторг»' },
  { name: 'Игорь Ковалёв', email: 'i.kovalev@mail.ru', org: 'ИП Ковалёв А.С.' },
]

const STORAGE_KEY = 'ai-1c-journal-v4'
const HOUR = 3_600_000

export function formatRequestNumber(n: number): string {
  return `З-${String(n).padStart(4, '0')}`
}

export function nextNumber(entries: JournalEntry[]): number {
  return entries.reduce((max, e) => Math.max(max, e.number), 0) + 1
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts)
}

export function formatFullDate(ts: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts)
}

export function formatTime(ts: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(ts)
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function parseCounterparty(text: string): string | undefined {
  const m = text.match(
    /(?:контрагент|от|покупатель|поставщик)[:\s]+(?:ООО|ИП|АО|ЗАО)?\s*([«"]?[A-ZА-ЯЁ][^,.\n«"]{2,40})/i,
  )
  return m ? m[1].trim().replace(/[»"]$/, '') : undefined
}

function parseAmount(text: string): string | undefined {
  const m = text.match(/(\d[\d\s]{2,})\s*(руб|₽)/i)
  return m ? `${m[1].trim()} руб.` : undefined
}

export function shortenSource(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 120 ? `${clean.slice(0, 120)}...` : clean
}

function newDocNumber(): string {
  return `00-${Math.floor(10_000_000 + Math.random() * 89_999_999)}`
}

export function createEntry(
  source: string,
  resultState: 'success' | 'error',
  number: number,
  userName: string,
): JournalEntry {
  const now = Date.now()
  const docType = 'Поступление товаров и услуг'
  const counterparty = parseCounterparty(source) ?? 'ООО «Ромашка»'
  const amount = parseAmount(source) ?? '100 000 руб.'
  const issues = [
    'Не указан ИНН контрагента',
    'Не совпадает наименование организации со справочником 1С',
  ]
  const logs: LogEntry[] = [
    { time: now - 1600, text: `Запрос ${formatRequestNumber(number)} зарегистрирован` },
    { time: now - 1100, text: 'Извлечение реквизитов из текста письма (ИИ)' },
    { time: now - 700, text: 'Сверка реквизитов со справочниками 1С ERP' },
  ]

  if (resultState === 'success') {
    const docNumber = newDocNumber()
    logs.push(
      { time: now - 350, text: `Контрагент найден в справочнике: ${counterparty}` },
      { time: now, text: `Документ «${docType}» создан, номер ${docNumber}` },
    )
    return {
      id: newId(),
      number,
      createdAt: now,
      status: 'success',
      user: userName,
      docType,
      docNumber,
      counterparty,
      amount,
      source,
      logs,
    }
  }

  logs.push(
    ...issues.map((issue, idx) => ({ time: now - 300 + idx * 50, text: `Проблема: ${issue}` })),
    { time: now, text: 'Документ не создан — требуется уточнение данных' },
  )
  return {
    id: newId(),
    number,
    createdAt: now,
    status: 'error',
    user: userName,
    issues,
    source,
    logs,
  }
}

export function reprocessEntry(
  source: string,
  prev: JournalEntry,
  userName: string,
): JournalEntry {
  const now = Date.now()
  const resultState: 'success' | 'error' = /инн\s*\d{9,12}/i.test(source) ? 'success' : 'error'
  const docType = 'Поступление товаров и услуг'
  const counterparty = parseCounterparty(source) ?? prev.counterparty ?? 'ООО «Ромашка»'
  const amount = parseAmount(source) ?? prev.amount ?? '100 000 руб.'
  const issues = [
    'Не указан ИНН контрагента',
    'Не совпадает наименование организации со справочником 1С',
  ]
  const logs: LogEntry[] = [
    ...prev.logs,
    { time: now - 1400, text: 'Текст запроса уточнён, запущена повторная обработка' },
    { time: now - 900, text: 'Извлечение реквизитов из текста письма (ИИ)' },
    { time: now - 500, text: 'Сверка реквизитов со справочниками 1С ERP' },
  ]
  const base: JournalEntry = { ...prev, user: userName, source, updatedAt: now }

  if (resultState === 'success') {
    const docNumber = newDocNumber()
    logs.push(
      { time: now - 300, text: `Контрагент найден в справочнике: ${counterparty}` },
      { time: now, text: `Документ «${docType}» создан, номер ${docNumber}` },
    )
    return {
      ...base,
      status: 'success',
      docType,
      docNumber,
      counterparty,
      amount,
      issues: undefined,
      logs,
    }
  }

  logs.push(
    ...issues.map((issue, idx) => ({ time: now - 300 + idx * 50, text: `Проблема: ${issue}` })),
    { time: now, text: 'Документ не создан — требуется уточнение данных' },
  )
  return {
    ...base,
    status: 'error',
    docType: undefined,
    docNumber: undefined,
    counterparty: undefined,
    amount: undefined,
    issues,
    logs,
  }
}

function seedLogs(base: number, lines: [number, string][]): LogEntry[] {
  return lines.map(([offset, text]) => ({ time: base + offset, text }))
}

export const SEED_ENTRIES: JournalEntry[] = [
  {
    id: 'seed-1',
    number: 6,
    createdAt: Date.now() - 2 * HOUR,
    status: 'success',
    user: 'Анна Смирнова',
    docType: 'Поступление товаров и услуг',
    docNumber: '00-00012437',
    counterparty: 'ООО «Ромашка»',
    amount: '100 000 руб.',
    source:
      'Добрый день! Просим поставить товар: канцелярские наборы, 50 шт. Контрагент: ООО «Ромашка», ИНН 7712345678...',
    logs: seedLogs(Date.now() - 2 * HOUR, [
      [-1500, 'Запрос З-0006 зарегистрирован'],
      [-900, 'Извлечение реквизитов из текста письма (ИИ)'],
      [-400, 'Контрагент найден в справочнике: ООО «Ромашка»'],
      [0, 'Документ «Поступление товаров и услуг» создан, номер 00-00012437'],
    ]),
  },
  {
    id: 'seed-2',
    number: 5,
    createdAt: Date.now() - 5 * HOUR,
    status: 'clarification',
    user: 'Дмитрий Орлов',
    issues: ['Не указан ИНН контрагента', 'Не распознана дата документа'],
    requester: REQUESTERS[2],
    comments: [
      {
        id: 'seed-c1',
        author: 'Елена Кузнецова',
        text: 'Запросила у заявителя ИНН по электронной почте. Ждём ответ до конца дня.',
        time: Date.now() - 5 * HOUR + 600_000,
      },
      {
        id: 'seed-c2',
        author: 'Анна Смирнова',
        text: 'Если ответа не будет до завтра — вернём заявку заявителю без обработки.',
        time: Date.now() - 5 * HOUR + 1_200_000,
      },
    ],
    source:
      'Прошу оформить поступление от ООО «Стройторг» на сумму 56 400 руб. Счёт прилагаю...',
    logs: seedLogs(Date.now() - 5 * HOUR, [
      [-1500, 'Запрос З-0005 зарегистрирован'],
      [-800, 'Проблема: не указан ИНН контрагента'],
      [-500, 'Проблема: не распознана дата документа'],
      [0, 'Документ не создан — требуется уточнение данных'],
      [40_000, 'Письмо отправлено заявителю: o.smirnova@stroytorg.ru'],
      [41_000, 'Статус изменён: «На уточнении у заявителя»'],
    ]),
  },
  {
    id: 'seed-3',
    number: 4,
    createdAt: Date.now() - 26 * HOUR,
    status: 'success',
    user: 'Елена Кузнецова',
    docType: 'Поступление товаров и услуг',
    docNumber: '00-00012108',
    counterparty: 'ООО «Вектор»',
    amount: '245 500 руб.',
    source:
      'Направляем заявку на поставку оргтехники. Контрагент: ООО «Вектор», ИНН 7811223344. Сумма 245 500 руб...',
    logs: seedLogs(Date.now() - 26 * HOUR, [
      [-1400, 'Запрос З-0004 зарегистрирован'],
      [-700, 'Контрагент найден в справочнике: ООО «Вектор»'],
      [0, 'Документ «Поступление товаров и услуг» создан, номер 00-00012108'],
    ]),
  },
  {
    id: 'seed-4',
    number: 3,
    createdAt: Date.now() - 2 * 24 * HOUR,
    status: 'success',
    user: 'Анна Смирнова',
    docType: 'Реализация товаров и услуг',
    docNumber: '00-00009812',
    counterparty: 'ИП Ковалёв А.С.',
    amount: '78 300 руб.',
    source:
      'Отгрузите, пожалуйста, заказ № 87. Покупатель: ИП Ковалёв А.С., ИНН 366312345678. Итого 78 300 руб...',
    logs: seedLogs(Date.now() - 2 * 24 * HOUR, [
      [-1300, 'Запрос З-0003 зарегистрирован'],
      [-600, 'Контрагент найден в справочнике: ИП Ковалёв А.С.'],
      [0, 'Документ «Реализация товаров и услуг» создан, номер 00-00009812'],
    ]),
  },
  {
    id: 'seed-5',
    number: 2,
    createdAt: Date.now() - 3 * 24 * HOUR,
    status: 'error',
    user: 'Дмитрий Орлов',
    issues: ['Не совпадает наименование организации со справочником 1С'],
    source:
      'Оплатите счёт от ООО «Ромашки» (в справочнике — ООО «Ромашка»). Сумма 12 000 руб...',
    logs: seedLogs(Date.now() - 3 * 24 * HOUR, [
      [-1200, 'Запрос З-0002 зарегистрирован'],
      [-500, 'Проблема: не совпадает наименование организации со справочником 1С'],
      [0, 'Документ не создан — требуется уточнение данных'],
    ]),
  },
]

export function loadEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as JournalEntry[]
    }
  } catch {
    /* повреждённое хранилище — вернём демо-данные */
  }
  return SEED_ENTRIES
}

export function saveEntries(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* хранилище недоступно — журнал работает в рамках сессии */
  }
}
