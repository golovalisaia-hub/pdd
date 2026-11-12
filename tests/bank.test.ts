import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { parseOfficialBank, type Question } from '../src/domain/bank'
import { importAbm } from '../scripts/import-abm'
import { validateAbm } from '../scripts/validate-bank'

const sourceUrl = 'https://example.org/official-abm'
const keyUrl = 'https://example.net/answer-key'
const hash = 'a'.repeat(64)

function makeBank() {
  const questions: Question[] = []
  for (let ticket = 1; ticket <= 40; ticket += 1) {
    for (let position = 1; position <= 20; position += 1) {
      questions.push({
        id: `abm-${String(ticket).padStart(2, '0')}-${String(position).padStart(2, '0')}`,
        ticket,
        position,
        text: `Тестовая запись ${ticket}.${position}`,
        options: ['Первый вариант', 'Второй вариант'],
        correct: 1,
        topic: 'Тестовая тема',
      })
    }
  }

  return {
    kind: 'official',
    category: 'ABM',
    version: 'test-release',
    source: sourceUrl,
    provenance: {
      publisher: 'Издатель тестового набора',
      editionDate: '2026-10-01',
      checkedAt: '2026-11-11',
      rights: { terms: 'Тестовое разрешение', evidence: 'Номер тестового документа' },
      answerKey: { source: keyUrl, sha256: hash },
    },
    questions,
  }
}

describe('проверка готовой базы АВМ', () => {
  it('возвращает все вопросы в порядке билетов и позиций', () => {
    const bank = makeBank()
    bank.questions.reverse()
    const parsed = parseOfficialBank(bank)

    expect(parsed.questions).toHaveLength(800)
    expect(parsed.questions[0]?.id).toBe('abm-01-01')
    expect(parsed.questions[799]?.id).toBe('abm-40-20')
    expect(parsed.source).toBe(sourceUrl)
  })

  it('отклоняет неполный комплект', () => {
    const bank = makeBank()
    bank.questions.pop()
    expect(() => parseOfficialBank(bank)).toThrow(/800/)
  })

  it('отклоняет повтор позиции, даже когда записей 800', () => {
    const bank = makeBank()
    bank.questions[1] = { ...bank.questions[0]! }
    expect(() => parseOfficialBank(bank)).toThrow(/повтор.+abm-01-01/i)
  })

  it('отклоняет идентификатор от другого билета', () => {
    const bank = makeBank()
    bank.questions[0]!.id = 'abm-40-20'
    expect(() => parseOfficialBank(bank)).toThrow(/abm-01-01/)
  })

  it('отклоняет правильный ответ вне списка вариантов', () => {
    const bank = makeBank()
    bank.questions[0]!.correct = 2
    expect(() => parseOfficialBank(bank)).toThrow(/правильного ответа/i)
  })

  it('отклоняет одинаковые варианты ответа после нормализации пробелов', () => {
    const bank = makeBank()
    bank.questions[0]!.options = ['Первый вариант', ' Первый  вариант ']
    expect(() => parseOfficialBank(bank)).toThrow(/вариант.+повтор/i)
  })

  it('отклоняет внешний адрес иллюстрации', () => {
    const bank = makeBank()
    bank.questions[0]!.image = 'https://example.org/picture.png'
    expect(() => parseOfficialBank(bank)).toThrow(/иллюстрац/i)
  })

  it('требует документ об условиях использования', () => {
    const bank = makeBank()
    bank.provenance.rights.evidence = ' '
    expect(() => parseOfficialBank(bank)).toThrow(/evidence/)
  })

  it('отклоняет дату проверки до даты редакции', () => {
    const bank = makeBank()
    bank.provenance.checkedAt = '2026-09-30'
    expect(() => parseOfficialBank(bank)).toThrow(/дата проверки/i)
  })
})

function makeImportInputs() {
  const { category, version, source, provenance, questions } = makeBank()
  const { publisher, editionDate, checkedAt, rights } = provenance
  const pack = {
    category,
    version,
    source,
    provenance: { publisher, editionDate, checkedAt, rights },
    questions: questions.map(({ id: _id, ...question }) => question),
  }
  const answers = {
    category,
    version,
    editionDate,
    source: keyUrl,
    answers: questions.map(({ ticket, position }) => ({
      ticket, position, correct: 1, answer: 'Второй вариант', hasImage: false,
    })),
  }
  return { pack, answers }
}

