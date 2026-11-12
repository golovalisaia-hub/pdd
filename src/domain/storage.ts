import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Question } from './bank'
import { examSummary } from './exam'
import type { ExamState } from './exam'
import { studyResult } from './learning'
import type { Attempt, Study } from './learning'
import type { ExamRun, Favorite, JunctionRun, Progress, TicketRun } from './backup'

export type { Progress } from './backup'

type TicketSessionKey = `ticket:${Study['kind']}:${number}`
type SessionRow = { key: 'exam'; value: ExamState } | { key: 'study' | TicketSessionKey; value: Study }

const initialTables = {
  attempts: 'id,questionId,at', tickets: 'id,[kind+ticket],at',
  exams: 'id,at,kind', favorites: 'questionId', sessions: 'key',
}

export class PddDatabase extends Dexie {
  declare attempts: Table<Attempt, string>
  declare tickets: Table<TicketRun, string>
  declare exams: Table<ExamRun, string>
  declare junctions: Table<JunctionRun, string>
  declare favorites: Table<Favorite, string>
  declare sessions: Table<SessionRow, SessionRow['key']>

  constructor(name = 'pdd-local') {
    super(name)
    this.version(1).stores(initialTables)
    this.version(2).stores({ ...initialTables, junctions: 'id,scenarioId,at' })
  }
}

export const db = new PddDatabase()
export const emptyProgress: Progress = { attempts: [], tickets: [], exams: [], junctions: [], favorites: [] }

export async function readProgress(database: PddDatabase): Promise<Progress> {
  const [attempts, tickets, exams, junctions, favorites] = await Promise.all([
    database.attempts.orderBy('at').toArray(),
    database.tickets.orderBy('at').reverse().toArray(),
    database.exams.orderBy('at').reverse().toArray(),
    database.junctions.orderBy('at').reverse().toArray(),
    database.favorites.toArray(),
  ])
  return { attempts, tickets, exams, junctions, favorites }
}

export async function toggleFavorite(database: PddDatabase, questionId: string) {
  return database.transaction('rw', database.favorites, async () => {
    const old = await database.favorites.get(questionId)
    const active = !old?.active
    await database.favorites.put({ questionId, active, at: Date.now() })
    return active
  })
}

export async function readStudy(database: PddDatabase) {
  const row = await database.sessions.get('study')
  return row?.key === 'study' ? row.value : undefined
}

export async function readExam(database: PddDatabase) {
  const row = await database.sessions.get('exam')
  return row?.key === 'exam' ? row.value : undefined
}

function ticketSessionKey(study: Study): TicketSessionKey | undefined {
  return study.ticket === undefined ? undefined : `ticket:${study.kind}:${study.ticket}`
}

async function writeStudy(database: PddDatabase, study: Study) {
  const key = ticketSessionKey(study)
  await database.sessions.put({ key: 'study', value: study })
  if (key) await database.sessions.put({ key, value: study })
}

export async function beginStudy(database: PddDatabase, study: Study) {
  return database.transaction('rw', database.sessions, async () => {
    const key = ticketSessionKey(study)
    const cached = key ? await database.sessions.get(key) : undefined
    const previous = cached && cached.key !== 'exam' ? cached.value : undefined
    const selected = previous?.version === study.version && previous.completedAt === undefined ? previous : study
    await writeStudy(database, selected)
    return selected
  })
}

export async function recordStudy(database: PddDatabase, studyId: string, question: Question, option: number, at: number, ms: number) {
  return database.transaction('rw', [database.sessions, database.attempts], async () => {
    const study = await readStudy(database)
    if (!study || study.id !== studyId || study.completedAt !== undefined || study.responses[question.id]) return study
    if (study.deadline !== undefined && at >= study.deadline) return study
    if (!study.ids.includes(question.id) || !Number.isInteger(option) || option < 0 || option >= question.options.length) return study
    const response = { option, at, ms: Math.max(0, Math.round(ms)) }
    const updated = { ...study, responses: { ...study.responses, [question.id]: response } }
    await database.attempts.add({
      ...response, id: study.id + ':' + question.id, questionId: question.id,
      correct: option === question.correct, mode: study.mode, version: study.version,
    })
    await writeStudy(database, updated)
    return updated
  })
}

export async function moveStudy(database: PddDatabase, studyId: string, index: number) {
  return database.transaction('rw', database.sessions, async () => {
    const study = await readStudy(database)
    if (!study || study.id !== studyId || study.completedAt !== undefined || index < 0 || index >= study.ids.length) return study
    const updated = { ...study, index }
    await writeStudy(database, updated)
    return updated
  })
}

export async function finishStudy(database: PddDatabase, studyId: string, questions: Question[], at: number) {
  return database.transaction('rw', [database.sessions, database.tickets], async () => {
    const study = await readStudy(database)
    if (!study || study.id !== studyId || study.completedAt !== undefined) return study
    if (study.mode !== 'practice' && !study.ids.every(questionId => study.responses[questionId])) return study
    const updated = { ...study, completedAt: at }
    await writeStudy(database, updated)
    if (study.ticket !== undefined) {
      const result = studyResult(study, questions)
      await database.tickets.put({
        id: study.id, kind: study.kind, ticket: study.ticket, at,
        correct: result.correct, duration: result.duration, incorrectIds: result.incorrect.map(item => item.id),
      })
    }
    return updated
  })
}

export async function updateExam(database: PddDatabase, update: (current: ExamState | undefined) => ExamState | undefined, expectedId?: string) {
  return database.transaction('rw', [database.sessions, database.attempts, database.exams], async () => {
    const before = await readExam(database)
    if (expectedId !== undefined && before?.id !== expectedId) return before
    const state = update(before)
    if (!state || state === before) return state
    await database.sessions.put({ key: 'exam', value: state })
    if (state.phase === 'done' && (before?.id !== state.id || before.phase !== 'done')) {
      const result = examSummary(state)
      const at = state.finishedAt ?? state.startedAt
      await database.exams.put({
        id: state.id, kind: state.kind, at, duration: result.duration, passed: state.outcome === 'passed',
        correct: result.correct, mistakes: result.mistakes, extraCount: result.extraCount as ExamRun['extraCount'],
      })
      const attempts = [...state.main, ...state.extra].flatMap((question): Attempt[] => {
        const answer = state.answers[question.id]
        if (!answer && !state.missedIds.includes(question.id)) return []
        return [{
          id: state.id + ':' + question.id, questionId: question.id, version: state.version, mode: 'exam',
          at: answer?.at ?? (state.main.includes(question) && state.extra.length ? state.deadline - state.extra.length * 60_000 : at),
          ms: answer?.ms ?? 0, option: answer?.option ?? null, correct: answer?.option === question.correct,
        }]
      })
      await database.attempts.bulkPut(attempts)
    }
    return state
  })
}
