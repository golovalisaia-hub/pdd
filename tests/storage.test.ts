import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, it, expect, afterEach } from 'vitest'
import { PddDatabase, readProgress, beginStudy, recordStudy, finishStudy, updateExam } from '../src/domain/storage'
import { exportProgress, importProgress } from '../src/domain/backup'
import { createStudy } from '../src/domain/learning'
import { createExam, answerExam, quitExam } from '../src/domain/exam'
import { shortDate } from '../src/components/ui'
import type { Bank } from '../src/domain/bank'

const bank: Bank = {
  kind: 'practice', version: 'a',
  questions: [1, 2].flatMap(ticket => Array.from({ length: 20 }, (_, i) => ({
    id: 'pdd-' + ticket + '-' + i, ticket, position: i + 1, text: 'Вопрос', options: ['Да', 'Нет'], correct: 0, topic: 'Знаки',
  }))),
}
const active: PddDatabase[] = []
const open = (name: string = crypto.randomUUID()) => {
  const db = new PddDatabase(name)
  active.push(db)
  return db
}
afterEach(async () => {
  const databases = active.splice(0)
  for (const db of databases) db.close()
  for (const db of new Map(databases.map(value => [value.name, value])).values()) await db.delete()
})

describe('локальная база', () => {
  it('сохраняет ответы и сессию после повторного открытия и дублирующего нажатия', async () => {
    const db = open()
    const items = bank.questions.slice(0, 2)
    const study = createStudy(bank, items, 'ticket', 'Билет', 100, 1)
    await beginStudy(db, study)
    await Promise.all([recordStudy(db, study.id, items[0], 1, 200, 100), recordStudy(db, study.id, items[0], 0, 201, 101)])
    db.close()
    const restored = open(db.name)
    expect((await readProgress(restored)).attempts).toMatchObject([{ correct: false, ms: 100 }])
    expect((await restored.sessions.get('study'))?.value).toMatchObject({ id: study.id })
    await recordStudy(restored, study.id, items[1], 0, 300, 100)
    await finishStudy(restored, study.id, items, 400)
    expect((await readProgress(restored)).tickets[0]).toMatchObject({ correct: 1, incorrectIds: [items[0].id] })
  })

  it('возобновляет каждый незавершённый билет после переключения на другой', async () => {
    const db = open()
    const first = bank.questions.filter(item => item.ticket === 1)
    const second = bank.questions.filter(item => item.ticket === 2)
    const study = createStudy(bank, first, 'ticket', 'Билет 1', 100, 1)
    await beginStudy(db, study)
    await recordStudy(db, study.id, first[0], 0, 200, 100)
    await beginStudy(db, createStudy(bank, second, 'ticket', 'Билет 2', 300, 2))
    const resumed = await beginStudy(db, createStudy(bank, first, 'ticket', 'Билет 1', 400, 1))
    expect(resumed.id).toBe(study.id)
    expect(resumed.responses[first[0].id]?.option).toBe(0)
  })

  it('валидирует и объединяет резервные копии повторно без дублирования', async () => {
    const db = open()
    const other = open()
    const item = bank.questions[0]
    const study = createStudy(bank, [item], 'practice', 'Тренировка', 1)
    await beginStudy(db, study)
    await recordStudy(db, study.id, item, 0, 2, 1)
    const exported = await exportProgress(db)
    await importProgress(other, exported)
    await importProgress(other, exported)
    expect((await readProgress(other)).attempts).toHaveLength(1)
    await expect(importProgress(other, '{"version":999}')).rejects.toThrow('версия')
    expect((await readProgress(other)).attempts).toHaveLength(1)
  })

  it('не импортирует даты за пределами календаря и безопасно показывает старую повреждённую запись', async () => {
    const db = open()
    const payload = JSON.parse(await exportProgress(db))
    payload.exams = [{ id: 'invalid-date', kind: 'practice', at: 9_000_000_000_000_000, duration: 20_000, passed: true, correct: 20, mistakes: 0, extraCount: 0 }]
    await expect(importProgress(db, JSON.stringify(payload))).rejects.toThrow('Некорректная резервная копия')
    expect((await readProgress(db)).exams).toEqual([])
    expect(shortDate(payload.exams[0].at)).toBe('Дата недоступна')
  })

  it('игнорирует действие из старой вкладки после запуска другого экзамена', async () => {
    const db = open()
    const first = createExam(bank, 'previous-exam', 100)
    const second = createExam(bank, 'new-exam', 300)
    await updateExam(db, () => first)
    await updateExam(db, current => current && quitExam(current, 200), first.id)
    await updateExam(db, () => second)
    const retained = await updateExam(db, current => current && quitExam(current, 500), first.id)
    expect(retained).toMatchObject({ id: second.id, phase: 'main' })
    expect((await readProgress(db)).exams.map(item => item.id)).toEqual([first.id])
  })

  it('сохраняет существующие ответы при добавлении таблицы перекрёстков', async () => {
    const name = crypto.randomUUID()
    const before = new Dexie(name)
    before.version(1).stores({
      attempts: 'id,questionId,at', tickets: 'id,[kind+ticket],at',
      exams: 'id,at,kind', favorites: 'questionId', sessions: 'key',
    })
    await before.table('attempts').add({ id: 'old-answer', questionId: 'abm-01-01', at: 1, correct: false, version: 'a', mode: 'ticket', option: 0, ms: 10 })
    before.close()
    const after = open(name)
    expect((await readProgress(after)).attempts.map(item => item.id)).toEqual(['old-answer'])
    expect((await readProgress(after)).junctions).toEqual([])
  })

  it('фиксирует историю только по окончании и восстанавливает дедлайн из IndexedDB', async () => {
    const db = open()
    const state = createExam(bank, 'one-exam', 100, () => 0)
    await updateExam(db, () => state)
    await updateExam(db, value => value && answerExam(value, state.main[0].id, 1, 101, 1))
    expect((await readProgress(db)).attempts).toHaveLength(0)
    db.close()
    const restored = open(db.name)
    const saved = (await restored.sessions.get('exam'))?.value
    expect(saved).toMatchObject({ deadline: state.deadline, answers: { [state.main[0].id]: { option: 1 } } })
    await updateExam(restored, value => value && answerExam(value, state.main[1].id, 1, 102, 1))
    await updateExam(restored, value => value)
    expect((await readProgress(restored)).exams).toHaveLength(1)
    expect((await readProgress(restored)).attempts).toHaveLength(2)
  })
})
