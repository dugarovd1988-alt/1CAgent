import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { parseReceiptDraft, RECEIPT_DOCUMENT_TYPE, type DirectoryCounterparty, type ReceiptDraft, type ValidationResult } from '../shared/receipt.js'

const MONEY_TOLERANCE = 0.01
const positive = (value: number | null) => value !== null && value > 0
const closeMoney = (left: number, right: number) => Math.abs(left - right) <= MONEY_TOLERANCE
const normalizeName = (value: string) => value.toLocaleLowerCase('ru-RU').replace(/[\s«»"']/g, '')

export function initDirectories(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS counterparties(id TEXT PRIMARY KEY,name TEXT NOT NULL,inn TEXT UNIQUE,kpp TEXT);
    CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,unit TEXT NOT NULL DEFAULT 'шт');
    CREATE TABLE IF NOT EXISTS demo_documents(id TEXT PRIMARY KEY,request_id TEXT NOT NULL UNIQUE,number TEXT NOT NULL UNIQUE,draft_json TEXT NOT NULL,created_by TEXT NOT NULL,created_at INTEGER NOT NULL);
  `)
  const count = db.prepare('SELECT COUNT(*) n FROM counterparties').get() as { n: number }
  if (!count.n) db.prepare('INSERT INTO counterparties VALUES (?,?,?,?)').run('cp-romashka','ООО «Ромашка»','7712345678','771201001')
  const itemCount = db.prepare('SELECT COUNT(*) n FROM items').get() as { n: number }
  if (!itemCount.n) db.prepare('INSERT INTO items VALUES (?,?,?)').run('item-set','Канцелярские наборы','шт')
}

export function findCounterparty(db: Database.Database, inn?: string | null): DirectoryCounterparty | null {
  if (!inn) return null
  return (db.prepare('SELECT id,name,inn,kpp FROM counterparties WHERE inn=? LIMIT 1').get(inn) as DirectoryCounterparty | undefined) ?? null
}

export function findItem(db: Database.Database, name?: string | null) {
  if (!name) return null
  return (db.prepare('SELECT id,name,unit FROM items WHERE lower(name)=lower(?) LIMIT 1').get(name) as { id: string; name: string; unit: string } | undefined) ?? null
}

export function validateDocument(db: Database.Database, input: unknown): { draft: ReceiptDraft; validation: ValidationResult } {
  const draft = parseReceiptDraft(input)
  const errors: string[] = []
  const warnings = [...draft.missingFields.map(v => `Не хватает данных: ${v}`), ...draft.uncertainties.map(v => `Требует проверки: ${v}`)]
  if (draft.documentType !== RECEIPT_DOCUMENT_TYPE) errors.push('Неподдерживаемый тип документа')
  if (!draft.counterparty.inn) errors.push('Не указан ИНН контрагента')
  else if (!/^\d{10}$|^\d{12}$/.test(draft.counterparty.inn)) errors.push('ИНН должен содержать 10 или 12 цифр')
  if (!draft.counterparty.name) errors.push('Не указано наименование контрагента')
  if (draft.counterparty.kpp && !/^\d{9}$/.test(draft.counterparty.kpp)) errors.push('КПП должен содержать 9 цифр')
  if (!draft.date) errors.push('Не указана дата документа')
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(Date.parse(`${draft.date}T00:00:00Z`))) errors.push('Дата должна быть корректной и иметь формат YYYY-MM-DD')
  if (draft.currency !== 'RUB') errors.push('Поддерживается только валюта RUB')
  if (!draft.items.length) errors.push('Не распознана номенклатура')

  const counterparty = findCounterparty(db, draft.counterparty.inn)
  if (draft.counterparty.inn && !counterparty) errors.push('Контрагент не найден в демо-справочнике 1С')
  if (counterparty && draft.counterparty.name && normalizeName(counterparty.name) !== normalizeName(draft.counterparty.name)) errors.push(`Наименование контрагента не совпадает со справочником: ${counterparty.name}`)
  if (counterparty?.kpp && draft.counterparty.kpp && counterparty.kpp !== draft.counterparty.kpp) errors.push('КПП не совпадает со справочником 1С')

  const matchedItems: ValidationResult['matchedItems'] = []
  let calculatedTotal = 0
  let canCalculateTotal = draft.items.length > 0
  draft.items.forEach((item, index) => {
    const line = index + 1
    if (!item.name) errors.push(`Строка ${line}: не указана номенклатура`)
    const directoryItem = findItem(db, item.name)
    if (item.name && !directoryItem) errors.push(`Строка ${line}: номенклатура не найдена в демо-справочнике 1С: ${item.name}`)
    if (directoryItem) matchedItems.push({ index, ...directoryItem })
    if (!positive(item.quantity)) errors.push(`Строка ${line}: количество должно быть больше нуля`)
    if (!positive(item.price)) errors.push(`Строка ${line}: цена должна быть больше нуля`)
    if (!positive(item.amount)) errors.push(`Строка ${line}: сумма должна быть больше нуля`)
    if (positive(item.quantity) && positive(item.price) && positive(item.amount)) {
      const expected = item.quantity! * item.price!
      if (!closeMoney(expected, item.amount!)) errors.push(`Строка ${line}: сумма не равна количеству × цене`)
      calculatedTotal += item.amount!
    } else canCalculateTotal = false
  })
  if (!positive(draft.totalAmount)) errors.push('Итоговая сумма должна быть больше нуля')
  else if (canCalculateTotal && !closeMoney(calculatedTotal, draft.totalAmount!)) errors.push('Итоговая сумма не совпадает с суммой строк')
  return { draft, validation: { errors: [...new Set(errors)], warnings: [...new Set(warnings)], counterparty, matchedItems } }
}

export function createReceipt(db: Database.Database, requestId: string, input: unknown, createdBy: string) {
  const { draft, validation } = validateDocument(db, input)
  if (validation.errors.length) return { created: false as const, draft, validation }
  const existing = db.prepare('SELECT id,number,created_at createdAt FROM demo_documents WHERE request_id=?').get(requestId) as { id: string; number: string; createdAt: number } | undefined
  if (existing) return { created: true as const, duplicate: true, ...existing, documentType: RECEIPT_DOCUMENT_TYPE, draft, validation }
  return db.transaction(() => {
    const sequence = (db.prepare('SELECT COUNT(*) n FROM demo_documents').get() as { n: number }).n + 1
    const id = crypto.randomUUID()
    const number = `ДЕМО-${String(sequence).padStart(8, '0')}`
    const createdAt = Date.now()
    db.prepare('INSERT INTO demo_documents(id,request_id,number,draft_json,created_by,created_at) VALUES (?,?,?,?,?,?)').run(id, requestId, number, JSON.stringify(draft), createdBy, createdAt)
    return { created: true as const, duplicate: false, id, number, createdAt, documentType: RECEIPT_DOCUMENT_TYPE, draft, validation }
  })()
}
