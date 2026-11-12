import { describe, expect, it } from 'vitest'
import { evaluateAnswer, getOrderExamples, type JunctionAnswer } from '../src/features/junctions/model'
import { junctionScenarios } from '../src/features/junctions/scenarios'

const expectedAnswers = {
  'right-hand-cross': { kind: 'A', choice: 'b' },
  'straight-before-left': { kind: 'A', choice: 'b' },
  'priority-road': { kind: 'B', steps: [['a'], ['b']] },
  'tee-equal': { kind: 'E', choice: 'through-first' },
  'green-straight': { kind: 'D', choice: 'blue' },
  'red-and-yellow': { kind: 'D', choice: 'wait' },
  'stop-line': { kind: 'E', choice: 'roll' },
  'pedestrian-right-turn': { kind: 'C', choices: ['p'] },
  'roundabout-entry': { kind: 'A', choice: 'b' },
  'opposing-right-turns': { kind: 'B', steps: [['a', 'b']] },
  'flash-and-yield': { kind: 'C', choices: ['a', 'c'] },
  'cycle-vehicle': { kind: 'A', choice: 'b' },
  'main-bends-right': { kind: 'A', choice: 'b' },
  'secondary-bend-order': { kind: 'B', steps: [['a'], ['c'], ['b']] },
  'three-equal': { kind: 'B', steps: [['b'], ['a'], ['c']] },
  'green-left': { kind: 'C', choices: ['b'] },
  'extra-right-on-red': { kind: 'C', choices: ['b'] },
  'dark-extra-section': { kind: 'E', choice: 'turn' },
  'tram-equal': { kind: 'A', choice: 'b' },
  'tram-secondary': { kind: 'A', choice: 'b' },
  'finish-on-green': { kind: 'C', choices: ['b', 'p'] },
  'controller-sides': { kind: 'D', choice: 'side' },
  'traffic-jam': { kind: 'E', choice: 'enter' },
  'cyclist-left': { kind: 'D', choice: 'after' },
  'bending-main-all-arms': { kind: 'B', steps: [['a', 'b'], ['c'], ['d']] },
  'green-compatible-sequence': { kind: 'B', steps: [['c', 'p'], ['a', 'b']] },
  'tram-red-arrow': { kind: 'C', choices: ['b'] },
  'tram-turn-on-green': { kind: 'E', choice: 'car-first' },
  'controller-over-green': { kind: 'D', choice: 'left-side' },
  'controller-crossing': { kind: 'C', choices: ['p'] },
  'emergency-crossing': { kind: 'A', choice: 'a' },
  'amber-no-priority': { kind: 'E', choice: 'beacon-first' },
  'main-road-roundabout': { kind: 'D', choice: 'entering' },
  'raised-hand': { kind: 'A', choice: 'b' },
  'cyclist-with-tram-tracks': { kind: 'E', choice: 'cycle-left' },
  'off-signal-priority': { kind: 'B', steps: [['a', 'b'], ['c', 'd']] },
} satisfies Record<string, JunctionAnswer>

function scenario(id: keyof typeof expectedAnswers) {
  const result = junctionScenarios.find((item) => item.id === id)
  if (!result) throw new Error(`Нет задачи ${id}`)
  return result
}

