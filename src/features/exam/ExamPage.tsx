import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleCheck, CircleX, ClipboardCheck, Flag, Layers3, Timer } from 'lucide-react'
import { motion } from 'motion/react'
import { BackLink, Button, Dialog, Illustration, PageTitle, RuleLinks, Track, clockText, durationText } from '../../components/ui'
import { Option, QuestionMap, ResultNumbers, useClock, useQuestionKeys } from '../../components/session'
import { examSource } from '../../domain/reference'
import { examItems, examRemaining, examSummary } from '../../domain/exam'
import type { ExamReason, ExamState } from '../../domain/exam'
import type { Bank, Question } from '../../domain/bank'

type Props = {
  bank: Bank; state?: ExamState; loaded: boolean; officialAvailable: boolean
  onStart: (kind: Bank['kind']) => void; onMove: (id: string) => void; onAnswer: (id: string, option: number, ms: number) => Promise<void>
  onQuit: () => void
}
const reasons: Record<ExamReason, string> = {
  'same-block': 'Две ошибки в одном тематическом блоке.',
  'three-errors': 'Три ошибки в основной части.',
  'extra-error': 'Ошибка в дополнительном блоке.',
  time: 'Отведённое время истекло.',
  quit: 'Экзамен завершён досрочно.',
}

function Intro({ bank, loaded, officialAvailable, onStart }: Pick<Props, 'bank' | 'loaded' | 'officialAvailable' | 'onStart'>) {
  const details = [
    { icon: ClipboardCheck, label: '20 вопросов', text: 'Четыре блока по пять вопросов.' },
    { icon: Timer, label: '20 минут', text: 'Таймер продолжает идти при перезагрузке.' },
    { icon: Layers3, label: 'До двух дополнительных блоков', text: 'По пять вопросов и пять минут за каждую допустимую ошибку.' },
  ]
  return <div className="screen-stack">
    <PageTitle title="Экзамен" description="Проверь себя в условиях теоретического экзамена." />
    {officialAvailable && <nav className="toolbar bank-picker" aria-label="Комплект экзамена">
      <a className="button button--secondary" href="#/ekzamen" aria-current={bank.kind === 'official' ? 'page' : undefined}>Экзамен ABM</a>
      <a className="button button--secondary" href="#/ekzamen?komplekt=uchebny" aria-current={bank.kind === 'practice' ? 'page' : undefined}>Учебный экзамен</a>
    </nav>}
    <section className="panel exam-intro">
      <div className="icon-box icon-box--amber"><ClipboardCheck size={25} /></div>
      <div><h2>{bank.kind === 'official' ? 'Экзамен ABM' : 'Учебный экзамен'}</h2><p>{bank.kind === 'official' ? 'Вопросы из подключённого официального комплекта.' : 'Авторские вопросы по формату экзамена ГИБДД.'}</p></div>
      <div className="exam-features">{details.map(({ icon: Icon, label, text }) => <div key={label}><Icon size={21} /><strong>{label}</strong><span>{text}</span></div>)}</div>
      <p className="exam-instructions">Подтверждённые ответы сохраняются сразу. Пропуски по истечении времени считаются ошибками. Разбор откроется после результата.</p>
      <div className="inline-actions"><Button variant="primary" onClick={() => onStart(bank.kind)} disabled={!loaded}>Начать экзамен <ArrowRight size={18} /></Button><a href={examSource} target="_blank" rel="noreferrer" className="text-link"><BookOpen size={16} /> Регламент МВД</a></div>
    </section>
  </div>
}

function ExamQuestion({ question, current, total, state, onAnswer }: { question: Question; current: number; total: number; state: ExamState; onAnswer: Props['onAnswer'] }) {
  const [picked, setPicked] = useState<number>()
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const start = useRef(Date.now())
  const saved = state.answers[question.id]
  const choose = (index: number) => { if (!saved && !locked.current && question.options[index]) setPicked(index) }
  useQuestionKeys(choose)

  async function confirm() {
    if (picked === undefined || locked.current || saved) return
    locked.current = true
    setBusy(true)
    try { await onAnswer(question.id, picked, Date.now() - start.current) }
    finally { locked.current = false; setBusy(false) }
  }

  return <motion.section className="panel question-panel exam-question" initial={{ opacity: .78 }} animate={{ opacity: 1 }} transition={{ duration: .16 }}>
    <div className="question-head"><span>Вопрос {current + 1} из {total}</span><span>{state.phase === 'main' ? 'Блок ' + (Math.floor(current / 5) + 1) : 'Дополнительный этап'}</span></div>
    <div className="question-content">
      <h2>{question.text}</h2>
      {question.image && <Illustration src={question.image} />}
      <div className="answer-list">{question.options.map((option, i) => <Option key={i} index={i} onClick={() => choose(i)}
        disabled={Boolean(saved) || busy} status={(saved?.option ?? picked) === i ? 'selected' : undefined} exam>{option}</Option>)}</div>
    </div>
    <div className="session-actions exam-confirm">{saved ? <p className="saved-choice"><Check size={17} /> Ответ принят</p> :
      <Button variant="primary" disabled={picked === undefined || busy} onClick={() => void confirm()}>Подтвердить ответ <ArrowRight size={17} /></Button>}</div>
  </motion.section>
}

