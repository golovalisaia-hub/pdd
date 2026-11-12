import { describe, expect, it } from 'vitest'
import { answerExam, createExam, expireExam, examItems, examRemaining, examSummary, quitExam } from '../src/domain/exam'
import type { ExamState } from '../src/domain/exam'
import type { Bank } from '../src/domain/bank'

const start = 10_000
const minute = 60_000
const bank: Bank = {
  kind: 'practice', version: 'test',
  questions: [1, 2, 3].flatMap(ticket => Array.from({ length: 20 }, (_, i) => ({
    id: `practice-${ticket}-${i + 1}`, ticket, position: i + 1, text: `Проверка ${i + 1}`,
    options: ['Верно', 'Неверно'], correct: 0, topic: 'Проверка',
  }))),
}

function fresh() {
  return createExam(bank, 'exam-test', start, () => 0)
}

function main(state: ExamState, wrong: number[] = []) {
  return state.main.reduce((value, question, i) => answerExam(value, question.id, wrong.includes(i) ? 1 : 0, start + 1000 * (i + 1), 1000), state)
}

describe('теоретический экзамен', () => {
  it('выбирает цельные блоки и неповторяющийся резерв из каждой группы', () => {
    const state = createExam(bank, 'mix', start, (() => { const values = [0, 0, .4, 0, .9, 0, 0, 0]; return () => values.shift() ?? 0 })())
    expect(state.main.map(q => q.position)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    expect(state.main.filter((_, i) => i % 5 === 0).map(q => q.ticket)).toEqual([1, 2, 3, 1])
    for (const [group, reserve] of state.reserve.entries()) {
      expect(new Set(state.main.slice(group * 5, group * 5 + 5).map(q => q.ticket)).size).toBe(1)
      expect(reserve).toHaveLength(5)
      expect(reserve.every(q => q.ticket !== state.main[group * 5].ticket)).toBe(true)
    }
  })

  it('принимает безошибочный билет', () => {
    const state = main(fresh())
    expect(state.outcome).toBe('passed')
    expect(examSummary(state)).toMatchObject({ correct: 20, mistakes: 0, extraCount: 0 })
  })

  it('ограничивает показ таймера длительностью текущего этапа при устаревшем отсчёте интерфейса', () => {
    const state = fresh()
    expect(examRemaining(state, start - 1000)).toBe(20 * minute)
    const extra = main(state, [0])
    expect(examRemaining(extra, start)).toBe(5 * minute)
    expect(examRemaining(extra, extra.deadline + 1)).toBe(0)
  })

  it.each([[6, 5], [1, 10]])('даёт дополнительное время и блоки соответствующих групп', (index, count) => {
    const state = main(fresh(), count === 5 ? [index] : [index, 16])
    expect(state.phase).toBe('extra')
    expect(state.deadline).toBe(start + 20_000 + count * minute)
    expect(examItems(state)).toHaveLength(count)
    expect(state.extra.map(q => Math.floor((q.position - 1) / 5))).toEqual(count === 5 ? Array(5).fill(1) : [...Array(5).fill(0), ...Array(5).fill(3)])
    const result = state.extra.reduce((value, q, i) => answerExam(value, q.id, 0, start + 21_000 + i, 1), state)
    expect(result.outcome).toBe('passed')
  })

  it('останавливает экзамен при двух ошибках внутри блока', () => {
    expect(main(fresh(), [0, 2])).toMatchObject({ phase: 'done', outcome: 'failed', reason: 'same-block', finishedAt: start + 3000 })
  })

  it('останавливает экзамен при трёх ошибках в разных блоках', () => {
    expect(main(fresh(), [0, 5, 10])).toMatchObject({ phase: 'done', reason: 'three-errors', finishedAt: start + 11_000 })
  })

  it('останавливает экзамен при первой ошибке в дополнительном блоке', () => {
    const state = main(fresh(), [0])
    expect(answerExam(state, state.extra[0].id, 1, start + 30_000, 1000)).toMatchObject({ outcome: 'failed', reason: 'extra-error' })
  })

  it('засчитывает пропуск и начисляет время от исходного дедлайна после обновления', () => {
    const initial = fresh()
    const partial = initial.main.slice(0, 19).reduce((state, q) => answerExam(state, q.id, 0, start + 10_000, 500), initial)
    const restored: ExamState = JSON.parse(JSON.stringify(partial))
    const state = expireExam(restored, initial.deadline + 42_000)
    expect(state).toMatchObject({ phase: 'extra', deadline: initial.deadline + 5 * minute, missedIds: [initial.main[19].id] })
    expect(expireExam(restored, initial.deadline + 6 * minute)).toMatchObject({ outcome: 'failed', reason: 'time', finishedAt: initial.deadline + 5 * minute })
  })

  it('завершает основной этап с тремя и более пропусками в момент истечения времени', () => {
    const state = fresh()
    const result = expireExam(state, state.deadline + 500_000)
    expect(result).toMatchObject({ phase: 'done', reason: 'time', finishedAt: state.deadline })
    expect(examSummary(result).mistakes).toBe(20)
  })

  it('не позволяет позднему ответу или повторному нажатию изменить зафиксированный выбор', () => {
    const state = fresh()
    const id = state.main[10].id
    const answered = answerExam(state, id, 0, start + 1, 1)
    expect(answerExam(answered, id, 1, start + 2, 1)).toBe(answered)
    expect(answerExam(state, id, 0, state.deadline, 0).answers[id]).toBeUndefined()
  })

  it('фиксирует отказ без подсчёта ещё не показанных вопросов как ошибок', () => {
    const state = quitExam(fresh(), start + 10_000)
    expect(state).toMatchObject({ outcome: 'failed', reason: 'quit' })
    expect(examSummary(state)).toMatchObject({ unanswered: 20, mistakes: 0 })
  })
})
