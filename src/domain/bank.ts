import { z } from 'zod'
import { ru } from 'zod/locales'
import { ABM_TICKETS, ABM_QUESTIONS_PER_TICKET, ABM_QUESTION_COUNT, abmQuestionId } from './abm-positions'

export { ABM_TICKETS, ABM_QUESTIONS_PER_TICKET, ABM_QUESTION_COUNT, abmQuestionId } from './abm-positions'
export const ABM_ASSET_URL = '/bank/abm-assets/'

const excludedName = /(?:^|[^\p{L}\p{N}])[i][z][i](?=$|[^\p{L}\p{N}])/iu
const localizeError = ru().localeError
export const abmText = z.string({ error: 'Ожидается строка.' })
  .refine((value) => value.trim().length > 0, 'Поле обязательно.')
  .refine((value) => !excludedName.test(value), 'Уберите стороннее название из данных.')

export const abmSourceUrl = z.url({ protocol: /^https$/, error: 'Укажите HTTPS-адрес источника.' })
  .pipe(abmText.refine((value) => {
    const url = new URL(value)
    return !url.username && !url.password
  }, 'Адрес источника должен быть без учётных данных.'))

export const abmTicket = z.number().int().min(1).max(ABM_TICKETS)
export const abmPosition = z.number().int().min(1).max(ABM_QUESTIONS_PER_TICKET)
export const abmAnswerIndex = z.number().int().min(0).max(4)
export const abmEditionDate = z.iso.date({ error: 'Укажите действительную дату редакции в формате ГГГГ-ММ-ДД.' }).nullable()

const questionContent = z.strictObject({
  ticket: abmTicket,
  position: abmPosition,
  text: abmText,
  options: z.array(abmText).min(2, 'Нужно от двух до пяти вариантов ответа.')
    .max(5, 'Нужно от двух до пяти вариантов ответа.'),
  correct: abmAnswerIndex,
  topic: abmText,
  explanation: abmText.optional(),
  simple: abmText.optional(),
  rules: z.array(abmText).optional(),
})

const localImagePath = abmText.refine((value) =>
  /\.(?:jpe?g|png|webp)$/i.test(value) && value.split('/').every((segment) =>
    segment !== '' && segment !== '.' && segment !== '..' && !/[\\:*?"<>|#\x00-\x1f]/u.test(segment)),
'Укажите относительный путь к иллюстрации JPG, PNG или WebP.')

const officialImagePath = z.string().refine((value) =>
  value.startsWith(ABM_ASSET_URL) && /^[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(value.slice(ABM_ASSET_URL.length)),
'Некорректный локальный адрес иллюстрации.')

const officialQuestion = questionContent.extend({ id: abmText, image: officialImagePath.optional() })
const sourceQuestion = questionContent.extend({ image: localImagePath.optional() })

export type Question = z.infer<typeof officialQuestion>

export type Bank = {
  kind: 'official' | 'practice'
  version: string
  questions: Question[]
  source?: string
}

const provenanceFields = z.strictObject({
  publisher: abmText,
  editionDate: abmEditionDate,
  checkedAt: z.iso.date({ error: 'Укажите действительную дату проверки в формате ГГГГ-ММ-ДД.' }),
  rights: z.strictObject({ terms: abmText, evidence: abmText }),
})

const bankFields = z.strictObject({
  category: z.literal('ABM', { error: 'Ожидается категория ABM.' }),
  version: abmText,
  source: abmSourceUrl,
})

const quantityError = `Требуется ${ABM_TICKETS} билетов по ${ABM_QUESTIONS_PER_TICKET} вопросов, всего ${ABM_QUESTION_COUNT}.`

const sourceBank = bankFields.extend({
  provenance: provenanceFields,
  questions: z.array(sourceQuestion).length(ABM_QUESTION_COUNT, quantityError),
})

const officialBank = bankFields.extend({
  kind: z.literal('official', { error: 'Ожидается официальный комплект.' }),
  provenance: provenanceFields.extend({
    answerKey: z.strictObject({
      source: abmText,
      sha256: z.string().regex(/^[a-f0-9]{64}$/, 'Некорректная контрольная сумма ключа ответов.'),
    }),
  }),
  questions: z.array(officialQuestion).length(ABM_QUESTION_COUNT, quantityError),
})

export type OfficialBank = z.infer<typeof officialBank>

export function normalizeAbmText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ')
}

export function checkAbmKeySource(source: string, keySource: string): void {
  const documentUrl = (value: string) => {
    try {
      const url = new URL(value)
      url.searchParams.sort()
      return `${url.origin}${url.pathname.replace(/\/$/u, '')}${url.search}`
    } catch {
      return value.trim()
    }
  }
  if (documentUrl(source) === documentUrl(keySource)) {
    throw new Error('Укажите независимый источник ключа ответов.')
  }
}

export function parseAbmJson<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input, { error: localizeError })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!
    const field = issue.path.join('.')
    throw new Error(field ? `Поле ${field}. ${issue.message}` : issue.message)
  }
  return parsed.data
}

function checkAbmQuestions(bank: z.infer<typeof sourceBank> | OfficialBank): void {
  if (bank.provenance.editionDate !== null && bank.provenance.checkedAt < bank.provenance.editionDate) {
    throw new Error('Дата проверки предшествует дате редакции.')
  }

  const positions = new Set<string>()
  for (const question of bank.questions) {
    const id = abmQuestionId(question.ticket, question.position)
    if ('id' in question && question.id !== id) {
      throw new Error(`Идентификатор ${question.id} не соответствует позиции ${id}.`)
    }
    if (positions.has(id)) throw new Error(`Повтор позиции ${id}.`)
    if (question.correct >= question.options.length) {
      throw new Error(`Вопрос ${id}. Индекс правильного ответа выходит за пределы списка.`)
    }
    if (new Set(question.options.map(normalizeAbmText)).size !== question.options.length) {
      throw new Error(`Вопрос ${id}. Варианты ответа повторяются.`)
    }
    positions.add(id)
  }
  bank.questions.sort((first, second) => first.ticket - second.ticket || first.position - second.position)
}

export function parseAbmSource(input: unknown) {
  const bank = parseAbmJson(sourceBank, input)
  checkAbmQuestions(bank)
  return bank
}

export function parseOfficialBank(input: unknown): OfficialBank {
  const bank = parseAbmJson(officialBank, input)
  checkAbmKeySource(bank.source, bank.provenance.answerKey.source)
  checkAbmQuestions(bank)
  return bank
}
