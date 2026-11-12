import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X } from 'lucide-react'
import { Button, Empty } from '../components/ui'
import { ABM_QUESTION_COUNT, abmQuestionId } from '../domain/abm-positions'
import type { Bank, OfficialBank, Question } from '../domain/bank'
import { practiceBank } from '../domain/practice-bank'
import { answerExam, createExam, examItems, expireExam, quitExam } from '../domain/exam'
import { choosePractice, createStudy, learningSummary } from '../domain/learning'
import type { StudyMode } from '../domain/learning'
import { beginStudy, db, emptyProgress, finishStudy, moveStudy, readExam, readProgress, readStudy, recordStudy, toggleFavorite, updateExam } from '../domain/storage'
import HomePage from '../features/home/HomePage'
import TicketsPage, { ticketStates } from '../features/tickets/TicketsPage'
import StudyPage from '../features/tickets/StudyPage'
import CollectionsPage from '../features/tickets/CollectionsPage'
import ExamPage from '../features/exam/ExamPage'
import ProgressPage from '../features/progress/ProgressPage'
import type { BankStatus } from '../features/settings/SettingsPage'
import { go, Navigation, useRoute } from './navigation'
import { normalizeRule } from '../domain/reference'
import { publicAssetUrl } from '../publicAssetUrl'

const officialPositions = Array.from({ length: ABM_QUESTION_COUNT }, (_, i) => ({ id: abmQuestionId(Math.floor(i / 20) + 1, i % 20 + 1) }))
const JunctionsPage = lazy(() => import('../features/junctions/JunctionsPage'))
const ReferencePage = lazy(() => import('../features/reference/ReferencePage'))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'))

function useOfficialBank() {
  const [value, setValue] = useState<{ bank?: OfficialBank; status: BankStatus }>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    async function read() {
      try {
        const result = await fetch(publicAssetUrl('bank/abm.json'), { signal: controller.signal })
        if (result.status === 404 || (result.ok && !result.headers.get('content-type')?.includes('json'))) {
          setValue({ status: 'missing' })
          return
        }
        if (!result.ok) { setValue({ status: 'invalid' }); return }
        const [{ parseOfficialBank }, input] = await Promise.all([import('../domain/bank'), result.json()])
        if (!controller.signal.aborted) setValue({ bank: parseOfficialBank(input), status: 'ready' })
      } catch (error) {
        if (!controller.signal.aborted) setValue({ status: error instanceof TypeError ? 'missing' : 'invalid' })
      }
    }
    void read()
    return () => controller.abort()
  }, [])
  return value
}

