import type { Table } from 'dexie'
import { z } from 'zod'
import { readProgress } from './storage'
import type { PddDatabase } from './storage'

const id = z.string().min(1).max(250)
const time = z.number().int().nonnegative()
const timestamp = time.max(8_640_000_000_000_000)
const kind = z.enum(['official', 'practice'])
const attemptSchema = z.object({
  id, questionId: id, version: id, mode: z.enum(['ticket', 'practice', 'review', 'exam']),
  correct: z.boolean(), option: z.number().int().min(0).max(4).nullable(), at: timestamp, ms: time,
}).refine(attempt => !attempt.correct || attempt.option !== null)
const ticketSchema = z.object({
  id, kind, ticket: z.number().int().min(1).max(40), at: timestamp,
  correct: z.number().int().min(0).max(20), incorrectIds: z.array(id).max(20), duration: time,
})
const examSchema = z.object({
  id, kind, at: timestamp, duration: time, passed: z.boolean(),
  correct: z.number().int().min(0).max(30), mistakes: z.number().int().min(0).max(30),
  extraCount: z.union([z.literal(0), z.literal(5), z.literal(10)]),
})
const junctionSchema = z.object({ id, scenarioId: id, correct: z.boolean(), at: timestamp })
const favoriteSchema = z.object({ questionId: id, active: z.boolean(), at: timestamp })
const backupSchema = z.object({
  format: z.literal('pdd-progress'), version: z.literal(1), exportedAt: z.iso.datetime(),
  attempts: z.array(attemptSchema),
  tickets: z.array(ticketSchema),
  exams: z.array(examSchema),
  junctions: z.array(junctionSchema),
  favorites: z.array(favoriteSchema),
})

export type TicketRun = z.infer<typeof ticketSchema>
export type ExamRun = z.infer<typeof examSchema>
export type JunctionRun = z.infer<typeof junctionSchema>
export type Favorite = z.infer<typeof favoriteSchema>
export type Progress = Pick<z.infer<typeof backupSchema>, 'attempts' | 'tickets' | 'exams' | 'junctions' | 'favorites'>

export async function exportProgress(database: PddDatabase) {
  const progress = await database.transaction('r', [database.attempts, database.tickets, database.exams, database.junctions, database.favorites], () => readProgress(database))
  return JSON.stringify({ format: 'pdd-progress', version: 1, exportedAt: new Date().toISOString(), ...progress }, null, 2)
}

export async function importProgress(database: PddDatabase, text: string) {
  if (text.length > 25_000_000) throw new Error('Файл резервной копии превышает 25 МБ.')
  let input: unknown
  try { input = JSON.parse(text) }
  catch { throw new Error('Файл не удалось прочитать как JSON.') }
  if (typeof input !== 'object' || input === null || !('version' in input) || input.version !== 1) {
    throw new Error('Эта версия резервной копии не поддерживается.')
  }
  const parsed = backupSchema.safeParse(input)
  if (!parsed.success) throw new Error('Некорректная резервная копия. Проверьте раздел «' + String(parsed.error.issues[0]?.path[0] ?? 'формат') + '».')
  const value = parsed.data
  await database.transaction('rw', [database.attempts, database.tickets, database.exams, database.junctions, database.favorites], async () => {
    await mergeHistory(database.attempts, value.attempts)
    await mergeHistory(database.tickets, value.tickets)
    await mergeHistory(database.exams, value.exams)
    await mergeHistory(database.junctions, value.junctions)
    for (const favorite of value.favorites) {
      const existing = await database.favorites.get(favorite.questionId)
      if (!existing || existing.at < favorite.at) await database.favorites.put(favorite)
    }
  })
  return value.attempts.length
}

async function mergeHistory<T extends { id: string }>(table: Table<T, string>, rows: T[]) {
  const unique = [...new Map(rows.map(row => [row.id, row])).values()]
  const existing = await table.bulkGet(unique.map(row => row.id))
  await table.bulkAdd(unique.filter((_, index) => !existing[index]))
}