describe('Банк задач на проезд перекрёстков', () => {
  it('содержит по 12 оригинальных задач каждого уровня и все пять форматов', () => {
    expect(junctionScenarios).toHaveLength(36)
    expect(new Set(junctionScenarios.map((item) => item.id)).size).toBe(36)
    expect(new Set(junctionScenarios.map((item) => item.title)).size).toBe(36)
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const level = junctionScenarios.filter((item) => item.difficulty === difficulty)
      expect(level).toHaveLength(12)
      expect(new Set(level.map((item) => item.exercise.kind))).toEqual(new Set(['A', 'B', 'C', 'D', 'E']))
    }
    expect(new Set(junctionScenarios.map((item) => item.id))).toEqual(new Set(Object.keys(expectedAnswers)))
  })

  it('содержит Т-образные, четырёхсторонние и круговые схемы и обязательные темы', () => {
    expect(new Set(junctionScenarios.map((item) => item.scene.geometry))).toEqual(new Set(['tee', 'cross', 'roundabout']))
    const topics = new Set(junctionScenarios.flatMap((item) => item.topics))
    for (const topic of [
      'Равнозначные дороги', 'Главная и второстепенная', 'Изгиб главной дороги', 'Знаки приоритета',
      'Светофор', 'Дополнительная секция', 'Трамвай', 'Пешеходы', 'Велосипедисты',
      'Круговое движение', 'Регулировщик', 'Спецсигналы', 'Поворот налево', 'Поворот направо',
      'Движение прямо', 'Т-образный перекрёсток',
    ]) expect(topics.has(topic), topic).toBe(true)
  })

  it.each(Object.entries(expectedAnswers))('сверяет решение %s с разобранной ситуацией', (id, answer) => {
    const item = scenario(id as keyof typeof expectedAnswers)
    expect(evaluateAnswer(item, answer)).toEqual({ correct: true })
    const actors = item.scene.participants.map((participant) => participant.id)
    expect(new Set(actors).size).toBe(actors.length)
    expect(item.prompt.length).toBeGreaterThan(12)
    expect(item.scene.caption.length).toBeGreaterThan(20)
    expect(item.explanation.length).toBeGreaterThan(40)
    expect(item.rules.length).toBeGreaterThan(0)
    for (const rule of item.rules) {
      expect(rule.id).toMatch(/^\d+\.\d+/)
      expect(rule.url).toMatch(/^https:\/\//)
    }

    const expectedArms = item.scene.geometry === 'tee' ? 3 : 4
    expect(new Set(item.scene.arms).size).toBe(expectedArms)
    for (const approach of item.scene.approaches ?? []) expect(item.scene.arms).toContain(approach.arm)
    for (const arm of item.scene.crossings ?? []) expect(item.scene.arms).toContain(arm)
    for (const arm of Object.keys(item.scene.pedestrianSignals ?? {})) expect(item.scene.crossings).toContain(arm)
    for (const participant of item.scene.participants) {
      if (participant.type === 'pedestrian') {
        expect(item.scene.crossings).toContain(participant.crossing)
      } else {
        expect(item.scene.arms).toContain(participant.from)
        expect(item.scene.arms).toContain(participant.to)
        if (participant.type === 'tram') {
          expect(item.scene.tramTracks).toContain(participant.from)
          expect(item.scene.tramTracks).toContain(participant.to)
        }
        if (participant.position === 'circulating') expect(item.scene.geometry).toBe('roundabout')
      }
    }

    const { exercise } = item
    if (exercise.kind === 'A') {
      expect(actors).toContain(exercise.correct)
      for (const wrong of actors.filter((id) => id !== exercise.correct)) {
        expect(evaluateAnswer(item, { kind: 'A', choice: wrong }).correct).toBe(false)
      }
    } else if (exercise.kind === 'B') {
      for (const [before, after] of [...exercise.order, ...exercise.conflicts]) {
        expect(actors).toContain(before)
        expect(actors).toContain(after)
        expect(before).not.toBe(after)
      }
      const examples = getOrderExamples(item)
      expect(examples.length).toBeGreaterThan(0)
      for (const steps of examples) expect(evaluateAnswer(item, { kind: 'B', steps }).correct).toBe(true)
      expect(evaluateAnswer(item, { kind: 'B', steps: [actors.slice(1)] }).correct).toBe(false)
    } else if (exercise.kind === 'C') {
      expect(actors).toContain(exercise.subject)
      expect(exercise.correct).not.toContain(exercise.subject)
      for (const correct of exercise.correct) expect(actors).toContain(correct)
      expect(evaluateAnswer(item, { kind: 'C', choices: [...exercise.correct, exercise.subject] }).correct).toBe(false)
    } else {
      expect(exercise.options.map((option) => option.id)).toContain(exercise.correct)
      for (const option of exercise.options) {
        if (option.sceneTarget) expect(actors).toContain(option.sceneTarget)
        expect(evaluateAnswer(item, { kind: exercise.kind, choice: option.id }).correct).toBe(option.id === exercise.correct)
      }
      if (exercise.subject) expect(actors).toContain(exercise.subject)
    }

    const animated = item.solutionSteps?.flat() ?? []
    expect(new Set(animated).size).toBe(animated.length)
    for (const id of animated) expect(actors).toContain(id)
  })
})