function Result({ state, onStart, officialAvailable, loaded }: Pick<Props, 'onStart' | 'officialAvailable' | 'loaded'> & { state: ExamState }) {
  const result = examSummary(state)
  const passed = state.outcome === 'passed'
  const Icon = passed ? CircleCheck : CircleX
  const canRepeat = state.kind === 'practice' || officialAvailable
  return <div className="screen-stack result-wrap">
    <BackLink href="#/progress">Прогресс</BackLink>
    <section className="panel result-panel">
      <span className={'result-icon ' + (passed ? 'positive' : 'negative')}><Icon size={36} /></span>
      <p className="data-label">{state.kind === 'practice' ? 'Учебный экзамен' : 'Экзамен ABM'}</p>
      <h1 className={passed ? 'positive' : 'negative'}>{passed ? 'СДАЛ' : 'НЕ СДАЛ'}</h1>
      <p>{passed ? 'Задания экзамена выполнены.' : reasons[state.reason ?? 'time']}</p>
      <ResultNumbers values={[
        { label: 'Верно', value: result.correct, tone: 'positive' },
        { label: 'Ошибки', value: result.mistakes },
        { label: 'Доп. вопросы', value: result.extraCount },
        { label: 'Время', value: durationText(result.duration) },
      ]} />
      {result.unanswered > 0 && <p>Без ответа: {result.unanswered}</p>}
      {!canRepeat && <p>{loaded ? 'Для повторения нужен подключённый комплект ABM.' : 'Проверяем официальный комплект…'}</p>}
      <div className="inline-actions result-actions">
        {canRepeat && <Button variant="primary" onClick={() => onStart(state.kind)}>Повторить экзамен <ArrowRight size={17} /></Button>}
        {loaded && state.kind === 'official' && <Button onClick={() => onStart('practice')}>Учебный экзамен</Button>}
        {state.kind === 'practice' && officialAvailable && <Button onClick={() => onStart('official')}>Экзамен ABM</Button>}
        <a className="button button--secondary" href={state.kind === 'practice' ? '#/oshibki?komplekt=uchebny' : '#/oshibki'}>Работа над ошибками</a>
      </div>
    </section>
    {result.wrong.length > 0 && <section className="panel exam-review">
      <h2>Разбор ошибок</h2>
      {result.wrong.map(item => <details key={item.id}>
        <summary>{item.text}</summary>
        <div className="exam-review-body">
          {item.image && <Illustration src={item.image} />}
          <p>Твой ответ · {state.answers[item.id] ? item.options[state.answers[item.id].option] : 'Пропущен'}</p>
          <p className="positive">Верно · {item.options[item.correct]}</p>
          {item.explanation && <p>{item.explanation}</p>}<RuleLinks rules={item.rules} />
        </div>
      </details>)}
    </section>}
  </div>
}

export default function ExamPage({ bank, state, loaded, officialAvailable, onStart, onMove, onAnswer, onQuit }: Props) {
  const [quit, setQuit] = useState(false)
  const active = Boolean(state && state.phase !== 'done')
  const now = useClock(active)
  const questionId = active ? state?.currentId : undefined
  useEffect(() => {
    if (questionId) window.scrollTo(0, 0)
  }, [questionId])
  if (!state) return <Intro bank={bank} loaded={loaded} officialAvailable={officialAvailable} onStart={onStart} />
  if (state.phase === 'done') return <Result state={state} onStart={onStart} officialAvailable={officialAvailable} loaded={loaded} />
  const items = examItems(state)
  const index = Math.max(0, items.findIndex(item => item.id === state.currentId))
  const count = items.filter(item => state.answers[item.id]).length
  const remaining = examRemaining(state, now)

  return <div className="screen-stack">
    <div className="session-heading">
      <div><span className="data-label">{state.kind === 'official' ? 'Официальный комплект ABM' : 'Авторская практика'}</span><h1>{state.phase === 'extra' ? 'Дополнительные вопросы' : 'Экзамен'}</h1></div>
      <div className={'timer-pill' + (remaining < 60_000 ? ' timer-pill--urgent' : '')}><Timer size={19} /><span data-testid="exam-timer" aria-label="Осталось времени">{clockText(remaining)}</span></div>
    </div>
    {state.phase === 'extra' && <p className="notice">Для сдачи ответь верно на все {items.length} дополнительных вопросов.</p>}
    <div className="study-layout">
      <ExamQuestion key={items[index].id} question={items[index]} state={state} current={index} total={items.length} onAnswer={onAnswer} />
      <div className="session-rail">
        <QuestionMap items={items} current={index} onMove={i => onMove(items[i].id)} answerState={item => state.answers[item.id] ? 'answered' : ''} />
        <div className="panel exam-stage"><span>Отвечено {count} из {items.length}</span><Track value={100 * count / items.length} /></div>
        <Button variant="quiet" className="session-stop" onClick={() => setQuit(true)}><Flag size={17} /> Завершить экзамен</Button>
      </div>
    </div>
    {quit && <Dialog label="Завершить экзамен" onClose={() => setQuit(false)}>
      <p>Досрочное завершение даст результат «НЕ СДАЛ».</p>
      <div className="inline-actions"><Button onClick={() => setQuit(false)}><ArrowLeft size={17} /> Продолжить</Button><Button variant="primary" onClick={() => { setQuit(false); onQuit() }}>Завершить</Button></div>
    </Dialog>}
  </div>
}
