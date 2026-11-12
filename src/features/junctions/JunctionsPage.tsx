import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Ambulance, ArrowRight, ArrowUpRight, Bike, CarFront, Check, ChevronDown, CircleCheck,
  CircleX, Map as MapIcon, MousePointer2, PersonStanding, Play, RotateCcw, Route, TramFront, Truck,
} from 'lucide-react'
import { difficultyLabels, evaluateAnswer, getOrderExamples } from './model'
import type { Difficulty, JunctionAnswer, JunctionScenario, Participant } from './model'
import RoadScene from './RoadScene'
import type { SceneParticipantState } from './RoadScene'
import { bearings, participantLetter } from './sceneGeometry'
import { junctionScenarios } from './scenarios'
import './junctions.css'

interface JunctionsPageProps {
  completedIds: ReadonlySet<string>
  onAttempt: (scenarioId: string, correct: boolean) => void
  onRule: (rule: string) => void
}

interface ScenarioWorkspaceProps {
  scenario: JunctionScenario
  onAttempt: JunctionsPageProps['onAttempt']
  onRule: JunctionsPageProps['onRule']
  onNext: () => void
}

const difficulties = ['easy', 'medium', 'hard'] as const
const participantIcons = {
  car: CarFront, truck: Truck, tram: TramFront, bicycle: Bike, emergency: Ambulance, pedestrian: PersonStanding,
}
const feedback = {
  correct: { title: 'Верно', icon: CircleCheck },
  incorrect: { title: 'Есть ошибка', icon: CircleX },
  shown: { title: 'Решение', icon: Route },
}

function maneuver(participant: Participant) {
  if (participant.details) return participant.details
  if (participant.type === 'pedestrian') return 'Переходит дорогу'
  if (participant.position === 'circulating') return 'Движется по кругу'
  const turn = (bearings[participant.to] - bearings[participant.from] + 180) % 360
  switch (turn) {
    case 0: return 'Едет прямо'
    case 90: return 'Поворачивает направо'
    case 180: return 'Разворачивается'
    default: return 'Поворачивает налево'
  }
}

function chosenOptions(answer: JunctionAnswer | null): readonly string[] {
  if (!answer) return []
  if (answer.kind === 'B') return answer.steps.flat()
  if (answer.kind === 'C') return answer.choices
  return [answer.choice]
}

function orderSteps(answer: JunctionAnswer | null, id: string, together: boolean): JunctionAnswer | null {
  const steps = answer?.kind === 'B' ? answer.steps : []
  if (steps.some((step) => step.includes(id))) {
    const remaining = steps.map((step) => step.filter((actor) => actor !== id)).filter((step) => step.length)
    return remaining.length ? { kind: 'B', steps: remaining } : null
  }
  if (together && steps.length) {
    return { kind: 'B', steps: [...steps.slice(0, -1), [...steps[steps.length - 1], id]] }
  }
  return { kind: 'B', steps: [...steps, [id]] }
}

function solutionSteps(scenario: JunctionScenario, answer: JunctionAnswer | null, correct: boolean) {
  if (scenario.solutionSteps) return scenario.solutionSteps
  const { exercise } = scenario
  switch (exercise.kind) {
    case 'A': return [[exercise.correct]]
    case 'B': return correct && answer?.kind === 'B' ? answer.steps : getOrderExamples(scenario)[0] ?? []
    case 'C': return [...exercise.correct.map((id) => [id]), [exercise.subject]]
    default: return []
  }
}

interface OptionButtonProps {
  label: string
  participant?: Participant
  mapLetter?: string | number
  pressed: boolean
  result?: 'correct' | 'incorrect'
  step?: number
  disabled: boolean
  onSelect: () => void
}

