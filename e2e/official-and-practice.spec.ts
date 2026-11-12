import { expect, test } from '@playwright/test'
import { ABM_QUESTION_COUNT, ABM_QUESTIONS_PER_TICKET, abmQuestionId } from '../src/domain/abm-positions'
import type { OfficialBank } from '../src/domain/bank'
import { practiceBank } from '../src/domain/practice-bank'

const syntheticBank: OfficialBank = {
  kind: 'official',
  category: 'ABM',
  version: 'synthetic-browser-fixture',
  source: 'https://example.invalid/test-questions',
  provenance: {
    publisher: 'Синтетические данные браузерного теста',
    editionDate: '2026-01-01',
    checkedAt: '2026-01-01',
    rights: { terms: 'Синтетические данные для теста интерфейса.', evidence: 'Тестовый набор.' },
    answerKey: { source: 'https://example.invalid/test-key', sha256: '0'.repeat(64) },
  },
  questions: Array.from({ length: ABM_QUESTION_COUNT }, (_, index) => {
    const ticket = Math.floor(index / ABM_QUESTIONS_PER_TICKET) + 1
    const position = index % ABM_QUESTIONS_PER_TICKET + 1
    return {
      id: abmQuestionId(ticket, position),
      ticket,
      position,
      text: `Синтетический вопрос ABM ${ticket}.${position}`,
      options: ['Первый тестовый вариант', 'Второй тестовый вариант'],
      correct: 0,
      topic: 'Тестовая тема',
    }
  }),
}

test.use({ serviceWorkers: 'block' })
test.beforeEach(async ({ context }) => {
  await context.route('**/bank/abm.json', route => route.fulfill({ json: syntheticBank }))
})

test('подключённый комплект оставляет авторские билеты и тренировку отдельно', async ({ page }) => {
  await page.goto('./#/bilety')
  await expect(page.getByRole('button', { name: 'Билет 40', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: /^Билет \d+$/ })).toHaveCount(40)
  const sources = page.getByRole('navigation', { name: 'Комплект билетов' })
  await expect(sources.getByRole('link', { name: 'Авторская практика' })).toBeVisible()
  await sources.getByRole('link', { name: 'Авторская практика' }).click()

  await expect(page.getByRole('button', { name: /^Учебный билет \d+$/ })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Билет 40', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Учебный экзамен', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Учебный билет 1', exact: true }).click()
  const first = practiceBank.questions[0]
  await expect(page.getByRole('heading', { name: first.text })).toBeVisible()
  await page.getByRole('button', { name: first.options[first.correct], exact: true }).click()
  await expect(page.getByText('Верно!', { exact: true })).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Билеты', exact: true }).click()
  await expect(sources.getByRole('link', { name: 'Авторская практика' })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('button', { name: 'Тренировка на 10 минут', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Тренировка на 10 минут' })).toBeVisible()
  const text = await page.locator('.question-content h2').textContent()
  expect(practiceBank.questions.some(question => question.text === text)).toBe(true)
  await page.getByRole('link', { name: 'Прогресс', exact: true }).click()
  await expect(page.getByLabel('0 из 800 официальных вопросов')).toBeVisible()
  await page.getByRole('navigation', { name: 'Комплект для статистики' }).getByRole('link', { name: 'Авторская практика' }).click()
  await expect(page.getByText('1 из 40', { exact: true })).toBeVisible()
})

test('можно выбрать оба экзамена после установки комплекта ABM', async ({ page }) => {
  await page.goto('./#/ekzamen')
  await expect(page.getByRole('heading', { name: 'Экзамен ABM', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Комплект экзамена' }).getByRole('link', { name: 'Учебный экзамен' }).click()
  await expect(page.getByRole('heading', { name: 'Учебный экзамен', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Начать экзамен', exact: true }).click()
  await expect(page.getByText('Авторская практика', { exact: true })).toBeVisible()
  const authored = await page.locator('.exam-question h2').textContent()
  expect(practiceBank.questions.some(question => question.text === authored)).toBe(true)

  const finish = async () => {
    await page.getByRole('button', { name: 'Завершить экзамен' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Завершить', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'НЕ СДАЛ' })).toBeVisible()
  }
  await finish()
  await page.getByRole('button', { name: 'Экзамен ABM', exact: true }).click()
  await expect(page.getByRole('heading', { name: /^Синтетический вопрос ABM/ })).toBeVisible()
  await finish()
  await expect(page.getByRole('button', { name: 'Учебный экзамен', exact: true })).toBeVisible()
})
