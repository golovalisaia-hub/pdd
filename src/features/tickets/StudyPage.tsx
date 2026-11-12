import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, CircleCheck, CircleX, Lightbulb, Timer } from 'lucide-react'
import { motion } from 'motion/react'
import { BackLink, Button, Empty, Illustration, RuleLinks, Track, clockText, durationText } from '../../components/ui'
import { Option, QuestionMap, ResultNumbers, useClock, useQuestionKeys } from '../../components/session'
import type { Question } from '../../domain/bank'
import { percent, studyResult } from '../../domain/learning'
import type { Study } from '../../domain/learning'

type Props = {
  study: Study; items: Question[]; favorites: ReadonlySet<string>
  onAnswer: (question: Question, option: number, ms: number) => Promise<void>
  onMove: (index: number) => void; onFinish: () => void; onFavorite: (id: string) => void
  onReview: (items: Question[]) => void; onNextTicket?: () => void
}

function Explanation({ question, correct }: { question: Question; correct: boolean }) {
  const [simple, setSimple] = useState(false)
  const body = simple ? question.simple ?? question.explanation : question.explanation
  const Icon = correct ? CircleCheck : CircleX
  return <motion.section className={'answer-feedback ' + (correct ? 'answer-feedback--right' : 'answer-feedback--wrong')}
    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 250, damping: 26 }}>
    <div role="status"><h3><Icon size={21} />{correct ? 'Верно!' : 'Есть ошибка'}</h3>
      {!correct && <p className="correct-line"><strong>Правильный ответ</strong> {question.options[question.correct]}</p>}
      <p>{body ?? 'Для этого вопроса в комплекте есть проверенный ключ ответа.'}</p>
    </div>
    <RuleLinks rules={question.rules} />
    {question.simple && <Button variant="quiet" onClick={() => setSimple(value => !value)}><Lightbulb size={17} />{simple ? 'Обычное объяснение' : 'Объяснить проще'}</Button>}
  </motion.section>
}

export default function StudyPage(props: Props) {
  const { study, items, favorites, onAnswer, onMove, onFinish, onFavorite, onReview, onNextTicket } = props
  const index = Math.min(study.index, items.length - 1)
  const question = items[index]
  const completed = study.completedAt !== undefined
  const now = useClock(!completed && Boolean(study.deadline))
  const result = studyResult(study, items)
  const allAnswered = result.attempted === items.length
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const current = useRef({ id: question?.id, since: Date.now() })
  useEffect(() => { current.current = { id: question?.id, since: Date.now() } }, [question?.id])
  useEffect(() => {
    if (!completed && study.deadline !== undefined && now >= study.deadline) onFinish()
  }, [now, study.deadline, completed, onFinish])

  async function select(option: number) {
    if (!question || completed || locked.current || study.responses[question.id] || !question.options[option]) return
    locked.current = true
    setBusy(true)
    try { await onAnswer(question, option, Date.now() - current.current.since) }
    finally { locked.current = false; setBusy(false) }
  }

  function move(offset: number) {
    const target = index + offset
    if (target >= 0 && target < items.length && !completed) onMove(target)
  }

  useQuestionKeys(select, () => move(-1), () => move(1))

  if (!question) return <Empty title="Сессия недоступна" text="Откройте билет из установленного комплекта."><a className="button button--primary" href="#/bilety">К билетам</a></Empty>
  if (completed) return <div className="screen-stack result-wrap">
    <BackLink href="#/bilety">Билеты</BackLink>
    <section className="panel result-panel">
      <span className="result-icon"><CircleCheck size={34} /></span>
      <p className="data-label">{study.name}</p>
      <h1>Занятие завершено</h1>
      <p>Отвечено на {result.attempted} из {items.length} вопросов</p>
      <ResultNumbers values={[
        { label: 'Верно', value: result.correct, tone: 'positive' },
        { label: 'Ошибки', value: result.incorrect.length, tone: result.incorrect.length ? 'negative' : '' },
        { label: 'Точность', value: percent(result.correct, result.attempted) + '%' },
        { label: 'Время ответов', value: durationText(result.duration) },
      ]} />
      {result.topics.length > 0 && <div className="result-topics"><h2>Темы для повторения</h2>{result.topics.map(topic => <a className="data-label" key={topic} href={'#/temy?tema=' + encodeURIComponent(topic)}>{topic}</a>)}</div>}
      <div className="inline-actions result-actions">
        {result.incorrect.length > 0 && <Button onClick={() => onReview(result.incorrect)}>Повторить ошибки</Button>}
        {onNextTicket && <Button variant="primary" onClick={onNextTicket}>Следующий билет <ArrowRight size={17} /></Button>}
        {!onNextTicket && <a href="#/bilety" className="button button--primary">К билетам <ArrowRight size={17} /></a>}
      </div>
    </section>
  </div>

  const response = study.responses[question.id]
  const nextUnanswered = items.findIndex(item => !study.responses[item.id])
  return <div className="screen-stack study-page">
    <BackLink href="#/bilety">Билеты</BackLink>
    <div className="session-heading">
      <div><span className="data-label">{study.kind === 'official' ? 'Официальный комплект ABM' : 'Авторская практика'}</span><h1>{study.name}</h1></div>
      {study.deadline && <div className="timer-pill" aria-label="Осталось времени"><Timer size={19} />{clockText(study.deadline - now)}</div>}
    </div>
    <div className="study-layout">
      <section className="panel question-panel">
        <div className="question-head"><span>Вопрос {index + 1} из {items.length}</span>
          <button type="button" aria-label={favorites.has(question.id) ? 'Убрать из избранного' : 'В избранное'}
            aria-pressed={favorites.has(question.id)} className={'icon-button favorite-button' + (favorites.has(question.id) ? ' favorited' : '')}
            onClick={() => onFavorite(question.id)}><Bookmark size={20} /></button>
        </div>
        <Track value={percent(result.attempted, items.length)} />
        <motion.div key={question.id} initial={{ opacity: .78 }} animate={{ opacity: 1 }} transition={{ duration: .16 }} className="question-content">
          <h2>{question.text}</h2>
          {question.image && <Illustration src={question.image} />}
          <div className="answer-list">{question.options.map((option, i) => <Option key={i} index={i}
            onClick={() => void select(i)} disabled={Boolean(response) || busy}
            status={response ? i === question.correct ? 'right' : i === response.option ? 'wrong' : undefined : undefined}>{option}</Option>)}</div>
          {response && <Explanation question={question} correct={response.option === question.correct} />}
        </motion.div>
        <div className="session-actions">
          <Button onClick={() => move(-1)} disabled={index === 0}><ArrowLeft size={18} /> Назад</Button>
          {allAnswered ? <Button variant="primary" onClick={onFinish}>К результату <ArrowRight size={18} /></Button> :
            index < items.length - 1 ? <Button variant="primary" onClick={() => move(1)}>Далее <ArrowRight size={18} /></Button> :
            <Button variant="primary" onClick={() => onMove(nextUnanswered)}>К пропущенным <ArrowRight size={18} /></Button>}
        </div>
      </section>
      <div className="session-rail">
        <QuestionMap items={items} current={index} onMove={onMove} answerState={item => {
          const answer = study.responses[item.id]
          return answer ? answer.option === item.correct ? 'right' : 'wrong' : ''
        }} />
        {study.mode === 'practice' && <Button className="session-stop" onClick={onFinish}>Завершить тренировку</Button>}
      </div>
    </div>
  </div>
}
