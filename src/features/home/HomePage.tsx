import { ArrowRight, ArrowUpRight, BookOpen, ClipboardCheck, Clock3, Crosshair, History, RotateCcw, Route, Target, Timer } from 'lucide-react'
import { Button, ProgressRing, shortDate } from '../../components/ui'
import { percent, questionStats, weakTopics } from '../../domain/learning'
import type { Bank } from '../../domain/bank'
import type { Progress } from '../../domain/storage'
import { publicAssetUrl } from '../../publicAssetUrl'

type Props = {
  progress: Progress
  bank: Bank
  studied: number
  mastered: number
  ready: boolean
  onContinue: () => void
  onPractice: () => void
}

const shortcuts = [
  { href: '#/ekzamen', name: 'Начать экзамен', text: '20 вопросов · 20 минут', icon: ClipboardCheck, color: 'amber' },
  { href: '#/oshibki', name: 'Работа над ошибками', text: 'Повтори то, что вызывает трудности', icon: RotateCcw, color: 'rose' },
  { href: '#/perekrestki', name: 'Тренировка перекрёстков', text: '36 интерактивных ситуаций', icon: Route, color: 'lilac' },
]

export default function HomePage({ progress, bank, studied, mastered, ready, onContinue, onPractice }: Props) {
  const coverage = percent(studied, 800)
  const topics = weakTopics(bank.questions, progress.attempts)
  const stats = questionStats(progress.attempts)
  const toReview = bank.questions.filter(question => {
    const stat = stats.get(question.id)
    return stat && stat.wrong > 0 && stat.dueAt <= Date.now()
  }).length
  const lastExam = progress.exams[0]
  const lastTicket = progress.tickets[0]
  const latestAttempt = progress.attempts.at(-1)
  const lastJunction = progress.junctions[0]
  const recent = Math.max(latestAttempt?.at ?? 0, lastJunction?.at ?? 0)

  return <div className="home-page">
    <div className="home-top">
      <section className="home-hero">
        <img className="hero-image" src={publicAssetUrl('media/doroga.webp')} alt="" fetchPriority="high" />
        <div className="hero-content">
          <span className="hero-kicker"><span />ТЕОРИЯ ВОЖДЕНИЯ</span>
          <h1>PDD</h1>
          <p>Учись понимать правила.<br />Готовься уверенно.</p>
          <Button variant="primary" onClick={onContinue} disabled={!ready}>Продолжить обучение <ArrowRight size={19} /></Button>
        </div>
      </section>
      <section className="panel home-progress">
        <div className="panel-head"><h2>Твой прогресс</h2><a className="icon-button panel-arrow" href="#/progress" aria-label="Открыть прогресс"><ArrowUpRight size={18} /></a></div>
        <ProgressRing value={coverage} label={'Изучено ' + studied + ' из 800 официальных вопросов, охват ' + coverage + '%'}>
          <strong>{studied}<span> / 800</span></strong><small>изучено</small>
        </ProgressRing>
        <div className="home-mastery">
          <div><span className="metric-dot metric-dot--orange" /><div><strong>{mastered}</strong><small>Освоено</small></div></div>
          <div><span className="metric-dot" /><div><strong>{800 - mastered}</strong><small>Осталось освоить</small></div></div>
        </div>
        <span className="coverage-label">Охват ABM <b>{coverage}%</b></span>
      </section>
    </div>
    <section className="home-actions" aria-label="Быстрый старт">
      <h2 className="section-title">Быстрый старт</h2>
      <div className="shortcut-grid">{shortcuts.map(({ href, name, text, icon: Icon, color }) =>
        <a className="panel shortcut" href={href} key={href}>
          <div className="shortcut-top"><span className={'icon-box icon-box--' + color}><Icon size={22} strokeWidth={1.9} /></span><ArrowUpRight size={19} /></div>
          <h3>{name}</h3><p>{text}</p>
        </a>)}</div>
    </section>
    <div className="home-bottom">
      <section className="panel practice-callout">
        <div className="callout-icon"><Timer size={25} /></div>
        <div className="callout-content"><h2>Тренировка на 10 минут</h2>
          <p>{topics[0] ? 'Больше всего ошибок в теме «' + topics[0].name + '».' : 'Короткая подборка вопросов на сегодня.'}</p>
          <div className="inline-actions">
            <Button variant="secondary" onClick={onPractice} disabled={!ready}>Начать тренировку <ArrowRight size={16} /></Button>
            {topics[0] && <a className="text-link" href={'#/temy?tema=' + encodeURIComponent(topics[0].name)}>Открыть тему</a>}
          </div>
        </div>
      </section>
      <section className="panel recent">
        <div className="panel-head"><h2>Недавнее</h2><History size={18} /></div>
        <ul>
          <li><ClipboardCheck size={16} /><span>Последний экзамен</span><strong className={lastExam?.passed ? 'positive' : ''}>{lastExam ? (lastExam.passed ? 'Сдал' : 'Не сдал') : '—'}</strong></li>
          <li><BookOpen size={16} /><span>Завершённый билет</span><strong>{lastTicket ? '№ ' + lastTicket.ticket : '—'}</strong></li>
          <li><Target size={16} /><span>Пора повторить</span><strong>{toReview}</strong></li>
          {recent > 0 && <li><Clock3 size={16} /><span>Последнее занятие</span><strong>{shortDate(recent)}</strong></li>}
        </ul>
      </section>
    </div>
    {bank.kind === 'practice' && <p className="bank-footer"><Crosshair size={15} /> Сейчас доступны авторские задания. <a href="#/nastroyki">Официальный комплект ABM</a></p>}
  </div>
}
