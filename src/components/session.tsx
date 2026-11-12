import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Circle, X } from 'lucide-react'
import type { Question } from '../domain/bank'

export function useClock(running: boolean) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!running) return
    const refresh = () => setNow(Date.now())
    refresh()
    const interval = window.setInterval(refresh, 250)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh) }
  }, [running])
  return now
}

export function useQuestionKeys(onOption: (option: number) => void, onPrevious?: () => void, onNext?: () => void) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat ||
        document.querySelector('dialog[open]') || (target instanceof HTMLElement && target.closest('input, select, textarea, [contenteditable]'))) return
      if (/^[1-5]$/.test(event.key)) {
        event.preventDefault()
        onOption(Number(event.key) - 1)
      }
      if (event.key === 'ArrowLeft' && onPrevious) { event.preventDefault(); onPrevious() }
      if (event.key === 'ArrowRight' && onNext) { event.preventDefault(); onNext() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onOption, onPrevious, onNext])
}

export function Option({ index, children, status, onClick, disabled, exam = false }: {
  index: number; children: ReactNode; status?: 'selected' | 'right' | 'wrong'; onClick: () => void; disabled?: boolean; exam?: boolean
}) {
  return <button type="button" disabled={disabled} data-testid={exam ? 'exam-answer' : undefined}
    aria-pressed={exam ? status === 'selected' : undefined}
    className={'answer-option' + (status ? ' answer-option--' + status : '')} onClick={onClick}>
    <span className="answer-number" aria-hidden="true">{index + 1}</span>
    <span>{children}</span>
    {status === 'right' && <Check size={20} className="answer-mark" aria-label="Верный ответ" />}
    {status === 'wrong' && <X size={20} className="answer-mark" aria-label="Твой неверный ответ" />}
    {status === 'selected' && <Circle size={16} className="answer-mark answer-mark--selected" aria-hidden="true" />}
  </button>
}

export function QuestionMap({ items, current, answerState, onMove }: {
  items: Question[]; current: number; answerState: (question: Question) => 'right' | 'wrong' | 'answered' | ''; onMove: (index: number) => void
}) {
  return <nav className="panel question-map" aria-label="Навигация по вопросам">
    <h2>Вопросы</h2>
    <div className="question-map-grid">{items.map((item, index) => {
      const state = answerState(item)
      const note = { right: ', верно', wrong: ', ошибка', answered: ', отвечено', '': '' }[state]
      return <button className={'question-dot ' + (state ? 'question-dot--' + state : '')} type="button" key={item.id} aria-current={index === current ? 'step' : undefined}
        aria-label={'Вопрос ' + (index + 1) + note} onClick={() => onMove(index)}>{index + 1}</button>
    })}</div>
  </nav>
}

export function ResultNumbers({ values }: { values: { label: string; value: string | number; tone?: string }[] }) {
  return <div className="result-numbers">{values.map(item => <div key={item.label}><strong className={item.tone}>{item.value}</strong><span>{item.label}</span></div>)}</div>
}