async function withImportFiles(run: (files: {
  root: string
  input: string
  key: string
  publicDir: string
  bankFile: string
  writeInputs: () => Promise<void>
} & ReturnType<typeof makeImportInputs>) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'pdd-bank-test-'))
  const input = join(root, 'pack.json')
  const key = join(root, 'answers.json')
  const publicDir = join(root, 'public')
  const bankFile = join(publicDir, 'bank', 'abm.json')
  const { pack, answers } = makeImportInputs()
  const writeInputs = async () => {
    await writeFile(input, JSON.stringify(pack))
    await writeFile(key, JSON.stringify(answers))
  }

  try {
    await run({ root, input, key, publicDir, bankFile, pack, answers, writeInputs })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('импорт и повторная проверка АВМ', () => {
  it('сохраняет комплект, проверенную иллюстрацию и контрольную сумму независимого ключа', async () => {
    await withImportFiles(async ({ root, input, key, publicDir, pack, answers, writeInputs }) => {
      pack.questions[0]!.image = 'example.png'
      answers.answers[0]!.hasImage = true
      const image = await sharp({ create: { width: 2, height: 3, channels: 3, background: '#265e5a' } })
        .png().toBuffer()
      await writeFile(join(root, 'example.png'), image)
      await writeInputs()

      await importAbm({ input, answers: key, publicDir })
      const bank = await validateAbm(publicDir, key)
      const imageHash = createHash('sha256').update(image).digest('hex')

      expect(bank?.questions[0]?.image).toBe(`/bank/abm-assets/${imageHash}.png`)
      expect(await readFile(join(publicDir, 'bank', 'abm-assets', `${imageHash}.png`))).toEqual(image)
      expect(bank?.provenance.answerKey.sha256).toBe(createHash('sha256').update(await readFile(key)).digest('hex'))
    })
  })

  it('сохраняет прежнюю базу, если ответ в новой редакции расходится с ключом', async () => {
    await withImportFiles(async ({ input, key, publicDir, bankFile, answers, writeInputs }) => {
      await writeInputs()
      await importAbm({ input, answers: key, publicDir })
      const previous = await readFile(bankFile)

      answers.answers[0]!.correct = 0
      await writeInputs()
      await expect(importAbm({ input, answers: key, publicDir })).rejects.toThrow(/abm-01-01.+ответ/i)
      expect(await readFile(bankFile)).toEqual(previous)
    })
  })

  it('отклоняет ответ с правильным индексом, когда формулировка в ключе другая', async () => {
    await withImportFiles(async ({ input, key, publicDir, answers, writeInputs }) => {
      answers.answers[0]!.answer = 'Первый вариант'
      await writeInputs()

      await expect(importAbm({ input, answers: key, publicDir })).rejects.toThrow(/abm-01-01.+ответ/i)
    })
  })

  it('отклоняет ключ с тем же адресом источника', async () => {
    await withImportFiles(async ({ input, key, publicDir, answers, writeInputs }) => {
      answers.source = `${sourceUrl}/#answers`
      await writeInputs()

      await expect(importAbm({ input, answers: key, publicDir })).rejects.toThrow(/независим/i)
    })
  })

  it('принимает реквизиты независимого ключа, полученного отдельным документом', async () => {
    await withImportFiles(async ({ input, key, publicDir, answers, writeInputs }) => {
      answers.source = 'Отдельный лист ответов к тестовой редакции, документ № 42'
      await writeInputs()

      await importAbm({ input, answers: key, publicDir })
      const bank = await validateAbm(publicDir, key)
      expect(bank?.provenance.answerKey.source).toBe('Отдельный лист ответов к тестовой редакции, документ № 42')
    })
  })

  it('отклоняет комплект, в котором отсутствует предусмотренная ключом иллюстрация', async () => {
    await withImportFiles(async ({ input, key, publicDir, answers, writeInputs }) => {
      answers.answers[0]!.hasImage = true
      await writeInputs()

      await expect(importAbm({ input, answers: key, publicDir })).rejects.toThrow(/abm-01-01.+иллюстрац/i)
    })
  })

  it('отклоняет усечённое изображение с распознаваемым заголовком', async () => {
    await withImportFiles(async ({ root, input, key, publicDir, pack, answers, writeInputs }) => {
      pack.questions[0]!.image = 'broken.png'
      answers.answers[0]!.hasImage = true
      const image = await sharp({ create: { width: 50, height: 30, channels: 3, background: '#265e5a' } })
        .png().toBuffer()
      const truncated = image.subarray(0, image.indexOf('IDAT') + 8)
      expect((await sharp(truncated).metadata()).width).toBe(50)
      await writeFile(join(root, 'broken.png'), truncated)
      await writeInputs()

      await expect(importAbm({ input, answers: key, publicDir })).rejects.toThrow(/иллюстрац.+broken\.png/i)
    })
  })

  it('отклоняет выход за пределы папки иллюстраций через относительный путь', async () => {
    await withImportFiles(async ({ input, key, publicDir, pack, answers, writeInputs }) => {
      pack.questions[0]!.image = '../outside.png'
      answers.answers[0]!.hasImage = true
      await writeInputs()

      await expect(importAbm({ input, answers: key, publicDir })).rejects.toThrow(/относительный путь/i)
    })
  })

  it('при проверке обнаруживает подмену независимого ключа', async () => {
    await withImportFiles(async ({ input, key, publicDir, writeInputs }) => {
      await writeInputs()
      await importAbm({ input, answers: key, publicDir })
      await writeFile(key, `${await readFile(key, 'utf8')}\n`)

      await expect(validateAbm(publicDir, key)).rejects.toThrow(/контрольная сумма ключа/i)
    })
  })

  it('при проверке обнаруживает замену иллюстрации другим читаемым файлом', async () => {
    await withImportFiles(async ({ root, input, key, publicDir, pack, answers, writeInputs }) => {
      pack.questions[0]!.image = 'example.png'
      answers.answers[0]!.hasImage = true
      await sharp({ create: { width: 2, height: 3, channels: 3, background: '#265e5a' } })
        .png().toFile(join(root, 'example.png'))
      await writeInputs()
      const bank = await importAbm({ input, answers: key, publicDir })
      const imageFile = join(publicDir, bank.questions[0]!.image!.slice(1))
      await sharp({ create: { width: 2, height: 3, channels: 3, background: '#ffffff' } })
        .png().toFile(imageFile)

      await expect(validateAbm(publicDir, key)).rejects.toThrow(/контрольная сумма иллюстрации/i)
    })
  })

  it('разрешает учебный режим без комплекта и требует ключ при установленном комплекте', async () => {
    await withImportFiles(async ({ input, key, publicDir, writeInputs }) => {
      await expect(validateAbm(publicDir)).resolves.toBeNull()
      await writeInputs()
      await importAbm({ input, answers: key, publicDir })

      await expect(validateAbm(publicDir)).rejects.toThrow(/--answers/)
    })
  })
})
