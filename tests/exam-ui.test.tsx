// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import ExamPage from '../src/features/exam/ExamPage'
import { createExam } from '../src/domain/exam'
import { practiceBank } from '../src/domain/practice-bank'
import type { ExamState } from '../src/domain/exam'

afterEach(cleanup)

it('сохраняет тип экзамена при повторе и помечает учебный режим отдельно', async () => {
  const state: ExamState = {
    ...createExam(practiceBank, 'old-exam', 0), kind: 'official', phase: 'done', outcome: 'passed', finishedAt: 60_000,
  }
  const onStart = vi.fn()
  const noop = () => {}
  const props = { bank: practiceBank, state, onStart, onMove: noop, onAnswer: async () => {}, onQuit: noop }
  const view = render(<ExamPage {...props} loaded={false} officialAvailable={false} />)
  expect(screen.queryByRole('button', { name: 'Повторить экзамен' })).not.toBeInTheDocument()
  expect(screen.getByText('Проверяем официальный комплект…')).toBeInTheDocument()
  view.rerender(<ExamPage {...props} loaded officialAvailable={false} />)
  await userEvent.click(screen.getByRole('button', { name: 'Учебный экзамен' }))
  expect(onStart).toHaveBeenLastCalledWith('practice')
  view.rerender(<ExamPage {...props} loaded officialAvailable />)
  await userEvent.click(screen.getByRole('button', { name: 'Повторить экзамен' }))
  expect(onStart).toHaveBeenLastCalledWith('official')
})
