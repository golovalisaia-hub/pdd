export type Direction = 'n' | 'e' | 's' | 'w'
export type SceneGeometry = 'cross' | 'tee' | 'roundabout'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type VehicleType = 'car' | 'truck' | 'tram' | 'bicycle' | 'emergency'

export const difficultyLabels = { easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный' } satisfies Record<Difficulty, string>

type RoadUser = { id: string; label: string; color: string; details?: string }

export type VehicleParticipant = RoadUser & {
  type: VehicleType
  from: Direction
  to: Direction
  position?: 'approach' | 'circulating' | 'inside' | 'queued'
  beacon?: 'blue' | 'blue-red' | 'amber'
  siren?: boolean
}

export type PedestrianParticipant = RoadUser & {
  type: 'pedestrian'
  crossing: Direction
  fromSide: 'left' | 'right'
  position?: 'crossing' | 'finishing'
}

export type Participant = VehicleParticipant | PedestrianParticipant

export type SignalColor = 'red' | 'yellow' | 'green' | 'red-yellow' | 'flashing-yellow' | 'off'
export type Signal = {
  main: SignalColor
  arrow?: { direction: 'left' | 'right' | 'straight'; lit: boolean }
}

export type RoadSign = '2.1' | '2.4' | '2.5' | '4.3'
export type Approach = {
  arm: Direction
  signs?: readonly RoadSign[]
  signal?: Signal
  stopLine?: boolean
  yieldLine?: boolean
}

export type JunctionScene = {
  geometry: SceneGeometry
  arms: readonly Direction[]
  mainRoad?: readonly Direction[]
  tramTracks?: readonly Direction[]
  participants: readonly Participant[]
  approaches?: readonly Approach[]
  crossings?: readonly Direction[]
  pedestrianSignals?: Partial<Record<Direction, 'green' | 'red'>>
  controller?: { facing: Direction; gesture: 'arms-down' | 'right-forward' | 'arm-up' }
  blockedExit?: Direction
  circulatingYieldAt?: Direction
  caption: string
}

export type RuleReference = { id: string; label: string; url: string }

export type OrderExercise = {
  kind: 'B'
  /** The first participant in each pair must finish before the second starts. */
  order: readonly (readonly [string, string])[]
  /** These participants can go in either order, with separate steps. */
  conflicts: readonly (readonly [string, string])[]
}

export type ExerciseOption = { id: string; label: string; sceneTarget?: string }

export type JunctionExercise =
  | { kind: 'A'; correct: string }
  | OrderExercise
  | { kind: 'C'; subject: string; correct: readonly string[] }
  | { kind: 'D' | 'E'; subject?: string; options: readonly ExerciseOption[]; correct: string }

export const exerciseLabels = {
  A: 'Кто проедет первым',
  B: 'Очередность проезда',
  C: 'Кому уступить',
  D: 'Разрешённое действие',
  E: 'Найдите ошибку',
} satisfies Record<JunctionExercise['kind'], string>

export type JunctionScenario = {
  id: string
  title: string
  difficulty: Difficulty
  topics: readonly string[]
  prompt: string
  scene: JunctionScene
  exercise: JunctionExercise
  explanation: string
  rules: readonly RuleReference[]
  solutionSteps?: readonly (readonly string[])[]
}

export type JunctionAnswer =
  | { kind: 'A'; choice: string }
  | { kind: 'B'; steps: readonly (readonly string[])[] }
  | { kind: 'C'; choices: readonly string[] }
  | { kind: 'D'; choice: string }
  | { kind: 'E'; choice: string }

function matchesOrder(scenario: JunctionScenario, exercise: OrderExercise, steps: readonly (readonly string[])[]) {
  if (steps.some((step) => step.length === 0)) return false

  const placements = steps.flatMap((step, index) => step.map((id) => [id, index] as const))
  const positions = new Map(placements)
  const participants = scenario.scene.participants
  if (placements.length !== participants.length || positions.size !== participants.length) return false
  if (participants.some((participant) => !positions.has(participant.id))) return false

  return exercise.order.every(([before, after]) => {
    const first = positions.get(before)
    const second = positions.get(after)
    return first !== undefined && second !== undefined && first < second
  }) && exercise.conflicts.every(([left, right]) => positions.get(left) !== positions.get(right))
}

export function evaluateAnswer(scenario: JunctionScenario, answer: JunctionAnswer): { correct: boolean } {
  const { exercise } = scenario
  if (exercise.kind === 'B') {
    return { correct: answer.kind === 'B' && matchesOrder(scenario, exercise, answer.steps) }
  }
  if (exercise.kind === 'C') {
    return {
      correct: answer.kind === 'C'
        && answer.choices.length === exercise.correct.length
        && exercise.correct.every((id) => answer.choices.includes(id)),
    }
  }
  return { correct: answer.kind === exercise.kind && answer.choice === exercise.correct }
}

function buildOrder(exercise: OrderExercise, ids: readonly string[], combine: boolean): string[][] {
  const remaining = new Set(ids)
  const steps: string[][] = []

  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) =>
      exercise.order.every(([before, after]) => after !== id || !remaining.has(before)),
    )
    const step: string[] = []
    for (const id of ready) {
      if (exercise.conflicts.some(([left, right]) =>
        (left === id && step.includes(right)) || (right === id && step.includes(left)),
      )) continue
      step.push(id)
      if (!combine) break
    }
    if (step.length === 0) return []
    steps.push(step)
    for (const id of step) remaining.delete(id)
  }

  return steps
}

export function getOrderExamples(scenario: JunctionScenario): string[][][] {
  const { exercise } = scenario
  if (exercise.kind !== 'B') return []

  const ids = scenario.scene.participants.map((participant) => participant.id)
  const combined = buildOrder(exercise, ids, true)
  if (combined.length === 0) return []

  const serial = buildOrder(exercise, ids, false)
  if (combined.some((step) => step.length > 1)) return [combined, serial]

  const reversedChoices = buildOrder(exercise, ids.reverse(), false)
  return combined.some(([id], index) => id !== reversedChoices[index]?.[0])
    ? [combined, reversedChoices]
    : [combined]
}