function OptionButton({ label, participant, mapLetter, pressed, result, step, disabled, onSelect }: OptionButtonProps) {
  const Icon = participant && participantIcons[participant.type]
  const style = participant ? { '--junction-participant': participant.color } as CSSProperties : undefined
  return (
    <button
      type="button"
      className="junction-option"
      style={style}
      data-result={result}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onSelect}
    >
      {Icon && (
        <span className="junction-option__vehicle" aria-hidden="true">
          <Icon size={20} strokeWidth={1.8} />
          {mapLetter !== undefined && <span className="junction-option__letter">{mapLetter}</span>}
        </span>
      )}
      <span className="junction-option__copy">
        <span className="junction-option__title">{label}</span>
        {participant && <span className="junction-option__maneuver">{maneuver(participant)}</span>}
      </span>
      <span className="junction-option__mark" aria-hidden="true">
        {step ?? (result === 'correct' ? <Check size={13} /> : result === 'incorrect' ? <CircleX size={16} /> : pressed ? <Check size={13} /> : null)}
      </span>
      {step && <span className="junction-sr-only">Шаг {step}</span>}
      {result && <span className="junction-sr-only">{result === 'correct' ? 'Правильный вариант' : 'Выбран неверно'}</span>}
    </button>
  )
}

function ScenarioWorkspace({ scenario, onAttempt, onRule, onNext }: ScenarioWorkspaceProps) {
  const [answer, setAnswer] = useState<JunctionAnswer | null>(null)
  const [result, setResult] = useState<keyof typeof feedback | null>(null)
  const [together, setTogether] = useState(false)
  const [playback, setPlayback] = useState(0)
  const optionsRef = useRef<HTMLDivElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const { scene, exercise } = scenario
  const checked = result !== null
  const selected = chosenOptions(answer)
  const actorOrder = answer?.kind === 'B' ? answer.steps : []
  const solution = checked ? solutionSteps(scenario, answer, result === 'correct') : null
  const displayedOrder = exercise.kind === 'B' ? solution ?? actorOrder : []
  const stepsById = new Map(displayedOrder.flatMap((step, index) => step.map((id) => [id, index + 1] as const)))
  const subject = exercise.kind === 'C' || exercise.kind === 'D' || exercise.kind === 'E' ? exercise.subject : undefined
  const textOptions = exercise.kind === 'D' || exercise.kind === 'E' ? exercise.options : null
  const actorOptions = textOptions ? [] : scene.participants.filter(({ id }) => id !== subject)
  const correctOptions: readonly string[] = exercise.kind === 'A' || exercise.kind === 'D' || exercise.kind === 'E'
    ? [exercise.correct]
    : exercise.kind === 'C' ? exercise.correct : []
  const ready = answer !== null && (exercise.kind !== 'B' || selected.length === scene.participants.length)
  const explicitNone = answer?.kind === 'C' && answer.choices.length === 0

  useEffect(() => {
    if (result) feedbackRef.current?.focus({ preventScroll: true })
  }, [result])

  function optionResult(id: string) {
    if (!checked || exercise.kind === 'B') return undefined
    if (correctOptions.includes(id)) return 'correct'
    return selected.includes(id) ? 'incorrect' : undefined
  }

  function selectOption(id: string) {
    if (checked) return
    if (exercise.kind === 'B') {
      setAnswer((previous) => orderSteps(previous, id, together))
      setTogether(false)
      return
    }
    if (exercise.kind === 'C') {
      setAnswer((previous) => {
        const choices = previous?.kind === 'C' ? previous.choices : []
        const next = choices.includes(id) ? choices.filter((choice) => choice !== id) : [...choices, id]
        return next.length ? { kind: 'C', choices: next } : null
      })
      return
    }
    setAnswer({ kind: exercise.kind, choice: id })
  }

  function linkedOption(id: string) {
    if (!textOptions) return actorOptions.some((actor) => actor.id === id) ? id : undefined
    const targets = textOptions.filter((option) => option.sceneTarget === id)
    return targets.length === 1 ? targets[0].id : undefined
  }

  const actorStates = new Map<string, SceneParticipantState>(scene.participants.map(({ id }) => {
    const option = linkedOption(id)
    return [id, {
      selectable: !checked && Boolean(option),
      selected: option !== undefined && selected.includes(option),
      subject: subject === id,
      result: option === undefined ? undefined : optionResult(option),
      step: stepsById.get(id),
    }]
  }))

  function checkAnswer() {
    if (!ready || !answer || checked) return
    const evaluation = evaluateAnswer(scenario, answer)
    setResult(evaluation.correct ? 'correct' : 'incorrect')
    setPlayback((value) => value + 1)
    onAttempt(scenario.id, evaluation.correct)
  }

  function revealAnswer() {
    setResult('shown')
    setPlayback((value) => value + 1)
  }

  function reset() {
    setAnswer(null)
    setResult(null)
    setTogether(false)
    requestAnimationFrame(() => optionsRef.current?.querySelector('button')?.focus({ preventScroll: true }))
  }

  const examples = checked && exercise.kind === 'B' ? getOrderExamples(scenario) : []
  const actorNames = new Map(scene.participants.map(({ id, label }) => [id, label]))
  const actorLetters = new Map(scene.participants.map(({ id }, index) => [id, participantLetter(index)]))
  const FeedbackIcon = result ? feedback[result].icon : null

  return (
    <div className="junction-workspace">
      <figure className="junction-board">
        <div className="junction-board__bar">
          <h2><MapIcon size={17} aria-hidden="true" /> Схема перекрёстка</h2>
          {Array.from(actorStates.values()).some((state) => state.selectable) && (
            <span className="junction-board__interaction"><MousePointer2 size={14} aria-hidden="true" /> Можно выбрать на схеме</span>
          )}
          {checked && solution?.length !== 0 && (
            <button className="junction-board__replay" type="button" onClick={() => setPlayback((value) => value + 1)}>
              <Play size={14} aria-hidden="true" /> Повторить анимацию
            </button>
          )}
        </div>
        <div className="junction-board__scene">
          <RoadScene
            scene={scene}
            participantStates={actorStates}
            onSelect={(id) => {
              const option = linkedOption(id)
              if (option !== undefined) selectOption(option)
            }}
            solution={solution}
            playback={playback}
          />
        </div>
        <figcaption className="junction-board__caption">{scene.caption}</figcaption>
      </figure>

      <section className="junction-decision" aria-labelledby="junction-question">
        <h2 id="junction-question">{scenario.prompt}</h2>
        {exercise.kind === 'C' && <p className="junction-decision__hint">Можно отметить несколько участников.</p>}

        <div className="junction-options" role="group" aria-label="Варианты ответа" ref={optionsRef}>
          {actorOptions.map((participant) => (
            <OptionButton
              key={participant.id}
              label={participant.label}
              participant={participant}
              mapLetter={actorLetters.get(participant.id)}
              pressed={selected.includes(participant.id)}
              result={optionResult(participant.id)}
              step={stepsById.get(participant.id)}
              disabled={checked}
              onSelect={() => selectOption(participant.id)}
            />
          ))}
          {textOptions?.map(({ id, label }) => (
            <OptionButton
              key={id}
              label={label}
              pressed={selected.includes(id)}
              result={optionResult(id)}
              disabled={checked}
              onSelect={() => selectOption(id)}
            />
          ))}
          {exercise.kind === 'C' && (
            <OptionButton
              label="Никому"
              pressed={explicitNone}
              result={checked ? (exercise.correct.length === 0 ? 'correct' : explicitNone ? 'incorrect' : undefined) : undefined}
              disabled={checked}
              onSelect={() => setAnswer(explicitNone ? null : { kind: 'C', choices: [] })}
            />
          )}
        </div>

        {exercise.kind === 'B' && !checked && (
          <label className="junction-group-toggle">
            <input
              type="checkbox"
              checked={together && actorOrder.length > 0}
              onChange={(event) => setTogether(event.target.checked)}
              disabled={actorOrder.length === 0 || ready}
            />
            <span>Добавить следующего участника в тот же шаг</span>
          </label>
        )}

        {checked ? (
          <>
            <div className="junction-feedback" role="status" data-result={result} tabIndex={-1} ref={feedbackRef}>
              <div className="junction-feedback__heading">
                {FeedbackIcon && <FeedbackIcon size={19} aria-hidden="true" />}
                <strong>{feedback[result].title}</strong>
              </div>
              <p>{scenario.explanation}</p>
              {examples.length > 0 && (
                <div className="junction-feedback__orders">
                  <strong>{examples.length > 1 ? 'Примеры допустимого порядка' : 'Допустимый порядок'}</strong>
                  {examples.map((steps) => (
                    <ol key={steps.map((step) => step.join('+')).join('-')}>
                      {steps.map((step) => <li key={step.join('-')}>{step.map((id) => actorNames.get(id)).join(' и ')}</li>)}
                    </ol>
                  ))}
                </div>
              )}
              {scenario.rules.length > 0 && (
                <div className="junction-feedback__rules" aria-label="Связанные правила">
                  {scenario.rules.map((rule) => (
                    <button key={rule.id} type="button" onClick={() => onRule(rule.id)}>
                      {rule.label} <ArrowUpRight size={13} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="junction-decision__actions">
              <button className="junction-primary" type="button" onClick={onNext}>
                Следующая ситуация <ArrowRight size={17} aria-hidden="true" />
              </button>
              <button className="junction-secondary" type="button" onClick={reset}>
                <RotateCcw size={15} aria-hidden="true" /> Решить заново
              </button>
            </div>
          </>
        ) : (
          <div className="junction-decision__actions">
            <button className="junction-primary" type="button" disabled={!ready} onClick={checkAnswer}>
              Проверить ответ <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button className="junction-secondary" type="button" onClick={revealAnswer}>
              Показать решение
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

export default function JunctionsPage({ completedIds, onAttempt, onRule }: JunctionsPageProps) {
  const [scenarioId, setScenarioId] = useState(junctionScenarios[0].id)
  const selectRef = useRef<HTMLSelectElement>(null)
  const scenario = junctionScenarios.find(({ id }) => id === scenarioId) ?? junctionScenarios[0]
  const scenariosAtLevel = junctionScenarios.filter(({ difficulty }) => difficulty === scenario.difficulty)
  const completedCount = junctionScenarios.filter(({ id }) => completedIds.has(id)).length

  function selectDifficulty(difficulty: Difficulty) {
    if (difficulty === scenario.difficulty) return
    const available = junctionScenarios.filter((item) => item.difficulty === difficulty)
    const next = available.find(({ id }) => !completedIds.has(id)) ?? available[0]
    if (next) setScenarioId(next.id)
  }

  function nextScenario() {
    const index = junctionScenarios.findIndex(({ id }) => id === scenario.id)
    setScenarioId(junctionScenarios[(index + 1) % junctionScenarios.length].id)
    selectRef.current?.focus()
  }

  return (
    <section className="junction-page" aria-labelledby="junction-page-title">
      <header className="junction-page__heading">
        <div>
          <h1 id="junction-page-title">Перекрёстки</h1>
          <p>Разбирай дорожные ситуации на практике.</p>
        </div>
        <div className="junction-progress" aria-label={`Решено ${completedCount} из ${junctionScenarios.length} задач`}>
          <span className="junction-progress__icon"><CircleCheck size={20} strokeWidth={1.8} aria-hidden="true" /></span>
          <div><strong>{completedCount} <span>/ {junctionScenarios.length}</span></strong><small>Задач решено</small></div>
        </div>
      </header>

      <div className="junction-toolbar">
        <div className="junction-toolbar__levels">
          <span id="junction-difficulty-label" className="junction-toolbar__label">Сложность</span>
          <div className="junction-levels" role="group" aria-labelledby="junction-difficulty-label">
            {difficulties.map((difficulty, index) => (
              <button
                key={difficulty}
                type="button"
                aria-pressed={scenario.difficulty === difficulty}
                onClick={() => selectDifficulty(difficulty)}
              >
                <span className="junction-levels__glyph" data-level={index + 1} aria-hidden="true"><i /><i /><i /></span>
                {difficultyLabels[difficulty]}
              </button>
            ))}
          </div>
        </div>
        <label className="junction-toolbar__scenario">
          <span className="junction-toolbar__label">Задача</span>
          <span className="junction-select">
            <select value={scenario.id} onChange={(event) => setScenarioId(event.target.value)} ref={selectRef}>
              {scenariosAtLevel.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <ChevronDown size={17} aria-hidden="true" />
          </span>
        </label>
      </div>

      <ScenarioWorkspace
        key={scenario.id}
        scenario={scenario}
        onAttempt={onAttempt}
        onRule={onRule}
        onNext={nextScenario}
      />
    </section>
  )
}
