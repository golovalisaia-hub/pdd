import type { Bank, Question } from './bank'

export const MAIN_MINUTES = 20
const MINUTE = 60_000
const BLOCK_SIZE = 5
const GROUPS = 4
export type ExamReason = 'same-block' | 'three-errors' | 'extra-error' | 'time' | 'quit'
export type ExamAnswer = { option: number; at: number; ms: number }

export type ExamState = {
  id: string
  kind: Bank['kind']
  version: string
  phase: 'main' | 'extra' | 'done'
  startedAt: number
  deadline: number
  main: Question[]
  reserve: Question[][]
  extra: Question[]
  answers: Record<string, ExamAnswer>
  missedIds: string[]
  currentId: string
  finishedAt?: number
  outcome?: 'passed' | 'failed'
  reason?: ExamReason
}

function groupOf(question: Question) {
  return Math.floor((question.position - 1) / BLOCK_SIZE)
}

export function createExam(bank: Bank, id: string, now: number, random = Math.random): ExamState {
  const main: Question[] = []
  const reserve: Question[][] = []
  for (let group = 0; group < GROUPS; group++) {
    const tickets = new Map<number, Question[]>()
    for (const question of bank.questions.filter(question => groupOf(question) === group)) {
      const block = tickets.get(question.ticket) ?? []
      block.push(question)
      tickets.set(question.ticket, block)
    }
    const blocks = [...tickets.values()]
      .filter(block => block.length === BLOCK_SIZE && new Set(block.map(question => question.position)).size === BLOCK_SIZE)
      .map(block => block.sort((a, b) => a.position - b.position))
    if (blocks.length < 2) throw new Error('Для экзамена нужны два полных блока в каждой группе.')
    const index = Math.floor(random() * blocks.length)
    const [primary] = blocks.splice(index, 1)
    main.push(...primary)
    reserve.push(blocks[Math.floor(random() * blocks.length)])
  }
  return {
    id, kind: bank.kind, version: bank.version, phase: 'main', startedAt: now,
    deadline: now + MAIN_MINUTES * MINUTE, main, reserve, extra: [], answers: {}, missedIds: [],
    currentId: main[0].id,
  }
}

export function examItems(state: ExamState): Question[] {
  return state.phase === 'extra' ? state.extra : state.phase === 'main' ? state.main : [...state.main, ...state.extra]
}

export function examRemaining(state: ExamState, now: number) {
  if (state.phase === 'done') return 0
  const duration = (state.phase === 'extra' ? state.extra.length : MAIN_MINUTES) * MINUTE
  return Math.max(0, Math.min(duration, state.deadline - now))
}

function finish(state: ExamState, now: number, outcome: NonNullable<ExamState['outcome']>, reason?: ExamReason): ExamState {
  return { ...state, phase: 'done', finishedAt: now, outcome, reason }
}

function isWrong(question: Question, answers: ExamState['answers']) {
  const answer = answers[question.id]
  return Boolean(answer && answer.option !== question.correct)
}

function resolveMain(state: ExamState, now: number, expired: boolean): ExamState {
  const unanswered = state.main.filter(question => !state.answers[question.id])
  const mistakes = state.main.filter(question => isWrong(question, state.answers))
  if (expired) {
    state = { ...state, missedIds: unanswered.map(question => question.id) }
    mistakes.push(...unanswered)
  }
  const groups = [...new Set(mistakes.map(groupOf))].sort((a, b) => a - b)
  if (mistakes.length >= 3) return finish(state, now, 'failed', expired ? 'time' : 'three-errors')
  if (mistakes.length > groups.length) return finish(state, now, 'failed', expired ? 'time' : 'same-block')
  if (unanswered.length && !expired) return state
  if (!mistakes.length) return finish(state, now, 'passed')
  const extra = groups.flatMap(group => state.reserve[group])
  return { ...state, phase: 'extra', extra, currentId: extra[0].id, deadline: now + extra.length * MINUTE }
}

export function expireExam(state: ExamState, now: number): ExamState {
  if (state.phase === 'done' || now < state.deadline) return state
  if (state.phase === 'main') return expireExam(resolveMain(state, state.deadline, true), now)
  const missedIds = [...state.missedIds, ...state.extra.filter(q => !state.answers[q.id]).map(q => q.id)]
  return finish({ ...state, missedIds }, state.deadline, 'failed', 'time')
}

export function answerExam(state: ExamState, id: string, option: number, now: number, ms: number): ExamState {
  const timed = expireExam(state, now)
  if (timed !== state || state.phase === 'done' || state.answers[id]) return timed
  const items = examItems(state)
  const index = items.findIndex(question => question.id === id)
  const question = items[index]
  if (!question || !Number.isInteger(option) || option < 0 || option >= question.options.length) return state
  const answers = { ...state.answers, [id]: { option, at: now, ms: Math.max(0, ms) } }
  const next = [...items.slice(index + 1), ...items.slice(0, index)].find(item => !answers[item.id])
  const updated: ExamState = { ...state, answers, currentId: next?.id ?? id }
  if (state.phase === 'main') return resolveMain(updated, now, false)
  if (option !== question.correct) return finish(updated, now, 'failed', 'extra-error')
  return next ? updated : finish(updated, now, 'passed')
}

export function quitExam(state: ExamState, now: number) {
  const timed = expireExam(state, now)
  return timed.phase === 'done' ? timed : finish(timed, now, 'failed', 'quit')
}

export function examSummary(state: ExamState) {
  const items = [...state.main, ...state.extra]
  const wrong = items.filter(question => isWrong(question, state.answers) || state.missedIds.includes(question.id))
  const correct = items.filter(question => state.answers[question.id]?.option === question.correct).length
  return {
    correct,
    mistakes: wrong.length,
    wrong,
    extraCount: state.extra.length,
    unanswered: items.length - Object.keys(state.answers).length,
    duration: Math.max(0, (state.finishedAt ?? state.startedAt) - state.startedAt),
  }
}
