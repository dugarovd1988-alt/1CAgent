export const RECEIPT_DOCUMENT_TYPE = 'Поступление товаров и услуг' as const

export interface ReceiptItem {
  name: string
  quantity: number | null
  price: number | null
  amount: number | null
}

export interface ReceiptDraft {
  documentType: typeof RECEIPT_DOCUMENT_TYPE
  counterparty: {
    name: string | null
    inn: string | null
    kpp: string | null
  }
  date: string | null
  items: ReceiptItem[]
  totalAmount: number | null
  currency: 'RUB' | null
  uncertainties: string[]
  missingFields: string[]
}

export interface DirectoryCounterparty {
  id: string
  name: string
  inn: string
  kpp: string | null
}

export interface ValidationResult {
  errors: string[]
  warnings: string[]
  counterparty: DirectoryCounterparty | null
  matchedItems: Array<{ index: number; id: string; name: string; unit: string }>
}

export type ProcessingStage = 'requires_clarification' | 'ready_to_create' | 'created'

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function parseReceiptDraft(value: unknown): ReceiptDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ИИ вернул неверную структуру черновика')
  }
  const source = value as Record<string, unknown>
  if (source.documentType !== RECEIPT_DOCUMENT_TYPE) {
    throw new Error('Поддерживается только документ «Поступление товаров и услуг»')
  }
  const cp = source.counterparty && typeof source.counterparty === 'object'
    ? source.counterparty as Record<string, unknown>
    : {}
  const rawItems = Array.isArray(source.items) ? source.items : []
  const items = rawItems.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('ИИ вернул неверную строку товара')
    const item = raw as Record<string, unknown>
    return { name: nullableString(item.name) ?? '', quantity: nullableNumber(item.quantity), price: nullableNumber(item.price), amount: nullableNumber(item.amount) }
  })
  return {
    documentType: RECEIPT_DOCUMENT_TYPE,
    counterparty: { name: nullableString(cp.name), inn: nullableString(cp.inn), kpp: nullableString(cp.kpp) },
    date: nullableString(source.date), items,
    totalAmount: nullableNumber(source.totalAmount),
    currency: source.currency === 'RUB' ? 'RUB' : null,
    uncertainties: Array.isArray(source.uncertainties) ? source.uncertainties.filter((v): v is string => typeof v === 'string' && !!v.trim()).map(v => v.trim()) : [],
    missingFields: Array.isArray(source.missingFields) ? source.missingFields.filter((v): v is string => typeof v === 'string' && !!v.trim()).map(v => v.trim()) : [],
  }
}
