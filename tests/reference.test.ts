import { describe, expect, it } from 'vitest'
import { referenceByCode } from '../src/domain/reference'
import { practiceBank } from '../src/domain/practice-bank'
import { junctionScenarios } from '../src/features/junctions/scenarios'

describe('справочные ссылки и авторские задания', () => {
  it('отличает номера пунктов от знаков и номер кругового движения', () => {
    expect(referenceByCode('п. 13.11.')?.title).toBe('Помеха справа и трамвай')
    expect(referenceByCode('13.11.1')?.title).toBe('Въезд на круг')
    expect(referenceByCode('п. 3.1')?.title).toBe('Спецсигналы и преимущество')
    expect(referenceByCode('3.1')?.title).toBe('Въезд запрещён')
  })

  it('содержит ссылки для каждого учебного вопроса и две полные группы билетов', () => {
    expect(practiceBank.questions).toHaveLength(40)
    expect(new Set(practiceBank.questions.map(q => q.id)).size).toBe(40)
    for (const ticket of [1, 2]) {
      expect(practiceBank.questions.filter(q => q.ticket === ticket).map(q => q.position)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    }
    for (const q of practiceBank.questions) {
      expect(q.options[q.correct]).toBeTruthy()
      expect(q.rules?.every(rule => referenceByCode(rule))).toBe(true)
    }
  })

  it('содержит все пункты, используемые в разборах перекрёстков', () => {
    const ids = new Set(junctionScenarios.flatMap(scenario => scenario.rules.map(rule => rule.id)))
    for (const id of ids) expect(referenceByCode(id === '3.1' ? 'п. 3.1' : id), id).toBeDefined()
  })
})
