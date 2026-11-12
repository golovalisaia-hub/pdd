import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import { z } from 'zod'
import {
  ABM_ASSET_URL,
  ABM_QUESTION_COUNT,
  ABM_TICKETS,
  abmAnswerIndex,
  abmEditionDate,
  abmPosition,
  abmQuestionId,
  abmText,
  abmTicket,
  checkAbmKeySource,
  normalizeAbmText,
  parseAbmJson,
  parseOfficialBank,
  type OfficialBank,
} from '../src/domain/bank'

export const ABM_BANK_FILE = 'bank/abm.json'
export const ABM_ASSET_DIR = ABM_ASSET_URL.slice(1)

const keySchema = z.strictObject({
  category: z.literal('ABM', { error: 'Ожидается ключ для категории ABM.' }),
  version: abmText,
  editionDate: abmEditionDate,
  source: abmText,
  answers: z.array(z.strictObject({
    ticket: abmTicket,
    position: abmPosition,
    correct: abmAnswerIndex,
    answer: abmText,
    hasImage: z.boolean({ error: 'Укажите, есть ли у вопроса иллюстрация.' }),
  })).length(ABM_QUESTION_COUNT, `В ключе должно быть ${ABM_QUESTION_COUNT} ответов.`),
})

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function readAbmJson(file: string): Promise<{ value: unknown; bytes: Buffer }> {
  let bytes: Buffer
  try {
    bytes = await readFile(file)
  } catch (cause) {
    throw new Error(`Не удалось прочитать файл ${file}.`, { cause })
  }

  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { value: JSON.parse(json), bytes }
  } catch (cause) {
    throw new Error(`Файл ${file} должен содержать корректный JSON в кодировке UTF-8.`, { cause })
  }
}

export async function readAbmAnswerKey(file: string) {
  const { value, bytes } = await readAbmJson(file)
  return { key: parseAbmJson(keySchema, value), hash: sha256(bytes) }
}

type ComparableBank = {
  source: string
  version: string
  provenance: { editionDate: string | null }
  questions: Array<{ ticket: number; position: number; correct: number; options: string[]; image?: string }>
}

export function verifyAbmAnswers(bank: ComparableBank, key: z.infer<typeof keySchema>): void {
  checkAbmKeySource(bank.source, key.source)
  if (key.version !== bank.version || key.editionDate !== bank.provenance.editionDate) {
    throw new Error('Редакция ключа ответов расходится с редакцией комплекта.')
  }

  const byPosition = new Map<string, (typeof key.answers)[number]>()
  for (const entry of key.answers) {
    const id = abmQuestionId(entry.ticket, entry.position)
    if (byPosition.has(id)) throw new Error(`Повтор позиции ${id} в ключе ответов.`)
    byPosition.set(id, entry)
  }

  for (const question of bank.questions) {
    const id = abmQuestionId(question.ticket, question.position)
    const expected = byPosition.get(id)
    if (!expected) throw new Error(`Вопрос ${id}. Ответ отсутствует в ключе.`)
    const actual = question.options[question.correct]!
    if (question.correct !== expected.correct || normalizeAbmText(actual) !== normalizeAbmText(expected.answer)) {
      throw new Error(`Вопрос ${id}. Правильный ответ расходится с независимым ключом.`)
    }
    if (Boolean(question.image) !== expected.hasImage) {
      throw new Error(`Вопрос ${id}. Наличие иллюстрации расходится с независимым ключом.`)
    }
  }
}

export async function readAbmAsset(root: string, file: string): Promise<{ publicPath: string; bytes: Buffer }> {
  try {
    const rootPath = await realpath(root)
    const fullPath = await realpath(resolve(rootPath, file))
    const withinRoot = relative(rootPath, fullPath)
    if (withinRoot === '..' || withinRoot.startsWith(`..${sep}`) || isAbsolute(withinRoot)) {
      throw new Error('Файл находится за пределами папки иллюстраций.')
    }
    if (!(await stat(fullPath)).isFile()) throw new Error('Ожидается файл.')

    const bytes = await readFile(fullPath)
    const decoder = sharp(bytes, { failOn: 'warning' })
    const { format, pages } = await decoder.metadata()
    const extension = format === 'jpeg' ? 'jpg' : format
    const fileExtension = extname(file).toLowerCase().replace(/^\.jpeg$/, '.jpg')
    if ((extension !== 'jpg' && extension !== 'png' && extension !== 'webp') ||
        fileExtension !== `.${extension}` || (pages ?? 1) > 1) {
      throw new Error('Формат изображения не соответствует расширению или файл содержит несколько кадров.')
    }
    await decoder.raw().toBuffer()
    return { publicPath: `${ABM_ASSET_URL}${sha256(bytes)}.${extension}`, bytes }
  } catch (cause) {
    throw new Error(`Не удалось прочитать или декодировать иллюстрацию ${file}.`, { cause })
  }
}

export async function validateAbm(publicDir: string, answers?: string): Promise<OfficialBank | null> {
  const bankFile = resolve(publicDir, ABM_BANK_FILE)
  let bank: OfficialBank
  try {
    const { value } = await readAbmJson(bankFile)
    bank = parseOfficialBank(value)
  } catch (error) {
    const cause = error instanceof Error ? error.cause as NodeJS.ErrnoException | undefined : undefined
    if (cause?.code === 'ENOENT' && answers === undefined) return null
    throw error
  }

  if (!answers) throw new Error('Для проверки установленной базы укажите --answers <ключ.json>.')
  const { key, hash } = await readAbmAnswerKey(answers)
  if (hash !== bank.provenance.answerKey.sha256 || key.source !== bank.provenance.answerKey.source) {
    throw new Error('Контрольная сумма ключа ответов не совпадает с записью об импорте.')
  }
  verifyAbmAnswers(bank, key)

  const checkedImages = new Set<string>()
  const assets = resolve(publicDir, ABM_ASSET_DIR)
  for (const question of bank.questions) {
    if (!question.image || checkedImages.has(question.image)) continue
    const { publicPath } = await readAbmAsset(assets, question.image.slice(ABM_ASSET_URL.length))
    if (publicPath !== question.image) {
      throw new Error(`Вопрос ${question.id}. Контрольная сумма иллюстрации не совпадает с адресом файла.`)
    }
    checkedImages.add(question.image)
  }
  return bank
}

export function isInvokedDirectly(moduleUrl: string): boolean {
  return process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === moduleUrl
}

export function reportAbmCliError(error: unknown, usage: string): void {
  const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined
  const message = code?.startsWith('ERR_PARSE_ARGS_')
    ? `Проверьте аргументы команды. ${usage}`
    : error instanceof Error ? error.message : 'Ошибка обработки комплекта АВМ.'
  console.error(message)
  process.exitCode = 1
}

async function runValidateCli() {
  const usage = 'npm run validate:bank -- [--answers <ключ.json>]'
  try {
    const { values } = parseArgs({ options: { answers: { type: 'string' }, help: { type: 'boolean' } } })
    if (values.help) {
      console.log(usage)
      return
    }

    const bank = await validateAbm('public', values.answers)
    console.log(bank
      ? `Проверено ${ABM_TICKETS} билетов, ${bank.questions.length} вопросов, ключ ответов и все указанные иллюстрации.`
      : 'Комплект АВМ отсутствует. Проверено официальных позиций: 0 из 800. Доступен режим практики.')
  } catch (error) {
    reportAbmCliError(error, usage)
  }
}

if (isInvokedDirectly(import.meta.url)) await runValidateCli()