function Pdd() {
  const route = useRoute()
  const official = useOfficialBank()
  const stored = useLiveQuery(async () => {
    const [progress, study, exam] = await Promise.all([readProgress(db), readStudy(db), readExam(db)])
    return { progress, study, exam }
  }, [])
  const { progress = emptyProgress, study, exam } = stored ?? {}
  const primary = official.bank ?? practiceBank
  const studyBank = study?.kind === 'official' ? official.bank : practiceBank
  const [alert, setAlert] = useState('')
  const favorites = useMemo(() => new Set(progress.favorites.filter(item => item.active).map(item => item.questionId)), [progress.favorites])
  const junctionDone = useMemo(() => new Set(progress.junctions.filter(item => item.correct).map(item => item.scenarioId)), [progress.junctions])
  const { studied, mastered } = useMemo(() => learningSummary(official.bank?.questions ?? officialPositions, progress.attempts), [official.bank, progress.attempts])
  useEffect(() => { window.scrollTo(0, 0) }, [route.key])

  const save = useCallback(async (work: () => Promise<unknown>) => {
    try { await work() }
    catch { setAlert('Не удалось сохранить действие. Проверь свободное место и попробуй ещё раз.') }
  }, [])

  const activeExamDeadline = exam?.phase !== 'done' ? exam?.deadline : undefined
  useEffect(() => {
    if (activeExamDeadline === undefined) return
    const expire = () => void save(() => updateExam(db, current => current && expireExam(current, Date.now())))
    const timeout = window.setTimeout(expire, Math.max(0, activeExamDeadline - Date.now()))
    document.addEventListener('visibilitychange', expire)
    return () => { window.clearTimeout(timeout); document.removeEventListener('visibilitychange', expire) }
  }, [activeExamDeadline, save])

  function start(source: Bank, items: Question[], mode: StudyMode, name: string, ticket?: number) {
    if (!items.length) return
    void save(async () => {
      await beginStudy(db, createStudy(source, items, mode, name, Date.now(), ticket))
      go('trening')
    })
  }

  function startTicket(source: Bank, number: number) {
    if (study?.kind === source.kind && study.version === source.version && study.ticket === number && study.completedAt === undefined) {
      go('trening')
      return
    }
    start(source, source.questions.filter(question => question.ticket === number), 'ticket', (source.kind === 'practice' ? 'Учебный билет ' : 'Билет ') + number, number)
  }

  function startPractice() {
    start(primary, choosePractice(primary.questions, progress.attempts, Date.now()), 'practice', 'Тренировка на 10 минут')
  }

  function resume() {
    if (study && studyBank?.version === study.version && study.completedAt === undefined) { go('trening'); return }
    const next = ticketStates(primary.kind, progress).find(item => item.state === 'working' || item.state === 'new')
    if (next) startTicket(primary, next.number)
    else startPractice()
  }

  function showRule(rule: string) {
    go('spravochnik?pravilo=' + encodeURIComponent(normalizeRule(rule === '3.1' ? 'п. 3.1' : rule)))
  }

  const collectionMode = route.path === 'oshibki' ? 'errors' : route.path === 'izbrannoe' ? 'favorites' : 'topics'

  let screen: ReactNode
  switch (route.path) {
    case 'bilety':
      screen = <TicketsPage official={official.bank} progress={progress} onStart={startTicket} />
      break
    case 'trening': {
      const itemsById = new Map(studyBank?.questions.map(item => [item.id, item]))
      const items = study?.ids.flatMap(id => {
        const item = itemsById.get(id)
        return item ? [item] : []
      }) ?? []
      if (!stored || (study?.kind === 'official' && official.status === 'loading')) {
        screen = <p className="notice" role="status">Загружаем занятие…</p>
      } else if (study && studyBank && items.length === study.ids.length && studyBank.version === study.version) {
        const ticket = study.ticket
        screen = <StudyPage key={study.id} study={study} items={items} favorites={favorites}
          onAnswer={(question, option, ms) => save(() => recordStudy(db, study.id, question, option, Date.now(), ms))}
          onMove={index => void save(() => moveStudy(db, study.id, index))}
          onFinish={() => void save(() => finishStudy(db, study.id, items, Date.now()))}
          onFavorite={id => void save(() => toggleFavorite(db, id))}
          onReview={questions => start(studyBank, questions, 'review', 'Повторение ошибок')}
          onNextTicket={ticket && studyBank.questions.some(question => question.ticket === ticket + 1) ? () => startTicket(studyBank, ticket + 1) : undefined} />
      } else {
        screen = <Empty title="Открой новое занятие" text={study ? 'Для продолжения этой сессии нужен комплект той же версии. Ответы сохранены в истории.' : 'Выбери билет или начни короткую тренировку.'}>
          <a className="button button--primary" href="#/bilety">К билетам</a>
        </Empty>
      }
      break
    }
    case 'ekzamen':
      screen = <ExamPage key={exam?.id ?? 'intro'} bank={primary} state={exam} loaded={Boolean(stored) && official.status !== 'loading'} officialAvailable={Boolean(official.bank)}
        onStart={kind => {
          const source = kind === 'official' ? official.bank : practiceBank
          if (source) void save(() => updateExam(db, current => current && current.phase !== 'done' ? expireExam(current, Date.now()) : createExam(source, crypto.randomUUID(), Date.now())))
        }}
        onMove={id => void save(() => updateExam(db, current => {
          if (!current) return current
          const timed = expireExam(current, Date.now())
          return timed.phase !== 'done' && examItems(timed).some(item => item.id === id) ? { ...timed, currentId: id } : timed
        }, exam?.id))}
        onAnswer={(id, option, ms) => save(() => updateExam(db, current => current && answerExam(current, id, option, Date.now(), ms), exam?.id))}
        onQuit={() => void save(() => updateExam(db, current => current && quitExam(current, Date.now()), exam?.id))} />
      break
    case 'perekrestki':
      screen = <JunctionsPage completedIds={junctionDone} onRule={showRule} onAttempt={(scenarioId, correct) => void save(() => db.junctions.add({ id: crypto.randomUUID(), scenarioId, correct, at: Date.now() }))} />
      break
    case 'progress':
      screen = <ProgressPage progress={progress} bank={primary} studied={studied} mastered={mastered} />
      break
    case 'oshibki':
    case 'izbrannoe':
    case 'temy': {
      const selected = official.bank && route.params.get('komplekt') !== 'uchebny' ? official.bank : practiceBank
      screen = <>
        {official.bank && <div className="toolbar bank-toggle">
          <a className={'data-label ' + (selected.kind === 'official' ? 'data-label--selected' : '')} href={'#/' + route.path}>Комплект ABM</a>
          <a className={'data-label ' + (selected.kind === 'practice' ? 'data-label--selected' : '')} href={'#/' + route.path + '?komplekt=uchebny'}>Учебные вопросы</a>
        </div>}
        <CollectionsPage bank={selected} progress={progress} mode={collectionMode} selectedTopic={route.params.get('tema')}
          onStart={(items, name) => start(selected, items, 'review', name)} />
      </>
      break
    }
    case 'znaki':
    case 'spravochnik':
      screen = <ReferencePage signsOnly={route.path === 'znaki'} code={route.params.get('pravilo')} />
      break
    case 'nastroyki':
      screen = <SettingsPage official={official.bank} bankStatus={official.status} />
      break
    default:
      screen = <HomePage progress={progress} bank={primary} studied={studied} mastered={mastered} ready={Boolean(stored) && official.status !== 'loading'} onContinue={resume} onPractice={startPractice} />
  }

  return <div className="app-shell">
    <Navigation current={route.path} />
    <main className="main-content" id="main-content" tabIndex={-1}>
      <motion.div key={route.key} className="screen" initial={{ opacity: .82, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .21, ease: 'easeOut' }}>
        <Suspense fallback={<p className="notice" role="status">Загружаем раздел…</p>}>{screen}</Suspense>
      </motion.div>
    </main>
    {alert && <div className="toast" role="alert">{alert}<button type="button" className="icon-button" onClick={() => setAlert('')} aria-label="Закрыть сообщение"><X size={18} /></button></div>}
  </div>
}

export default class App extends Component<Record<string, never>, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  render() {
    return this.state.failed ? <main className="fallback-page"><Empty title="Не удалось открыть PDD" text="Проверь, что браузер разрешает хранение данных для этого адреса.">
      <Button variant="primary" onClick={() => location.reload()}>Обновить страницу</Button>
    </Empty></main> : <Pdd />
  }
}
