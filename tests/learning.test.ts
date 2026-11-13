import { describe, expect, it } from 'vitest'
import { questionStats, choosePractice, learningSummary, weakTopics } from '../src/domain/learning'
import type { Attempt } from '../src/domain/learning'
import type { Question } from '../src/domain/bank'

const now = 1_700_000_000_000
const questions: Question[] = ['А', 'Б', 'В'].map((topic, i) => ({
  id: 'abm-01-0' + (i + 1), ticket: 1, position: i + 1, text: topic, options: ['Да', 'Нет'], correct: 0, topic,
}))
const attempt = (id: string, questionId: string, correct: boolean, at = now): Attempt => ({
  id, questionId, correct, at, option: correct ? 0 : 1, version: 'test', mode: 'ticket', ms: 200,
})

describe('прогресс обучения', () => {
  it('сохраняет историю трудностей после одного верного ответа', () => {
    const stats = questionStats([attempt('1', questions[0].id, false), attempt('2', questions[0].id, true, now + 10)])
    expect(stats.get(questions[0].id)).toMatchObject({ total: 2, wrong: 1, streak: 1, mastered: false })
    expect(stats.get(questions[0].id)!.dueAt).toBeGreaterThan(now + 10)
  })

  it('считает уникальные вопросы и точность первых ответов независимо от автора', () => {
    const history = [attempt('1', questions[0].id, false), attempt('2', questions[0].id, true), attempt('3', questions[1].id, true),
      attempt('4', 'pdd-01-01', true)]
    expect(learningSummary(questions, history)).toEqual({ studied: 2, mastered: 0, accuracy: 67, firstAccuracy: 50, attempts: 3 })
  })

  it('использует реальные ошибки и срок повторения в подборе практики', () => {
    const history = [attempt('1', questions[1].id, false), attempt('2', questions[2].id, true)]
    expect(weakTopics(questions, history).map(topic => topic.name)).toEqual(['Б'])
    expect(choosePractice(questions, history, now).map(question => question.topic)).toEqual(['Б', 'А', 'В'])
    expect(weakTopics(questions, []).length).toBe(0)
  })

  it('перемешивает вопросы равного приоритета, сохраняя ошибки в начале подборки', () => {
    const history = [attempt('1', questions[1].id, false)]
    const ordered = [0.1, 0.8, 0.9].values()
    const reversed = [0.9, 0.8, 0.1].values()
    expect(choosePractice(questions, history, now, 2, () => ordered.next().value ?? 0)).toEqual([questions[1], questions[0]])
    expect(choosePractice(questions, history, now, 2, () => reversed.next().value ?? 0)).toEqual([questions[1], questions[2]])
  })
})
