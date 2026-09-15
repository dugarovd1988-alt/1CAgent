import crypto from 'node:crypto'
import { parseReceiptDraft, RECEIPT_DOCUMENT_TYPE, type ReceiptDraft } from '../shared/receipt.js'

type Token = { value: string; expiresAt: number }
let cached: Token | null = null

function networkError(prefix: string, error: unknown): Error {
  if (error instanceof Error && error.name === 'TimeoutError') return new Error(`${prefix}: превышено время ожидания`)
  const code = error && typeof error === 'object' && 'cause' in error && error.cause && typeof error.cause === 'object' && 'code' in error.cause
    ? String(error.cause.code)
    : ''
  const safeCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'])
  return new Error(`${prefix}: сетевая ошибка${safeCodes.has(code) ? ` (${code})` : ''}`)
}

export const aiSystemPrompt = `Ты помощник бухгалтера 1С ERP. Извлеки из текста данные только для документа «${RECEIPT_DOCUMENT_TYPE}». Не придумывай отсутствующие значения: используй null и перечисляй проблемы в missingFields и uncertainties. Дату верни как YYYY-MM-DD, суммы — числами.`

const receiptSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    documentType: { type: 'string', enum: [RECEIPT_DOCUMENT_TYPE] },
    counterparty: { type: 'object', additionalProperties: false, properties: { name: { type: ['string', 'null'] }, inn: { type: ['string', 'null'] }, kpp: { type: ['string', 'null'] } }, required: ['name', 'inn', 'kpp'] },
    date: { type: ['string', 'null'] },
    items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, quantity: { type: ['number', 'null'] }, price: { type: ['number', 'null'] }, amount: { type: ['number', 'null'] } }, required: ['name', 'quantity', 'price', 'amount'] } },
    totalAmount: { type: ['number', 'null'] }, currency: { type: ['string', 'null'], enum: ['RUB', null] },
    uncertainties: { type: 'array', items: { type: 'string' } }, missingFields: { type: 'array', items: { type: 'string' } },
  },
  required: ['documentType', 'counterparty', 'date', 'items', 'totalAmount', 'currency', 'uncertainties', 'missingFields'],
} as const

async function getToken(): Promise<string> {
  const credentials = process.env.GIGACHAT_CREDENTIALS
  if (!credentials) throw new Error('Не задан GIGACHAT_CREDENTIALS')
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value
  const oauthBase = process.env.GIGACHAT_OAUTH_URL || 'https://ngw.devices.sberbank.ru:9443'
  let response: Response
  try { response = await fetch(`${oauthBase}/api/v2/oauth`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'Accept-Encoding': 'identity', RqUID: crypto.randomUUID() },
    body: `scope=${encodeURIComponent(process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS')}`,
    signal: AbortSignal.timeout(Number(process.env.GIGACHAT_TIMEOUT_MS || 30_000)),
  }) } catch (error) { throw networkError('GigaChat OAuth', error) }
  if (!response.ok) throw new Error(response.status === 401 ? 'GigaChat OAuth: ключ авторизации отклонён' : `GigaChat OAuth: HTTP ${response.status}`)
  const data = await response.json() as { access_token?: string; expires_at?: number }
  if (!data.access_token) throw new Error('GigaChat не вернул access token')
  cached = { value: data.access_token, expiresAt: (data.expires_at || Math.floor(Date.now() / 1000) + 1800) * 1000 }
  return data.access_token
}

export async function analyzeWithGigaChat(text: string): Promise<ReceiptDraft> {
  const base = process.env.GIGACHAT_BASE_URL || 'https://api.giga.chat'
  let response: Response
  try { response = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'identity' },
    body: JSON.stringify({ model: process.env.GIGACHAT_MODEL || 'GigaChat-2-Pro', temperature: 0, messages: [{ role: 'system', content: aiSystemPrompt }, { role: 'user', content: text }], response_format: { type: 'json_schema', schema: receiptSchema, strict: true } }),
    signal: AbortSignal.timeout(Number(process.env.GIGACHAT_TIMEOUT_MS || 30_000)),
  }) } catch (error) { throw networkError('GigaChat', error) }
  if (!response.ok) throw new Error(response.status === 429 ? 'GigaChat: превышен лимит запросов' : response.status === 401 ? 'GigaChat: access token отклонён' : `GigaChat: HTTP ${response.status}`)
  const data = await response.json() as any
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('GigaChat вернул пустой ответ')
  return parseGigaChatContent(content)
}

export function parseGigaChatContent(content: unknown): ReceiptDraft {
  let parsed: unknown
  try { parsed = JSON.parse(String(content).replace(/^```json\s*|\s*```$/g, '').trim()) } catch { throw new Error('GigaChat вернул некорректный JSON') }
  return parseReceiptDraft(parsed)
}
