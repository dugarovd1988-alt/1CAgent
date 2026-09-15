import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { createReceipt, initDirectories, validateDocument } from './oneCAdapter.js'
import { parseGigaChatContent } from './gigachat.js'
import { RECEIPT_DOCUMENT_TYPE, type ReceiptDraft } from '../shared/receipt.js'

function setup() {
  const db = new Database(':memory:')
  initDirectories(db)
  return db
}

function validDraft(): ReceiptDraft {
  return {
    documentType: RECEIPT_DOCUMENT_TYPE,
    counterparty: { name: 'ООО «Ромашка»', inn: '7712345678', kpp: '771201001' },
    date: '2026-09-15',
    items: [{ name: 'Канцелярские наборы', quantity: 2, price: 500, amount: 1000 }],
    totalAmount: 1000,
    currency: 'RUB', uncertainties: [], missingFields: [],
  }
}

test('корректный черновик проходит проверку', () => {
  const db = setup()
  assert.deepEqual(validateDocument(db, validDraft()).validation.errors, [])
  db.close()
})

test('проверяются ИНН, справочники и обязательные поля строки', () => {
  const db = setup()
  const draft = validDraft()
  draft.counterparty.inn = '123'
  draft.items[0] = { name: 'Неизвестный товар', quantity: null, price: 500, amount: null }
  const errors = validateDocument(db, draft).validation.errors.join('\n')
  assert.match(errors, /ИНН должен содержать/)
  assert.match(errors, /Контрагент не найден/)
  assert.match(errors, /номенклатура не найдена/)
  assert.match(errors, /количество должно быть больше нуля/)
  db.close()
})

test('проверяется арифметика строки и итог документа', () => {
  const db = setup()
  const draft = validDraft()
  draft.items[0].amount = 900
  draft.totalAmount = 800
  const errors = validateDocument(db, draft).validation.errors.join('\n')
  assert.match(errors, /количеству × цене/)
  assert.match(errors, /Итоговая сумма не совпадает/)
  db.close()
})

test('создание идемпотентно по идентификатору заявки', () => {
  const db = setup()
  const first = createReceipt(db, 'request-1', validDraft(), 'user-1')
  const second = createReceipt(db, 'request-1', validDraft(), 'user-1')
  assert.equal(first.created, true)
  assert.equal(second.created, true)
  if (first.created && second.created) {
    assert.equal(first.number, second.number)
    assert.equal(second.duplicate, true)
  }
  db.close()
})

test('некорректный JSON GigaChat отклоняется безопасно', () => {
  assert.throws(() => parseGigaChatContent('не json'), /некорректный JSON/)
})
