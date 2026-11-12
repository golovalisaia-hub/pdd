import { expect, test } from '@playwright/test'
import type { OfficialBank } from '../src/domain/bank'

test('публикует 40 билетов и открывает исходную иллюстрацию без сети', async ({ page, context, baseURL }, testInfo) => {
  test.setTimeout(120_000)
  const bankUrl = new URL('bank/abm.json', baseURL)
  const response = await page.request.get(bankUrl.href)
  test.skip(!response.ok() || !response.headers()['content-type']?.includes('json'), 'В локальной сборке нет ведомственного комплекта')
  const bank: OfficialBank = await response.json()
  expect(bank.questions).toHaveLength(800)
  expect(new Set(bank.questions.map(question => question.ticket)).size).toBe(40)
  const illustrated = bank.questions.find(question => question.ticket === 1 && question.image)!
  expect(illustrated?.image).toBeTruthy()

  await page.goto('./#/bilety')
  await page.getByRole('button', { name: 'Билет 1', exact: true }).click()
  await expect(page.getByText(bank.questions[0]!.text, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Вопрос ' + illustrated.position, exact: true }).click()
  await expect(page.getByRole('heading', { name: illustrated.text, exact: true })).toBeInViewport({ ratio: 1 })
  const image = page.getByRole('img', { name: 'Иллюстрация к вопросу' })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
  await expect(image).toHaveAttribute('src', new URL(illustrated.image!.slice(1), baseURL).pathname)
  await page.screenshot({ path: testInfo.outputPath('official-question.png') })

  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 90_000 }).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText(illustrated.text, { exact: true })).toBeVisible()
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
  await page.getByRole('button', { name: illustrated.options[illustrated.correct], exact: true }).click()
  await expect(page.getByText('Верно!', { exact: true })).toBeVisible()
  expect(illustrated.explanation).toBeTruthy()
  await expect(page.getByText(illustrated.explanation!, { exact: true })).toBeVisible()
})
