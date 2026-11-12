import { ArrowUpRight, BarChart3, BookOpenCheck, CircleCheck, ClipboardCheck, Clock3, Route, Target, TrendingUp } from 'lucide-react'
import { motion } from 'motion/react'
import { PageTitle, ProgressRing, durationText, shortDate } from '../../components/ui'
import { learningSummary, percent, weakTopics } from '../../domain/learning'
import type { Bank } from '../../domain/bank'
import type { Progress } from '../../domain/storage'
import { ticketStates } from '../tickets/TicketsPage'

function WeeklyChart({ progress, bank }: { progress: Progress; bank: Bank }) {
  const valid = new Set(bank.questions.map(item => item.id))
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - 6 + i)
    const next = new Date(start)
    next.setDate(start.getDate() + 1)
    const count = progress.attempts.filter(item => item.at >= start.getTime() && item.at < next.getTime() && valid.has(item.questionId)).length
    return { key: start.toISOString(), name: start.toLocaleDateString('ru', { weekday: 'short' }), count }
  })
  const max = Math.max(1, ...days.map(day => day.count))
  return <section className="panel chart-panel">
    <div className="panel-head"><h2>Активность за неделю</h2><BarChart3 size={20} /></div>
    <p>Ответы по дням · {bank.kind === 'official' ? 'ABM' : 'учебные вопросы'}</p>
    <div className="week-chart">{days.map(day => <div className="week-day" key={day.key} title={day.count + ' ответов'}>
      <strong>{day.count}</strong><div className="bar-track">
        <motion.span initial={{ height: 0 }} animate={{ height: (day.count ? 100 * day.count / max : 0) + '%' }} transition={{ type: 'spring', stiffness: 120, damping: 21 }} />
      </div><span>{day.name}</span>
    </div>)}</div>
  </section>
}

export default function ProgressPage({ progress, bank, studied, mastered }: { progress: Progress; bank: Bank; studied: number; mastered: number }) {
  const summary = learningSummary(bank.questions, progress.attempts)
  const coverage = percent(studied, 800)
  const tickets = ticketStates('official', progress)
  const completed = tickets.filter(item => item.state === 'done' || item.state === 'mastered').length
  const exams = progress.exams.filter(item => item.kind === bank.kind)
  const passes = exams.filter(item => item.passed).length
  const average = exams.length ? durationText(exams.reduce((sum, item) => sum + item.duration, 0) / exams.length) : '—'
  const junctionCorrect = new Set(progress.junctions.filter(item => item.correct).map(item => item.scenarioId)).size
  const topics = weakTopics(bank.questions, progress.attempts).slice(0, 5)
  const metrics = [
    { name: 'Точность ответов', value: summary.attempts ? summary.accuracy + '%' : '—', icon: Target },
    { name: 'Верно с первого раза', value: summary.studied ? summary.firstAccuracy + '%' : '—', icon: TrendingUp },
    { name: 'Экзамены сданы', value: passes + ' из ' + exams.length, icon: ClipboardCheck },
    { name: 'Среднее время экзамена', value: average, icon: Clock3 },
  ]

  return <div className="screen-stack">
    <PageTitle title="Прогресс" description="Следи за охватом вопросов и результатами занятий." />
    <div className="progress-overview">
      <section className="panel progress-cover">
        <div className="panel-head"><h2>Охват ABM</h2><BookOpenCheck size={20} /></div>
        <ProgressRing value={coverage} label={studied + ' из 800 официальных вопросов'}>
          <strong>{studied}<span> / 800</span></strong><small>изучено</small>
        </ProgressRing>
        <p><strong>{mastered}</strong> освоено · <strong>{completed}</strong> из 40 билетов завершено</p>
      </section>
      <div className="progress-right">
        {bank.kind === 'practice' && <div className="practice-progress"><span className="icon-box"><BookOpenCheck size={20} /></span><span><b>Авторская практика</b><small>Отдельно от охвата ABM</small></span><strong>{summary.studied} из 40</strong></div>}
        <div className="metric-grid">{metrics.map(({ name, value, icon: Icon }) => <section className="panel stat-card" key={name}><Icon size={20} /><strong>{value}</strong><span>{name}</span></section>)}</div>
      </div>
    </div>
    <div className="analytics-grid">
      <WeeklyChart progress={progress} bank={bank} />
      <section className="panel chart-panel">
        <div className="panel-head"><h2>Темы для повторения</h2><Target size={20} /></div>
        {topics.length ? <ul className="weak-topics">{topics.map(item => <li key={item.name}>
          <a href={'#/temy?tema=' + encodeURIComponent(item.name)}><span>{item.name}</span><strong>{item.wrong}</strong><ArrowUpRight size={15} /></a>
        </li>)}</ul> : <p className="chart-empty">После ответов здесь появятся темы, в которых встречаются ошибки.</p>}
        <a className="text-link" href="#/oshibki">Работа над ошибками <ArrowUpRight size={16} /></a>
      </section>
    </div>
    <section className="panel progress-ticket-panel">
      <div className="panel-head"><h2>40 билетов ABM</h2><a className="text-link" href="#/bilety">Открыть билеты <ArrowUpRight size={16} /></a></div>
      <ol className="mini-tickets">{tickets.map(item => {
        const label = { new: 'Не начат', working: 'В процессе', done: 'Завершён', mastered: 'Освоен' }[item.state]
        return <li key={item.number} className={'mini-ticket mini-ticket--' + item.state} title={'Билет ' + item.number + ' · ' + label} aria-label={'Билет ' + item.number + ', ' + label}>{item.number}</li>
      })}</ol>
      <div className="ticket-legend"><span>Не начат</span><span>В процессе</span><span>Завершён</span><span>Освоен</span></div>
    </section>
    <div className="analytics-grid">
      <section className="panel chart-panel">
        <div className="panel-head"><h2>История экзаменов</h2><ClipboardCheck size={20} /></div>
        {progress.exams.length ? <ul className="exam-history">{progress.exams.map(item => <li key={item.id}>
          <div><strong className={item.passed ? 'positive' : 'negative'}>{item.passed ? 'Сдал' : 'Не сдал'}</strong><small>{item.kind === 'official' ? 'ABM' : 'Учебный'} · {shortDate(item.at)}</small></div>
          <span>{item.correct} верно · {durationText(item.duration)}</span>
        </li>)}</ul> : <p className="chart-empty">Завершённые попытки появятся здесь.</p>}
        <a className="text-link" href="#/ekzamen">К экзамену <ArrowUpRight size={16} /></a>
      </section>
      <section className="panel chart-panel junction-stats">
        <div className="panel-head"><h2>Перекрёстки</h2><Route size={20} /></div>
        <strong>{junctionCorrect}<span> / 36</span></strong><p><CircleCheck size={16} /> Решено верно</p>
        <p>{progress.junctions.length} попыток</p>
        <a href="#/perekrestki" className="text-link">К тренажёру <ArrowUpRight size={16} /></a>
      </section>
    </div>
    <p className="bank-footer">Вопрос считается освоенным после двух верных ответов подряд. Если раньше были ошибки, нужны три. Билет считается освоенным после прохождения без ошибок.</p>
  </div>
}
