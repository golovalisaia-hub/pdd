import { describe, expect, it } from 'vitest'
import { referenceByCode, ruleLink } from '../src/domain/reference'
import { practiceBank } from '../src/domain/practice-bank'
import { junctionScenarios } from '../src/features/junctions/scenarios'

describe('справочные ссылки и авторские задания', () => {
  it('отличает номера пунктов от знаков и номер кругового движения', () => {
    expect(referenceByCode('п. 13.11.')?.title).toBe('Помеха справа и трамвай')
    expect(referenceByCode('13.11.1')?.title).toBe('Въезд на круг')
    expect(referenceByCode('п. 3.1')?.title).toBe('Спецсигналы и преимущество')
    expect(referenceByCode('3.1')?.title).toBe('Въезд запрещён')
  })

  it('открывает карточку для знакомого знака и нужный раздел для нового пункта', () => {
    expect(ruleLink('знак 2.1')).toEqual({ label: 'Знак 2.1', href: '#/spravochnik?pravilo=2.1' })
    expect(ruleLink('п. 2.1')).toMatchObject({ label: 'ПДД, п. 2.1', href: expect.stringContaining('a4b879c') })
    expect(ruleLink('20.3')).toMatchObject({ label: 'ПДД, п. 20.3', href: expect.stringContaining('882fa5c') })
    expect(ruleLink('разметка 1.18')).toMatchObject({ label: 'Разметка 1.18', href: expect.stringContaining('b941a8c') })
    expect(ruleLink('табличка 8.2.3')).toMatchObject({ label: 'Табличка 8.2.3', href: expect.stringContaining('d507c672') })
  })

  it('сохраняет исходные номера и содержит семь полных учебных билетов', () => {
    expect(practiceBank.questions).toHaveLength(140)
    expect(practiceBank.version).toBe('pdd-2026.11.11')
    expect(new Set(practiceBank.questions.map(q => q.id)).size).toBe(140)
    expect(new Set(practiceBank.questions.map(q => q.text.trim())).size).toBe(140)
    for (const ticket of [1, 2, 3, 4, 5, 6, 7]) {
      expect(practiceBank.questions.filter(q => q.ticket === ticket).map(q => q.position)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    }
    for (const q of practiceBank.questions) {
      expect(q.id).toBe(`pdd-${q.ticket}-${q.position}`)
      expect(q.options[q.correct]).toBeTruthy()
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.explanation).toBeTruthy()
      expect(q.simple).toBeTruthy()
      expect(q.rules?.length).toBeGreaterThan(0)
      for (const rule of q.rules ?? []) expect(ruleLink(rule).href, rule).toMatch(/^(?:#\/spravochnik\?|https:\/\/www\.consultant\.ru\/)/)
    }
  })

  it('содержит все пункты, используемые в разборах перекрёстков', () => {
    const ids = new Set(junctionScenarios.flatMap(scenario => scenario.rules.map(rule => rule.id)))
    for (const id of ids) expect(referenceByCode(id === '3.1' ? 'п. 3.1' : id), id).toBeDefined()
  })
})