describe('Проверка ответов', () => {
  it('принимает совместный старт и оба последовательных порядка без пересечения путей', () => {
    const item = scenario('opposing-right-turns')
    for (const steps of [[['a', 'b']], [['b', 'a']], [['a'], ['b']], [['b'], ['a']]]) {
      expect(evaluateAnswer(item, { kind: 'B', steps }).correct).toBe(true)
    }
    expect(getOrderExamples(item)).toEqual([[['a', 'b']], [['a'], ['b']]])
  })

  it('соблюдает частичный порядок и принимает отличающуюся допустимую группировку', () => {
    const item = scenario('green-compatible-sequence')
    expect(evaluateAnswer(item, { kind: 'B', steps: [['p'], ['b', 'c'], ['a']] }).correct).toBe(true)
    expect(evaluateAnswer(item, { kind: 'B', steps: [['c', 'p'], ['b'], ['a']] }).correct).toBe(true)
    expect(evaluateAnswer(item, { kind: 'B', steps: [['c', 'a'], ['p', 'b']] }).correct).toBe(false)
    expect(evaluateAnswer(item, { kind: 'B', steps: [['a'], ['c'], ['p'], ['b']] }).correct).toBe(false)
  })

  it('разрешает самостоятельный поворот после проезда конфликтующих направлений', () => {
    const item = scenario('bending-main-all-arms')
    expect(evaluateAnswer(item, { kind: 'B', steps: [['b'], ['c'], ['d'], ['a']] }).correct).toBe(true)
    expect(evaluateAnswer(item, { kind: 'B', steps: [['b'], ['a', 'c'], ['d']] }).correct).toBe(true)
    expect(evaluateAnswer(item, { kind: 'B', steps: [['a', 'b'], ['c', 'd']] }).correct).toBe(false)
  })

  it('проверяет только фактические пересечения путей при выключенных светофорах', () => {
    const item = scenario('off-signal-priority')
    expect(evaluateAnswer(item, { kind: 'B', steps: [['a'], ['b', 'd'], ['c']] }).correct).toBe(true)
    expect(evaluateAnswer(item, { kind: 'B', steps: [['b'], ['a'], ['d', 'c']] }).correct).toBe(true)
    expect(evaluateAnswer(item, { kind: 'B', steps: [['b'], ['a', 'd'], ['c']] }).correct).toBe(false)
    expect(evaluateAnswer(item, { kind: 'B', steps: [['a'], ['b', 'c'], ['d']] }).correct).toBe(false)
  })

  it('разрешает оба порядка для пары, которую нельзя объединить в один шаг', () => {
    const item = { ...scenario('opposing-right-turns'), exercise: { kind: 'B' as const, order: [], conflicts: [['a', 'b']] as const } }
    expect(evaluateAnswer(item, { kind: 'B', steps: [['a', 'b']] }).correct).toBe(false)
    expect(evaluateAnswer(item, { kind: 'B', steps: [['a'], ['b']] }).correct).toBe(true)
    expect(evaluateAnswer(item, { kind: 'B', steps: [['b'], ['a']] }).correct).toBe(true)
    expect(getOrderExamples(item)).toEqual([[['a'], ['b']], [['b'], ['a']]])
  })

  it('отклоняет пропуски, повторы, пустые шаги и неизвестные идентификаторы', () => {
    const item = scenario('opposing-right-turns')
    for (const steps of [[['a']], [['a'], ['a']], [['a', 'b'], ['b']], [['a'], [], ['b']], [['a', 'x']]]) {
      expect(evaluateAnswer(item, { kind: 'B', steps }).correct).toBe(false)
    }
  })

  it('проверяет полный набор в произвольном порядке и отклоняет повторы', () => {
    const item = scenario('finish-on-green')
    expect(evaluateAnswer(item, { kind: 'C', choices: ['p', 'b'] }).correct).toBe(true)
    for (const choices of [['p'], ['p', 'p'], ['p', 'b', 'd'], ['p', 'unknown']]) {
      expect(evaluateAnswer(item, { kind: 'C', choices }).correct).toBe(false)
    }
    expect(evaluateAnswer(item, { kind: 'A', choice: 'b' }).correct).toBe(false)
    expect(getOrderExamples(item)).toEqual([])
  })
})
