import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { abmQuestionId, parseAbmSource, parseOfficialBank, type OfficialBank } from '../src/domain/bank'
import {
  ABM_ASSET_DIR,
  ABM_BANK_FILE,
  isInvokedDirectly,
  readAbmAnswerKey,
  readAbmAsset,
  readAbmJson,
  reportAbmCliError,
  verifyAbmAnswers,
} from './validate-bank'

type ImportOptions = {
  input: string
  answers: string
  assets?: string
  publicDir?: string
}

async function writeAtomically(file: string, contents: Buffer | string): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, contents, { flag: 'wx' })
    await rename(temporary, file)
  } catch (cause) {
    await rm(temporary, { force: true }).catch(() => {})
    throw new Error(`Не удалось записать файл ${file}.`, { cause })
  }
}

export async function importAbm({ input, answers, assets, publicDir = 'public' }: ImportOptions): Promise<OfficialBank> {
  const { value } = await readAbmJson(input)
  const source = parseAbmSource(value)
  const { key, hash } = await readAbmAnswerKey(answers)
  verifyAbmAnswers(source, key)

  const imageRoot = assets ?? dirname(resolve(input))
  const images = new Map<string, Awaited<ReturnType<typeof readAbmAsset>>>()
  for (const question of source.questions) {
    if (question.image && !images.has(question.image)) {
      images.set(question.image, await readAbmAsset(imageRoot, question.image))
    }
  }

  const bank = parseOfficialBank({
    ...source,
    kind: 'official',
    provenance: { ...source.provenance, answerKey: { source: key.source, sha256: hash } },
    questions: source.questions.map(({ image, ...question }) => ({
      ...question,
      id: abmQuestionId(question.ticket, question.position),
      image: image ? images.get(image)!.publicPath : undefined,
    })),
  })

  const bankFile = resolve(publicDir, ABM_BANK_FILE)
  try {
    await mkdir(dirname(bankFile), { recursive: true })
    if (images.size) await mkdir(resolve(publicDir, ABM_ASSET_DIR), { recursive: true })
  } catch (cause) {
    throw new Error('Не удалось создать папку для комплекта АВМ.', { cause })
  }

  for (const { publicPath, bytes } of images.values()) {
    await writeAtomically(resolve(publicDir, publicPath.slice(1)), bytes)
  }
  await writeAtomically(bankFile, `${JSON.stringify(bank, null, 2)}\n`)
  return bank
}

async function runImportCli() {
  const usage = 'npm run import:abm -- --input <комплект.json> --answers <ключ.json> [--assets <папка>]'
  try {
    const { values } = parseArgs({ options: {
      input: { type: 'string' },
      answers: { type: 'string' },
      assets: { type: 'string' },
      help: { type: 'boolean' },
    } })
    if (values.help) {
      console.log(usage)
      return
    }
    if (!values.input || !values.answers) throw new Error(`Укажите комплект и независимый ключ ответов. ${usage}`)

    const bank = await importAbm({ input: values.input, answers: values.answers, assets: values.assets })
    console.log(`Импортировано ${bank.questions.length} вопросов редакции ${bank.version} в public/${ABM_BANK_FILE}.`)
  } catch (error) {
    reportAbmCliError(error, usage)
  }
}

if (isInvokedDirectly(import.meta.url)) await runImportCli()
