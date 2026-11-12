import { useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, BookOpen, Check, LockKeyhole, Search } from 'lucide-react'
import { Button, PageTitle, Track } from '../../components/ui'
import { ABM_TICKETS, abmQuestionId } from '../../domain/abm-positions'
import type { Bank } from '../../domain/bank'
import { practiceBank } from '../../domain/practice-bank'
import type { Progress } from '../../domain/storage'

type Ticket = { number: number; studied: number; best?: number; mistakes: number; state: 'new' | 'working' | 'done' | 'mastered' }
const labels: Record<Ticket['state'], string> = { new: 'Не начат', working: 'В процессе', done: 'Завершён', mastered: 'Освоен' }

export function ticketStates(kind: Bank['kind'], progress: Progress): Ticket[] {
  const byId = new Map(progress.attempts.map(item => [item.questionId, item]))
  const count = kind === 'official' ? ABM_TICKETS : 2
  return Array.from({ length: count }, (_, i) => {
    const number = i + 1
    const runs = progress.tickets.filter(run => run.kind === kind && run.ticket === number)
    const best = runs.length ? Math.max(...runs.map(run => run.correct)) : undefined
    const answers = Array.from({ length: 20 }, (_, j) => byId.get(kind === 'official' ? abmQuestionId(number, j + 1) : 'pdd-' + number + '-' + (j + 1))).filter(Boolean)
    const studied = answers.length
    const mistakes = runs[0]?.incorrectIds.length ?? answers.filter(entry => !entry?.correct).length
    const state = best === 20 ? 'mastered' : best !== undefined ? 'done' : studied ? 'working' : 'new'
    return { number, studied, best, mistakes, state }
  })
}

function TicketCard({ ticket, kind, available, onOpen }: { ticket: Ticket; kind: Bank['kind']; available: boolean; onOpen: () => void }) {
  const name = (kind === 'practice' ? 'Учебный билет ' : 'Билет ') + ticket.number
  return <button type="button" aria-label={name} className={'panel ticket-card ticket-card--' + ticket.state} onClick={onOpen} disabled={!available}>
    <span className="ticket-card-top"><span className="ticket-name">{kind === 'practice' ? 'Учебный билет' : 'Билет'}</span>{available ? (ticket.state === 'mastered' ? <Check size={17} /> : <ArrowUpRight size={17} />) : <LockKeyhole size={14} />}</span>
    <strong className="ticket-number">{String(ticket.number).padStart(2, '0')}</strong>
    <span className="ticket-status">{available || ticket.studied ? labels[ticket.state] : 'Требуется комплект'}</span>
    <Track value={ticket.studied * 5} />
    <span className="ticket-result"><span>{ticket.best === undefined ? ticket.studied + ' из 20' : 'Лучший: ' + ticket.best + '/20'}</span><span>Ошибки {ticket.mistakes}</span></span>
  </button>
}

export default function TicketsPage({ official, practiceSelected, progress, ready, onStart, onPractice }: {
  official?: Bank; practiceSelected: boolean; progress: Progress; ready: boolean
  onStart: (bank: Bank, ticket: number) => void; onPractice: () => void
}) {
  const [filter, setFilter] = useState('all')
  const [number, setNumber] = useState('')
  const tickets = useMemo(() => ticketStates('official', progress), [progress])
  const filtered = tickets.filter(ticket => (!number || String(ticket.number) === String(Number(number))) &&
    (filter === 'all' || (filter === 'working' && ticket.state === 'working') || (filter === 'done' && ['mastered', 'done'].includes(ticket.state))))
  return <div className="screen-stack">
    <PageTitle title="Билеты" description="Проходи вопросы по порядку и разбирай каждый ответ." />
    {official && <nav className="toolbar bank-picker" aria-label="Комплект билетов">
      <a className="button button--secondary" href="#/bilety" aria-current={!practiceSelected ? 'page' : undefined}>Комплект ABM</a>
      <a className="button button--secondary" href="#/bilety?komplekt=uchebny" aria-current={practiceSelected ? 'page' : undefined}>Авторская практика</a>
    </nav>}
    {(practiceSelected || !official) && <>
      <section className="panel data-notice">
        <span className="icon-box icon-box--amber"><BookOpen size={21} /></span>
        <div><h2>Авторская практика</h2><p>40 авторских вопросов в двух учебных билетах.</p></div>
        {!official && <a className="text-link" href="#/nastroyki">О комплекте ABM <ArrowUpRight size={15} /></a>}
      </section>
      <div className="practice-ticket-grid">
        {ticketStates('practice', progress).map(ticket => <TicketCard key={ticket.number} ticket={ticket} kind="practice" available onOpen={() => onStart(practiceBank, ticket.number)} />)}
      </div>
      <div className="inline-actions">
        <Button variant="primary" disabled={!ready} onClick={onPractice}>Тренировка на 10 минут <ArrowRight size={17} /></Button>
        <a className="button button--secondary" href="#/ekzamen?komplekt=uchebny">Учебный экзамен</a>
      </div>
    </>}
    {!practiceSelected && <>
      <div className="section-heading"><div><h2>Официальные билеты ABM</h2><p>40 билетов · 20 вопросов в каждом</p></div></div>
      {official && <div className="toolbar">
        <div className="segmented" aria-label="Статус билета">
          {[['all', 'Все'], ['working', 'В процессе'], ['done', 'Завершённые']].map(([value, label]) =>
            <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <label className="search-input"><Search size={18} /><input type="search" inputMode="numeric" placeholder="Номер билета" aria-label="Номер билета" value={number} onChange={event => setNumber(event.target.value)} /></label>
      </div>}
      <div className="ticket-grid">
        {filtered.map(ticket => <TicketCard key={ticket.number} ticket={ticket} kind="official" available={Boolean(official)} onOpen={() => { if (official) onStart(official, ticket.number) }} />)}
      </div>
      {filtered.length === 0 && <p className="notice">Билетов с такими параметрами нет.</p>}
    </>}
  </div>
}
