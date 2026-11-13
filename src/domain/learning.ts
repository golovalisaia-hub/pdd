import type { Bank, Question } from './bank'

export type StudyMode = 'ticket' | 'practice' | 'review'
export type Response = { option: number; at: number; ms: number }
export type Attempt = Omit<Response, 'option'> & {
  id: string
  questionId: string
  version: string
  mode: StudyMode | 'exam'
  correct: boolean
  option: number | null
}

export type Study = {
  id: string
  kind: Bank['kind']
  version: string
  mode: StudyMode
  name: string
  ticket?: number
  ids: string[]
  responses: Record<string, Response>
  index: number
  startedAt: number
  deadline?: number
  completedAt?: number
}

export function createStudy(bank: Bank, items: Question[], mode: StudyMode, name: string, now: number, ticket?: number): Study {
  return {
    id: crypto.randomUUID(), kind: bank.kind, version: bank.version, mode, name, ticket,
    ids: items.map(question => question.id), responses: {}, index: 0, startedAt: now,
    deadline: mode === 'practice' ? now + 10 * 60_000 : undefined,
  }
}

export function studyResult(study: Study, items: Question[]) {
  const attempted = items.filter(question => Boolean(study.responses[question.id]))
  const incorrect = attempted.filter(question => study.responses[question.id].option !== question.correct)
  return {
    correct: attempted.length - incorrect.length,
    attempted: attempted.length,
    incorrect,
    topics: [...new Set(incorrect.map(question => question.topic))],
    duration: Object.values(study.responses).reduce((sum, answer) => sum + answer.ms, 0),
  }
}

const HOUR = 3_600_000

type QuestionStats = {
  total: number
  right: number
  wrong: number
  streak: number
  lastAt: number
  firstCorrect: boolean
  mastered: boolean
  dueAt: number
}

export function questionStats(history: Attempt[]): Map<string, QuestionStats> {
  const stats = new Map<string, QuestionStats>()
  const ordered = [...history].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  for (const entry of ordered) {
    const prior = stats.get(entry.questionId)
    const streak = entry.correct ? (prior?.streak ?? 0) + 1 : 0
    const wrong = (prior?.wrong ?? 0) + Number(!entry.correct)
    const delay = streak === 0 ? 0 : streak === 1 ? (wrong ? 6 : 24) : Math.min(30 * 24, (2 ** Math.min(streak, 8)) * 6)
    stats.set(entry.questionId, {
      total: (prior?.total ?? 0) + 1,
      right: (prior?.right ?? 0) + Number(entry.correct),
      wrong, streak, lastAt: entry.at, firstCorrect: prior?.firstCorrect ?? entry.correct,
      mastered: streak >= (wrong ? 3 : 2),
      dueAt: entry.at + delay * HOUR,
    })
  }
  return stats
}

export function percent(n: number, total: number) {
  return total ? Math.round(n * 100 / total) : 0
}

export function learningSummary(questions: readonly Pick<Question, 'id'>[], history: Attempt[]) {
  const stats = questionStats(history)
  const seen = questions.flatMap(question => {
    const item = stats.get(question.id)
    return item ? [item] : []
  })
  const attempts = seen.reduce((sum, item) => sum + item.total, 0)
  return {
    studied: seen.length,
    mastered: seen.filter(item => item.mastered).length,
    accuracy: percent(seen.reduce((sum, item) => sum + item.right, 0), attempts),
    firstAccuracy: percent(seen.filter(item => item.firstCorrect).length, seen.length),
    attempts,
  }
}

export function weakTopics(questions: Question[], history: Attempt[]) {
  const topics = new Map<string, { name: string; wrong: number; total: number }>()
  const questionTopics = new Map(questions.map(question => [question.id, question.topic]))
  for (const entry of history) {
    const name = questionTopics.get(entry.questionId)
    if (!name) continue
    const topic = topics.get(name) ?? { name, wrong: 0, total: 0 }
    topic.total++
    topic.wrong += Number(!entry.correct)
    topics.set(name, topic)
  }
  return [...topics.values()].filter(topic => topic.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || (b.wrong / b.total) - (a.wrong / a.total) || a.name.localeCompare(b.name, 'ru'))
}

export function choosePractice(questions: Question[], history: Attempt[], now: number, limit = 20, random = Math.random) {
  const stats = questionStats(history)
  const weak = new Set(weakTopics(questions, history).slice(0, 3).map(topic => topic.name))
  return questions.map(question => {
    const stat = stats.get(question.id)
    const isDue = Boolean(stat && stat.dueAt <= now)
    let score = weak.has(question.topic) ? 15 : 0
    if (!stat) score += 80
    if (isDue) score += stat?.wrong ? 150 : 95
    if (stat?.wrong) score += Math.min(stat.wrong, 5) * 12
    if (stat?.mastered) score -= 30
    return { question, score, at: stat?.lastAt ?? 0, order: random() }
  }).sort((a, b) => b.score - a.score || a.at - b.at || a.order - b.order).slice(0, limit).map(item => item.question)
}
