import { useState } from 'react'
import { ArrowRight, BookOpen, Bookmark, ChevronRight, History, Layers3 } from 'lucide-react'
import { Button, Empty, PageTitle, Track, shortDate } from '../../components/ui'
import type { Bank, Question } from '../../domain/bank'
import { questionStats } from '../../domain/learning'
import type { Progress } from '../../domain/storage'

export type CollectionMode = 'errors' | 'favorites' | 'topics'
const titles = { errors: 'Работа над ошибками', favorites: 'Избранное', topics: 'Темы' }
const descriptions = {
  errors: 'Повторяй вопросы, которые потребовали больше внимания.',
  favorites: 'Возвращайся к вопросам, которые сохранил.',
  topics: 'Выбирай правило или дорожную ситуацию и тренируйся.',
}

export default function CollectionsPage({ mode, bank, progress, selectedTopic, onStart }: {
  mode: CollectionMode; bank: Bank; progress: Progress; selectedTopic?: string | null; onStart: (questions: Question[], label: string) => void
}) {
  const [topic, setTopic] = useState(selectedTopic ?? '')
  const [ticket, setTicket] = useState('')
  const [difficulty, setDifficulty] = useState('all')
  const stats = questionStats(progress.attempts)
  const favorites = new Set(progress.favorites.filter(item => item.active).map(item => item.questionId))
  const now = Date.now()
  const questions = bank.questions.filter(item => mode === 'errors' ? (stats.get(item.id)?.wrong ?? 0) > 0 : mode === 'favorites' ? favorites.has(item.id) : true)
  const topics = [...new Set(questions.map(item => item.topic))].sort((a, b) => a.localeCompare(b, 'ru'))
  const visible = questions.filter(item => (!topic || item.topic === topic) && (!ticket || item.ticket === Number(ticket)) &&
    (difficulty === 'all' || (difficulty === 'frequent' ? (stats.get(item.id)?.wrong ?? 0) >= 2 : (stats.get(item.id)?.dueAt ?? Infinity) <= now)))
    .sort((a, b) => (stats.get(b.id)?.wrong ?? 0) - (stats.get(a.id)?.wrong ?? 0))
  return <div className="screen-stack">
    <PageTitle title={titles[mode]} description={descriptions[mode]} />
    <span className="data-label">{bank.kind === 'official' ? 'Официальные вопросы ABM' : 'Авторские учебные вопросы'}</span>
    {mode === 'topics' && !topic ? <div className="topic-grid">{topics.map(name => {
      const items = questions.filter(item => item.topic === name)
      const covered = items.filter(item => stats.has(item.id)).length
      return <button type="button" className="panel topic-card" key={name} onClick={() => setTopic(name)}>
        <span className="topic-card-head"><span className="icon-box"><Layers3 size={18} /></span><ChevronRight size={18} /></span>
        <h2>{name}</h2><span>Изучено {covered} из {items.length}</span><Track value={100 * covered / items.length} />
      </button>
    })}</div> : <>
      {questions.length > 0 && <div className="toolbar">
        <label className="select-field"><span>Тема</span><select value={topic} onChange={event => setTopic(event.target.value)}><option value="">Все темы</option>{topics.map(name => <option key={name}>{name}</option>)}</select></label>
        {mode !== 'topics' && <label className="select-field"><span>Билет</span><select value={ticket} onChange={event => setTicket(event.target.value)}><option value="">Все билеты</option>{[...new Set(questions.map(item => item.ticket))].sort((a, b) => a - b).map(number => <option key={number} value={number}>Билет {number}</option>)}</select></label>}
        {mode === 'errors' && <label className="select-field"><span>Повторение</span><select value={difficulty} onChange={event => setDifficulty(event.target.value)}><option value="all">Все ошибки</option><option value="due">Пора повторить</option><option value="frequent">Частые ошибки</option></select></label>}
        <Button variant="primary" disabled={!visible.length} onClick={() => onStart(visible, topic || titles[mode])}>{mode === 'errors' ? 'Повторить ошибки' : 'Начать тренировку'} <ArrowRight size={17} /></Button>
      </div>}
      {visible.length ? <div className="panel collection-list">{visible.map(question => {
        const stat = stats.get(question.id)
        return <button type="button" className="collection-row" key={question.id} onClick={() => onStart([question], titles[mode])}>
          <span className="icon-box">{mode === 'favorites' ? <Bookmark size={17} /> : <BookOpen size={17} />}</span>
          <span><strong>{question.text}</strong><small>Билет {question.ticket} · Вопрос {question.position}{stat && ' · Ошибки: ' + stat.wrong + ' · ' + shortDate(stat.lastAt)}</small></span>
          <ChevronRight size={18} />
        </button>
      })}</div> : <Empty icon={mode === 'favorites' ? Bookmark : History}
        title={questions.length ? 'Нет вопросов по этим фильтрам' : mode === 'favorites' ? 'Пока без закладок' : 'Ошибок пока нет'}
        text={questions.length ? 'Выбери другую тему или билет.' : mode === 'favorites' ? 'Нажми на значок закладки в вопросе, чтобы сохранить его здесь.' : 'Ответы с ошибками появятся здесь после занятия или экзамена.'}>
        <a href="#/bilety" className="button button--secondary">К билетам <ArrowRight size={16} /></a>
      </Empty>}
    </>}
  </div>
}
