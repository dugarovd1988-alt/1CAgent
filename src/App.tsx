import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ScrollText, Sparkles, LogOut } from 'lucide-react'
import NewRequestForm from './components/NewRequestForm'
import RequestDocument from './components/RequestDocument'
import Journal from './components/Journal'
import AdminPanel from './components/AdminPanel'
import {
  CURRENT_USER,
  formatRequestNumber,
  initialsOf,
  loadEntries,
  nextNumber,
  newId,
  type Comment,
  type JournalEntry,
  type LogEntry,
  type Requester,
} from './lib/journal'
import { api } from './lib/api'

type Tab = 'new' | 'journal'

export default function App() {
  const [user, setUser] = useState<{id:string;email:string;name:string;role:string}|null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [tab, setTab] = useState<Tab>('journal')
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [processing, setProcessing] = useState(false)
  const [nextReqNumber, setNextReqNumber] = useState(1)
  const entriesRef = useRef<JournalEntry[]>([])

  useEffect(() => { api.auth.me().then(x=>setUser(x.user as any)).catch(()=>{}).finally(()=>setAuthLoading(false)) }, [])
  useEffect(() => { if(!user)return; api.journal.list().then(x=>{const e=x.entries as JournalEntry[];setEntries(e);entriesRef.current=e;setNextReqNumber(nextNumber(e))}) }, [user])

  const persist = async (next: JournalEntry[]) => {
    const previous = entriesRef.current
    entriesRef.current = next
    setEntries(next)
    setNextReqNumber(nextNumber(next))
    const changed = next.find(e=>!previous.some(p=>p.id===e.id))
    const updated = next.find(e=>previous.find(p=>p.id===e.id&&JSON.stringify(p)!==JSON.stringify(e)))
    const response = changed
      ? await api.journal.create(changed)
      : updated ? await api.journal.update(updated.id, updated) : null
    if (response === null) return
  }

  const openEntry = entries.find((e) => e.id === openId) ?? null

  /* ---------- Обработка ---------- */

  const processNew = async () => {
    if (!text.trim() || processing) return
    setProcessing(true)
    try {
      const result = await api.documents.preview(text) as any
      const number = nextNumber(entriesRef.current)
      const issues: string[] = result.validation.errors
      const now = Date.now()
      const entry: JournalEntry = { id:newId(), number, createdAt:now, status:issues.length?'error':'success', stage:issues.length?'requires_clarification':'ready_to_create', user:user?.name||CURRENT_USER.name, source:text, draft:result.draft, validation:result.validation, docType:result.draft.documentType, counterparty:result.validation.counterparty?.name || result.draft.counterparty.name || undefined, amount:result.draft.totalAmount ? `${result.draft.totalAmount.toLocaleString('ru-RU')} руб.` : undefined, issues, logs:[{time:now,text:`Запрос ${formatRequestNumber(number)} зарегистрирован`},{time:now,text:'Реквизиты извлечены через GigaChat'},{time:now,text:issues.length?'Черновик требует уточнения данных':'Черновик проверен и готов к подтверждению'}]}
      await persist([entry, ...entriesRef.current])
      setText(entry.source)
      setProcessing(false)
      setOpenId(entry.id)
      setTab('journal')
    } catch(e) { setProcessing(false); window.alert(e instanceof Error ? e.message : 'Ошибка обработки') }
  }

  const reprocessOpen = () => {
    if (!openEntry || !text.trim() || processing) return
    setProcessing(true)
    void api.documents.preview(text).then(async (r)=>{const x=r as any;const issues:string[]=x.validation.errors;const updated:JournalEntry={...openEntry,source:text,draft:x.draft,validation:x.validation,status:issues.length?'error':'success',stage:issues.length?'requires_clarification':'ready_to_create',docNumber:undefined,demoDocumentId:undefined,issues,counterparty:x.validation.counterparty?.name||x.draft.counterparty.name||undefined,amount:x.draft.totalAmount?`${x.draft.totalAmount.toLocaleString('ru-RU')} руб.`:undefined,updatedAt:Date.now(),logs:[...openEntry.logs,{time:Date.now(),text:issues.length?'Повторная проверка: нужны уточнения':'Повторная проверка: черновик готов к подтверждению'}]};await persist(entriesRef.current.map(e=>e.id===updated.id?updated:e));setProcessing(false)}).catch(e=>{window.alert(e instanceof Error?e.message:'Ошибка обработки');setProcessing(false)})
  }

  /* ---------- Действия с запросом ---------- */

  const handleClarified = (requester: Requester) => {
    if (!openEntry) return
    const now = Date.now()
    const newLogs: LogEntry[] = [
      { time: now - 900, text: `Сформировано письмо заявителю: ${requester.name} (${requester.email})` },
      { time: now - 400, text: 'Письмо отправлено через почтовый сервер' },
      { time: now, text: 'Статус изменён: «На уточнении у заявителя»' },
    ]
    const updated: JournalEntry = {
      ...openEntry,
      status: 'clarification',
      stage: 'requires_clarification',
      requester,
      updatedAt: now,
      logs: [...openEntry.logs, ...newLogs],
    }
    void persist(entriesRef.current.map((e) => (e.id === updated.id ? updated : e)))
  }

  const handleDelete = (id: string) => {
    void api.journal.remove(id); void persist(entriesRef.current.filter((e) => e.id !== id))
    if (openId === id) setOpenId(null)
  }

  const createOpen = async () => {
    if (!openEntry?.draft || openEntry.docNumber || openEntry.stage !== 'ready_to_create') return
    try {
      const x = await api.documents.create(openEntry.id, openEntry.draft) as any
      const updated:JournalEntry={...openEntry,status:'success',stage:'created',docNumber:x.docNumber,demoDocumentId:x.id,updatedAt:Date.now(),logs:[...openEntry.logs,{time:Date.now(),text:`Демо-документ «Поступление товаров и услуг» создан, номер ${x.docNumber}`}]}
      await persist(entriesRef.current.map(e=>e.id===updated.id?updated:e))
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Ошибка создания документа') }
  }

  const handleAddComment = (commentText: string) => {
    if (!openEntry) return
    const now = Date.now()
    const comment: Comment = {
      id: newId(),
      author: CURRENT_USER.name,
      text: commentText,
      time: now,
    }
    const updated: JournalEntry = {
      ...openEntry,
      comments: [...(openEntry.comments ?? []), comment],
      updatedAt: now,
    }
    void persist(entriesRef.current.map((e) => (e.id === updated.id ? updated : e)))
  }

  const handleCreateNew = () => {
    setOpenId(null)
    setText('')
    setTab('new')
  }

  /* ---------- Рендер ---------- */

  const goJournal = () => {
    setAdminOpen(false)
    setOpenId(null)
    setTab('journal')
  }

  if(authLoading)return <div className="flex min-h-screen items-center justify-center text-slate-500">Загрузка…</div>
  if(!user)return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><form onSubmit={async e=>{e.preventDefault();setAuthError('');try{const x=await api.auth.login(loginEmail,loginPassword);setUser(x.user as any)}catch(e){setAuthError(e instanceof Error?e.message:'Ошибка входа')}}} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><div className="mb-6 text-center"><Sparkles className="mx-auto mb-3 h-8 w-8 text-blue-600"/><h1 className="text-xl font-semibold">Вход в AI-Ассистент 1С</h1><p className="mt-1 text-sm text-slate-500">Введите данные сотрудника</p></div>{authError&&<p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{authError}</p>}<input required type="email" placeholder="Email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2.5"/><input required type="password" placeholder="Пароль" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} className="mb-5 w-full rounded-lg border border-slate-200 px-3 py-2.5"/><button className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700">Войти</button></form></div>
  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 antialiased"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Шапка */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">AI-Ассистент для 1С ERP</h1>
              <p className="text-xs text-slate-500">
                Извлечение данных из писем и создание документов
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex rounded-lg bg-slate-100 p-1">
              <button
                onClick={goJournal}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  tab === 'journal' && !openEntry && !adminOpen
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'
                }`}
              >
                <ScrollText className="h-4 w-4" />
                Журнал
                {entries.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                      tab === 'journal' && !openEntry && !adminOpen
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-white text-slate-500'
                    }`}
                  >
                    {entries.length}
                  </span>
                )}
              </button>
              {user.role === 'admin' && <button onClick={()=>{setAdminOpen(true);setOpenId(null)}} className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${adminOpen ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'}`}>Пользователи</button>}
            </nav>
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 lg:inline">
              Демо-адаптер 1С
            </span>
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {initialsOf(user.name)}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium leading-tight">{user.name}</p>
                <p className="text-xs text-slate-500">{user.role === 'admin' ? 'Администратор' : 'Бухгалтер'}</p>
              </div>
              <button title="Выйти" onClick={()=>{void api.auth.logout().catch(()=>{});setUser(null)}} className="ml-2 text-slate-400 hover:text-slate-700"><LogOut className="h-4 w-4"/></button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {adminOpen && user.role === 'admin' ? <AdminPanel /> : <>
        {/* Открытая карточка запроса */}
        {tab === 'journal' && openEntry ? (
          <>
            {processing && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Обрабатываю запрос — данные сверяются со справочниками 1С…
              </div>
            )}
            <RequestDocument
              entry={openEntry}
              text={text}
              onTextChange={setText}
              processing={processing}
              onReprocess={reprocessOpen}
              onClarified={handleClarified}
              onAddComment={handleAddComment}
              onBack={goJournal}
              onDelete={handleDelete}
              onCreate={createOpen}
            />
          </>
        ) : tab === 'journal' ? (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Нажмите на запрос, чтобы открыть карточку и продолжить работу с ним. Создать новый —
              кнопка «+» в шапке журнала.
            </p>
            <Journal
              entries={entries}
              onOpen={(entry) => {
                setText(entry.source)
                setOpenId(entry.id)
              }}
              onDelete={handleDelete}
              onCreateNew={handleCreateNew}
            />
          </>
        ) : (
          <>
            <button
              onClick={goJournal}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              К журналу
            </button>
            {processing && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Обрабатываю запрос — после завершения он появится в журнале…
              </div>
            )}
            <NewRequestForm
              requestNumber={nextReqNumber}
              text={text}
              onTextChange={setText}
              processing={processing}
              onProcess={processNew}
            />
          </>
        )}</>}
      </main>
    </div>
  )
}
