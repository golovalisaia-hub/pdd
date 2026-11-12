import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Database, Download, FileJson, HardDrive, ShieldCheck, Smartphone, Upload, WifiOff } from 'lucide-react'
import { Button, PageTitle } from '../../components/ui'
import type { OfficialBank } from '../../domain/bank'
import { db } from '../../domain/storage'
import { exportProgress, importProgress } from '../../domain/backup'

export type BankStatus = 'loading' | 'missing' | 'invalid' | 'ready'

export default function SettingsPage({ official, bankStatus }: { official?: OfficialBank; bankStatus: BankStatus }) {
  const upload = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  useEffect(() => {
    let mounted = true
    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(() => { if (mounted) setReady(true) })
    return () => { mounted = false }
  }, [])

  async function saveCopy() {
    setBusy(true)
    try {
      const content = await exportProgress(db)
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'pdd-progress-' + new Date().toISOString().slice(0, 10) + '.json'
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage({ ok: true, text: 'Резервная копия подготовлена.' })
    } catch { setMessage({ ok: false, text: 'Не удалось подготовить резервную копию.' }) }
    finally { setBusy(false) }
  }

  async function loadCopy(file: File) {
    setBusy(true)
    try {
      if (file.size > 25_000_000) throw new Error('Файл резервной копии превышает 25 МБ.')
      const text = await file.text()
      await importProgress(db, text)
      setMessage({ ok: true, text: 'Прогресс объединён с данными на этом устройстве.' })
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error && /[а-яё]/i.test(error.message) ? error.message : 'Не удалось прочитать резервную копию.' })
    } finally { setBusy(false) }
  }

  return <div className="screen-stack">
    <PageTitle title="Настройки" description="Материалы, резервная копия и работа без сети." />
    <div className="settings-grid">
      <section className="panel settings-card">
        <span className="icon-box icon-box--amber"><Database size={22} /></span>
        <h2>Комплект ABM</h2>
        {official ? <>
          <p>Проверено {official.questions.length} позиций · сверено {official.provenance.checkedAt}</p>
          {official.provenance.editionDate && <p>Дата редакции {official.provenance.editionDate}</p>}
          <p>Издатель: {official.provenance.publisher}. Версия: {official.version}.</p>
          <a href={official.source} className="text-link" target="_blank" rel="noreferrer">Источник комплекта <ArrowUpRight size={16} /></a>
        </> : <>
          <p>{bankStatus === 'loading' ? 'Проверяем локальный комплект.' : bankStatus === 'invalid' ? 'Файлы комплекта не прошли проверку.' : 'Официальный комплект пока не подключён. Доступны 40 авторских вопросов.'}</p>
          <details><summary>Как подключить комплект</summary><div className="settings-detail">
            <p>Нужны разрешённый комплект на 800 позиций, изображения и ключ для сверки. Формат файлов описан в документации проекта.</p>
            <code>npm run import:abm -- --input … --answers … --assets …</code>
          </div></details>
        </>}
      </section>
      <section className="panel settings-card">
        <span className="icon-box icon-box--lilac"><FileJson size={22} /></span>
        <h2>Резервная копия</h2>
        <p>Сохрани историю ответов, результаты и закладки в JSON, чтобы перенести их на другое устройство.</p>
        <div className="inline-actions">
          <Button onClick={() => void saveCopy()} disabled={busy}><Download size={17} /> Экспорт</Button>
          <Button onClick={() => upload.current?.click()} disabled={busy}><Upload size={17} /> Импорт</Button>
          <input ref={upload} type="file" accept=".json,application/json" hidden onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void loadCopy(file)
          }} />
        </div>
        {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'positive' : 'negative'}>{message.text}</p>}
      </section>
      <section className="panel settings-card">
        <span className="icon-box"><WifiOff size={22} /></span>
        <h2>Работа без сети</h2>
        <p>{ready ? 'Кэш готов. Можно открыть приложение без подключения к сети.' : 'Открой сборку PDD по HTTPS или на localhost. При первом запуске дождись загрузки материалов.'}</p>
        <div className="device-note"><Smartphone size={19} /><span>В Safari открой «Поделиться» и выбери «На экран „Домой“».</span></div>
      </section>
      <section className="panel settings-card">
        <span className="icon-box"><ShieldCheck size={22} /></span>
        <h2>Данные на устройстве</h2>
        <p>PDD хранит историю в браузере. При смене браузера или устройства можно перенести её через резервную копию.</p>
        <div className="device-note"><HardDrive size={18} /><span>Очистка данных сайта удалит локальную историю.</span></div>
      </section>
    </div>
  </div>
}
