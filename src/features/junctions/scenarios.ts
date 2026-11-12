import type {
  Approach, Direction, JunctionScenario, JunctionScene, Participant, PedestrianParticipant,
  RuleReference, Signal, SignalColor, VehicleParticipant,
} from './model'

const pdd = 'https://www.consultant.ru/document/cons_doc_LAW_2709/'
const definitions = `${pdd}5894b193fda5648afe1c1a5e70c028f25cd29099/`
const specialSignals = `${pdd}367c97a177672081a40df5256f7b2150d8ff81c6/`
const signalsAndController = `${pdd}4b7a10a56ed37080fc96999db5f3db6f3aa58cc6/`
const maneuvers = `${pdd}2fdfa8559de67744dab415a31c1f987bc016016b/`
const intersectionRules = `${pdd}74cbe820904f4f8ce76047ddbd81d14c8b953d3e/`
const pedestrianCrossings = `${pdd}7c45508e360f5b7b8ae1443d73feb01f52a6199d/`
const bicycles = `${pdd}b11240808fefa9a32c03b5b7c81829af379a790e/`
const prioritySigns = `${pdd}f813c443e749db7b760a9fb7729a4e4ccdb2f3ea/`
const mandatorySigns = `${pdd}cfcce287ebd89cee09dc5b780337286c556b0978/`
const supplementalSigns = `${pdd}d507c6724f67c7a6ff27ba125eb7db3e4d36a3a6/`
const roadMarkings = `${pdd}8b4d779e30a40c4f48df8edd7c7d2e1a12e91d77/`

const ruleSections = {
  '1.2': definitions,
  '3.1': specialSignals,
  '3.2': specialSignals,
  '3.4': specialSignals,
  '3.5': specialSignals,
  '6.2': signalsAndController,
  '6.3': signalsAndController,
  '6.5': signalsAndController,
  '6.10': signalsAndController,
  '6.13': signalsAndController,
  '6.14': signalsAndController,
  '6.15': signalsAndController,
  '8.5': maneuvers,
  '13.1': intersectionRules,
  '13.2': intersectionRules,
  '13.3': intersectionRules,
  '13.4': intersectionRules,
  '13.5': intersectionRules,
  '13.6': intersectionRules,
  '13.7': intersectionRules,
  '13.8': intersectionRules,
  '13.9': intersectionRules,
  '13.10': intersectionRules,
  '13.11': intersectionRules,
  '13.11(1)': intersectionRules,
  '13.12': intersectionRules,
  '14.1': pedestrianCrossings,
  '14.3': pedestrianCrossings,
  '24.2': bicycles,
  '24.8': bicycles,
  '2.1': prioritySigns,
  '2.4': prioritySigns,
  '2.5': prioritySigns,
  '4.3': mandatorySigns,
  '8.13': supplementalSigns,
  '1.12': roadMarkings,
  '1.13': roadMarkings,
} as const

function rules(...ids: (keyof typeof ruleSections)[]): RuleReference[] {
  return ids.map((id) => ({
    id,
    label: ruleSections[id] === roadMarkings ? `Разметка ${id}`
      : id === '8.13' ? 'Табличка 8.13'
        : ['2.1', '2.4', '2.5', '4.3'].includes(id) ? `Знак ${id}` : `ПДД, п. ${id}`,
    url: ruleSections[id],
  }))
}

export const junctionSourceReview = {
  checkedOn: '2026-11-11',
  edition: '28.08.2026',
  sourceUrl: pdd,
  status: 'Сверено с текстом ПДД',
  independentReview: 'Повторная редакционная сверка выполнена',
  specialistReview: 'Ожидает проверки инструктором',
} as const

const allArms = ['n', 'e', 's', 'w'] as const
const northSouth = ['n', 's'] as const
const eastWest = ['e', 'w'] as const
const driverStyles = {
  a: { adjective: 'Синий', color: '#4f9cff' },
  b: { adjective: 'Оранжевый', color: '#ff9b52' },
  c: { adjective: 'Зелёный', color: '#56d3a3' },
  d: { adjective: 'Фиолетовый', color: '#bc90ff' },
} as const
const vehicleNames = {
  car: 'автомобиль',
  truck: 'грузовик',
  tram: 'трамвай',
  bicycle: 'велосипедист',
  emergency: 'спецавтомобиль',
} as const

function vehicle(
  id: keyof typeof driverStyles,
  from: Direction,
  to: Direction,
  options: Partial<Omit<VehicleParticipant, 'id' | 'color' | 'from' | 'to'>> = {},
): VehicleParticipant {
  const { type = 'car', label, ...details } = options
  const { adjective, color } = driverStyles[id]
  return { id, label: label ?? `${adjective} ${vehicleNames[type]}`, color, type, from, to, ...details }
}

function pedestrian(crossing: Direction, fromSide: PedestrianParticipant['fromSide'], details: string): PedestrianParticipant {
  return { id: 'p', type: 'pedestrian', label: 'Пешеход', color: '#f6d265', crossing, fromSide, position: 'crossing', details }
}

type SceneOptions = Partial<Omit<JunctionScene, 'participants' | 'caption'>>

function scene(participants: readonly Participant[], caption: string, options: SceneOptions = {}): JunctionScene {
  return { geometry: 'cross', arms: allArms, participants, caption, ...options }
}

function trafficLights(northSouthSignal: SignalColor, eastWestSignal: SignalColor, overrides: Partial<Record<Direction, Signal>> = {}): Approach[] {
  return allArms.map((arm) => ({
    arm,
    signal: overrides[arm] ?? { main: arm === 'n' || arm === 's' ? northSouthSignal : eastWestSignal },
    stopLine: true,
  }))
}

function priorityApproaches(mainRoad: readonly Direction[], options: { stop?: Direction; signal?: SignalColor } = {}): Approach[] {
  return allArms.map((arm) => ({
    arm,
    signs: [mainRoad.includes(arm) ? '2.1' : arm === options.stop ? '2.5' : '2.4'],
    ...(options.signal ? { signal: { main: options.signal } } : {}),
    ...(options.stop === arm || options.signal ? { stopLine: true } : {}),
    ...(!options.signal && !mainRoad.includes(arm) && arm !== options.stop ? { yieldLine: true } : {}),
  }))
}

const easy: readonly JunctionScenario[] = [
  {
    id: 'right-hand-cross',
    title: 'Кто справа на перекрёстке',
    difficulty: 'easy',
    topics: ['Равнозначные дороги', 'Движение прямо'],
    prompt: 'Какой автомобиль проедет перекрёсток первым?',
    scene: scene([
      vehicle('a', 'n', 's'), vehicle('b', 'w', 'e'),
    ], 'Перекрёсток равнозначных дорог без светофоров и знаков приоритета. Оба автомобиля едут прямо.'),
    exercise: { kind: 'A', correct: 'b' },
    explanation: 'Оранжевый автомобиль приближается справа от водителя синего. Синий уступает, а оранжевый проезжает первым.',
    rules: rules('13.11'),
  },
  {
    id: 'straight-before-left',
    title: 'Налево перед встречным',
    difficulty: 'easy',
    topics: ['Равнозначные дороги', 'Поворот налево', 'Движение прямо'],
    prompt: 'Кто первым проедет место пересечения траекторий?',
    scene: scene([
      vehicle('a', 's', 'w'), vehicle('b', 'n', 's'),
    ], 'Дороги равнозначны. Синий автомобиль поворачивает налево, встречный оранжевый едет прямо.'),
    exercise: { kind: 'A', correct: 'b' },
    explanation: 'При левом повороте синий автомобиль уступает встречному, который движется прямо по равнозначной дороге. Оранжевый проходит пересечение траекторий первым.',
    rules: rules('13.12'),
  },
  {
    id: 'priority-road',
    title: 'Пересечение с главной дорогой',
    difficulty: 'easy',
    topics: ['Главная и второстепенная', 'Знаки приоритета', 'Движение прямо'],
    prompt: 'Расположите автомобили в порядке проезда.',
    scene: scene([
      vehicle('a', 'w', 'e'), vehicle('b', 's', 'n'),
    ], 'Синий едет по дороге со знаком 2.1. Перед оранжевым у нижнего въезда установлен знак 2.4 и нанесена разметка 1.13. Оба едут прямо.', {
      mainRoad: eastWest, approaches: priorityApproaches(eastWest),
    }),
    exercise: { kind: 'B', order: [['a', 'b']], conflicts: [] },
    explanation: 'Оранжевый подъехал по второстепенной дороге и уступает синему. Разметка 1.13 указывает, где оранжевому при необходимости остановиться, чтобы пропустить синий автомобиль.',
    rules: rules('13.9', '2.1', '2.4', '1.13'),
  },
  {
    id: 'tee-equal',
    title: 'Т-образное пересечение равнозначных дорог',
    difficulty: 'easy',
    topics: ['Равнозначные дороги', 'Т-образный перекрёсток', 'Поворот налево'],
    prompt: 'Какое объяснение проезда этого перекрёстка ошибочно?',
    scene: scene([
      vehicle('a', 's', 'w'), vehicle('b', 'e', 'w'),
    ], 'Две дороги равнозначны. Синий выезжает с примыкающей дороги и поворачивает налево. Оранжевый едет прямо справа от него.', {
      geometry: 'tee', arms: ['s', 'w', 'e'],
    }),
    exercise: {
      kind: 'E',
      options: [
        { id: 'through-first', label: 'Оранжевый имеет преимущество потому, что едет по сквозной дороге.', sceneTarget: 'b' },
        { id: 'yield-right', label: 'Синий уступает автомобилю, который приближается справа.', sceneTarget: 'a' },
        { id: 'same-rule', label: 'Здесь действует правило проезда равнозначных дорог.' },
      ],
      correct: 'through-first',
    },
    explanation: 'Форма перекрёстка сама по себе не даёт преимущества сквозной дороге. Оранжевый проезжает первым, потому что для синего он приближается справа.',
    rules: rules('13.11'),
    solutionSteps: [['b'], ['a']],
  },
  {
    id: 'green-straight',
    title: 'Зелёный сигнал для движения прямо',
    difficulty: 'easy',
    topics: ['Светофор', 'Движение прямо'],
    prompt: 'Кому разрешено начать движение прямо на показанный сигнал?',
    scene: scene([
      vehicle('a', 's', 'n'), vehicle('b', 'w', 'e'),
    ], 'Перед синим автомобилем горит зелёный, перед оранжевым — красный. Перекрёсток свободен.', {
      approaches: trafficLights('green', 'red'),
    }),
    exercise: {
      kind: 'D',
      options: [
        { id: 'blue', label: 'Только синему автомобилю', sceneTarget: 'a' },
        { id: 'orange', label: 'Только оранжевому автомобилю', sceneTarget: 'b' },
        { id: 'both', label: 'Обоим автомобилям одновременно' },
      ],
      correct: 'blue',
    },
    explanation: 'Зелёный сигнал разрешает движение синему автомобилю. Оранжевый водитель остаётся перед стоп-линией до разрешающего сигнала.',
    rules: rules('6.2', '6.13'),
    solutionSteps: [['a']],
  },
  {
    id: 'red-and-yellow',
    title: 'Красный и жёлтый одновременно',
    difficulty: 'easy',
    topics: ['Светофор', 'Движение прямо'],
    prompt: 'Что вправе сделать водитель синего автомобиля в этот момент?',
    scene: scene([
      vehicle('a', 'w', 'e'),
    ], 'Синий автомобиль стоит перед стоп-линией. На его светофоре одновременно горят красный и жёлтый. Перекрёсток свободен.', {
      approaches: trafficLights('red', 'red-yellow'),
    }),
    exercise: {
      kind: 'D', subject: 'a',
      options: [
        { id: 'start', label: 'Начать движение прямо, если дорога свободна.' },
        { id: 'wait', label: 'Остаться перед стоп-линией и дождаться разрешающего сигнала.' },
        { id: 'edge', label: 'Пересечь стоп-линию и ждать перед пересекаемой дорогой.' },
      ],
      correct: 'wait',
    },
    explanation: 'Красный вместе с жёлтым предупреждает, что скоро включится зелёный. Движение пока запрещено, поэтому автомобиль остаётся перед стоп-линией.',
    rules: rules('6.2', '6.13'),
    solutionSteps: [],
  },
  {
    id: 'stop-line',
    title: 'Остановка у знака 2.5',
    difficulty: 'easy',
    topics: ['Знаки приоритета', 'Главная и второстепенная', 'Движение прямо'],
    prompt: 'Какое действие водителя синего автомобиля нарушит требования знака?',
    scene: scene([
      vehicle('a', 'w', 'e'),
    ], 'Перед синим автомобилем установлены знак 2.5 и стоп-линия. На пересекаемой дороге транспорта нет.', {
      mainRoad: northSouth, approaches: priorityApproaches(northSouth, { stop: 'w' }),
    }),
    exercise: {
      kind: 'E', subject: 'a',
      options: [
        { id: 'stop', label: 'Полностью остановиться перед стоп-линией.' },
        { id: 'roll', label: 'Замедлиться и пересечь стоп-линию без остановки.' },
        { id: 'continue', label: 'После остановки убедиться, что дорога свободна, и продолжить движение.' },
      ],
      correct: 'roll',
    },
    explanation: 'Знак 2.5 требует остановки перед стоп-линией даже на пустом перекрёстке. После остановки водитель проверяет пересекаемую дорогу и продолжает движение, если никому не создаст помех.',
    rules: rules('2.5', '1.12', '1.2'),
    solutionSteps: [],
  },
  {
    id: 'pedestrian-right-turn',
    title: 'Пешеход на дороге после поворота',
    difficulty: 'easy',
    topics: ['Пешеходы', 'Поворот направо', 'Равнозначные дороги'],
    prompt: 'Кому обязан уступить водитель синего автомобиля при повороте направо?',
    scene: scene([
      vehicle('a', 's', 'e'), vehicle('b', 'n', 'w'), pedestrian('e', 'right', 'Уже переходит дорогу по зебре'),
    ], 'На нерегулируемом перекрёстке синий и встречный оранжевый поворачивают направо в разные стороны. Пешеход идёт по переходу на правом рукаве.', {
      crossings: ['e'],
    }),
    exercise: { kind: 'C', subject: 'a', correct: ['p'] },
    explanation: 'Синий уступает пешеходу, который пересекает дорогу после его правого поворота. Оранжевый поворачивает в другую сторону, и пути автомобилей не пересекаются.',
    rules: rules('13.1', '14.1', '1.2'),
    solutionSteps: [['p', 'b'], ['a']],
  },
  {
    id: 'roundabout-entry',
    title: 'Въезд на круг без знака главной дороги',
    difficulty: 'easy',
    topics: ['Круговое движение', 'Знаки приоритета'],
    prompt: 'Кто первым пройдёт точку слияния у нижнего въезда?',
    scene: scene([
      vehicle('a', 's', 'e'), vehicle('b', 'w', 'e', { position: 'circulating', details: 'Уже движется по кольцу' }),
    ], 'На въездах установлен знак 4.3. Синий подъезжает по дороге, которая не является главной. Оранжевый уже едет по кругу к нижнему въезду.', {
      geometry: 'roundabout', approaches: allArms.map((arm) => ({ arm, signs: ['4.3'] })),
    }),
    exercise: { kind: 'A', correct: 'b' },
    explanation: 'Синий въезжает на обозначенный знаком 4.3 круг с дороги, которая не является главной. Он уступает оранжевому автомобилю, уже движущемуся по кольцу.',
    rules: rules('13.11(1)', '4.3'),
  },
  {
    id: 'opposing-right-turns',
    title: 'Два правых поворота на зелёный',
    difficulty: 'easy',
    topics: ['Светофор', 'Поворот направо'],
    prompt: 'Задайте допустимый порядок правых поворотов. Участников с независимыми траекториями можно добавить в один шаг.',
    scene: scene([
      vehicle('a', 'n', 'w'), vehicle('b', 's', 'e'),
    ], 'Автомобили подъехали с противоположных сторон. Оба поворачивают направо на зелёный. Пешеходов на дорогах после поворота нет.', {
      approaches: trafficLights('green', 'red'),
    }),
    exercise: { kind: 'B', order: [], conflicts: [] },
    explanation: 'Каждый автомобиль поворачивает в ближайший правый рукав. Повороты проходят по разным сторонам перекрёстка, поэтому допустимы одновременное движение и любой последовательный порядок.',
    rules: rules('6.2', '1.2'),
  },
  {
    id: 'flash-and-yield',
    title: 'Мигающий жёлтый и знаки приоритета',
    difficulty: 'easy',
    topics: ['Светофор', 'Знаки приоритета', 'Главная и второстепенная', 'Движение прямо'],
    prompt: 'Кому должен уступить оранжевый автомобиль? Отметьте всех участников.',
    scene: scene([
      vehicle('a', 'e', 'w'), vehicle('b', 'n', 's'), vehicle('c', 'w', 'e'),
    ], 'Все светофоры мигают жёлтым. Перед оранжевым знак 2.4, а перед синим и зелёным — знаки 2.1. Все едут прямо.', {
      mainRoad: eastWest, approaches: priorityApproaches(eastWest, { signal: 'flashing-yellow' }),
    }),
    exercise: { kind: 'C', subject: 'b', correct: ['a', 'c'] },
    explanation: 'При мигающем жёлтом перекрёсток считается нерегулируемым. Оранжевый едет со второстепенной дороги и уступает обоим автомобилям на главной.',
    rules: rules('6.2', '13.3', '13.9', '2.4'),
    solutionSteps: [['a', 'c'], ['b']],
  },
  {
    id: 'cycle-vehicle',
    title: 'Встречный велосипедист',
    difficulty: 'easy',
    topics: ['Велосипедисты', 'Равнозначные дороги', 'Поворот налево'],
    prompt: 'Кто первым пройдёт место пересечения траекторий?',
    scene: scene([
      vehicle('a', 's', 'w'), vehicle('b', 'n', 's', { type: 'bicycle', details: 'Едет прямо по правому краю проезжей части' }),
    ], 'Дороги равнозначны. Синий поворачивает налево. Взрослый велосипедист едет навстречу прямо по правому краю проезжей части. Велосипедной дорожки и полосы для велосипедистов нет.'),
    exercise: { kind: 'A', correct: 'b' },
    explanation: 'Велосипед считается транспортным средством. При левом повороте водитель синего автомобиля уступает велосипедисту, который движется навстречу прямо.',
    rules: rules('1.2', '13.12', '24.2'),
  },
]

const medium: readonly JunctionScenario[] = [
  {
    id: 'main-bends-right',
    title: 'Главная поворачивает вправо',
    difficulty: 'medium',
    topics: ['Изгиб главной дороги', 'Знаки приоритета', 'Поворот налево', 'Движение прямо', 'Т-образный перекрёсток'],
    prompt: 'Кто первым проедет пересечение траекторий?',
    scene: scene([
      vehicle('a', 's', 'n'), vehicle('b', 'e', 's'),
    ], 'Главная дорога соединяет нижний и правый рукава, как показывает табличка 8.13. Синий едет прямо, оранжевый поворачивает налево.', {
      geometry: 'tee', arms: ['n', 'e', 's'], mainRoad: ['s', 'e'],
      approaches: priorityApproaches(['s', 'e']).filter((approach) => approach.arm !== 'w'),
    }),
    exercise: { kind: 'A', correct: 'b' },
    explanation: 'Оба автомобиля подъехали по главной. Они применяют между собой правила равнозначных дорог. Оранжевый приближается справа от синего, поэтому первым проезжает оранжевый.',
    rules: rules('13.10', '13.11', '8.13'),
  },
  {
    id: 'secondary-bend-order',
    title: 'Два автомобиля на второстепенных дорогах',
    difficulty: 'medium',
    topics: ['Изгиб главной дороги', 'Знаки приоритета', 'Главная и второстепенная', 'Поворот налево'],
    prompt: 'Укажите порядок проезда трёх автомобилей по показанным траекториям.',
    scene: scene([
      vehicle('a', 'n', 's'), vehicle('b', 'w', 'e'), vehicle('c', 's', 'w'),
    ], 'Главная соединяет верхний и правый рукава. Синий едет с главной прямо. Слева оранжевый едет прямо, снизу зелёный поворачивает налево.', {
      mainRoad: ['n', 'e'], approaches: priorityApproaches(['n', 'e']),
    }),
    exercise: { kind: 'B', order: [['a', 'b'], ['a', 'c'], ['c', 'b']], conflicts: [] },
    explanation: 'Синий проезжает первым, поскольку подъехал по главной. Среди двух водителей на второстепенных дорогах оранжевый уступает зелёному справа. После синего едет зелёный, а за ним оранжевый.',
    rules: rules('13.9', '13.10', '13.11', '8.13'),
  },
  {
    id: 'three-equal',
    title: 'Три направления на равнозначных дорогах',
    difficulty: 'medium',
    topics: ['Равнозначные дороги', 'Движение прямо', 'Поворот налево'],
    prompt: 'В какой очередности водители проедут перекрёсток?',
    scene: scene([
      vehicle('a', 'n', 's'), vehicle('b', 'w', 'e'), vehicle('c', 'e', 's'),
    ], 'На равнозначном перекрёстке синий и оранжевый едут прямо. Зелёный справа на схеме поворачивает налево.'),
    exercise: { kind: 'B', order: [['b', 'a'], ['a', 'c'], ['b', 'c']], conflicts: [] },
    explanation: 'У оранжевого справа свободно. Синий уступает оранжевому справа. Зелёный уступает синему справа и встречному оранжевому, который едет прямо. Зелёный поворачивает последним.',
    rules: rules('13.11', '13.12'),
  },
  {
    id: 'green-left',
    title: 'Левый поворот и встречный правый',
    difficulty: 'medium',
    topics: ['Светофор', 'Поворот налево', 'Поворот направо'],
    prompt: 'Кому синий должен уступить перед выездом в левый рукав схемы?',
    scene: scene([
      vehicle('a', 's', 'w'), vehicle('b', 'n', 'w'), vehicle('c', 'w', 'e'),
    ], 'Встречные синий и оранжевый поворачивают в одну полосу на зелёный. Зелёный автомобиль стоит слева на красный сигнал.', {
      approaches: trafficLights('green', 'red'),
    }),
    exercise: { kind: 'C', subject: 'a', correct: ['b'] },
    explanation: 'Синий поворачивает налево на зелёный и уступает встречному оранжевому, который поворачивает направо. Зелёный автомобиль ждёт у стоп-линии.',
    rules: rules('13.4', '6.2', '6.13'),
    solutionSteps: [['b'], ['a']],
  },
  {
    id: 'extra-right-on-red',
    title: 'Стрелка направо и красный сигнал',
    difficulty: 'medium',
    topics: ['Светофор', 'Дополнительная секция', 'Поворот направо'],
    prompt: 'Кому должен уступить синий, прежде чем проехать по стрелке?',
    scene: scene([
      vehicle('a', 's', 'e'), vehicle('b', 'w', 'e'), vehicle('c', 'n', 's'),
    ], 'У синего горит правая стрелка вместе с основным красным. Слева оранжевый едет прямо на зелёный. Зелёный автомобиль сверху ждёт на красный.', {
      approaches: trafficLights('red', 'green', { s: { main: 'red', arrow: { direction: 'right', lit: true } } }),
    }),
    exercise: { kind: 'C', subject: 'a', correct: ['b'] },
    explanation: 'Синий может повернуть по включённой стрелке после оранжевого, который едет с другого направления. Оба выезжают в одну полосу. Зелёный автомобиль остаётся на своём красном.',
    rules: rules('6.3', '13.5', '6.2'),
    solutionSteps: [['b'], ['a']],
  },
  {
    id: 'dark-extra-section',
    title: 'Выключенная стрелка налево',
    difficulty: 'medium',
    topics: ['Светофор', 'Дополнительная секция', 'Поворот налево', 'Движение прямо'],
    prompt: 'Какое действие в этой ситуации запрещено?',
    scene: scene([
      vehicle('a', 'n', 'e'), vehicle('b', 's', 'n'),
    ], 'У синего горит основной зелёный. Дополнительная секция регулирует левый поворот, её стрелка выключена. Оранжевому разрешено ехать прямо.', {
      approaches: trafficLights('green', 'red', { n: { main: 'green', arrow: { direction: 'left', lit: false } } }),
    }),
    exercise: {
      kind: 'E',
      options: [
        { id: 'turn', label: 'Синий поворачивает налево на основной зелёный, пока секция выключена.', sceneTarget: 'a' },
        { id: 'straight', label: 'Оранжевый едет прямо на свой зелёный.', sceneTarget: 'b' },
        { id: 'wait', label: 'Синий ждёт включения стрелки для поворота налево.', sceneTarget: 'a' },
      ],
      correct: 'turn',
    },
    explanation: 'Выключенная дополнительная секция запрещает движение в регулируемом ею направлении. Для левого поворота синий ждёт включения стрелки. Оранжевый может ехать прямо.',
    rules: rules('6.2', '6.3'),
    solutionSteps: [['b']],
  },
  {
    id: 'tram-equal',
    title: 'Трамвай слева на равнозначном перекрёстке',
    difficulty: 'medium',
    topics: ['Трамвай', 'Равнозначные дороги', 'Движение прямо'],
    prompt: 'Кто имеет преимущество на пересечении путей?',
    scene: scene([
      vehicle('a', 'w', 'e'), vehicle('b', 'n', 's', { type: 'tram' }),
    ], 'Дороги равнозначны. Слева направо едет автомобиль. Трамвай движется прямо по рельсам от верхнего рукава к нижнему.', {
      tramTracks: northSouth,
    }),
    exercise: { kind: 'A', correct: 'b' },
    explanation: 'На перекрёстке равнозначных дорог трамвай имеет преимущество перед автомобилем. Синий пропускает трамвай, хотя тот приближается к нему слева.',
    rules: rules('13.11'),
  },
  {
    id: 'tram-secondary',
    title: 'Трамвай подъезжает по второстепенной',
    difficulty: 'medium',
    topics: ['Трамвай', 'Главная и второстепенная', 'Знаки приоритета', 'Движение прямо'],
    prompt: 'Кто первым пересечёт нерегулируемый перекрёсток?',
    scene: scene([
      vehicle('a', 's', 'n', { type: 'tram' }), vehicle('b', 'w', 'e'),
    ], 'Перед трамваем со стороны нижнего въезда стоит знак 2.4. Оранжевый едет прямо по обозначенной знаком 2.1 главной дороге.', {
      tramTracks: northSouth, mainRoad: eastWest, approaches: priorityApproaches(eastWest),
    }),
    exercise: { kind: 'A', correct: 'b' },
    explanation: 'Трамвай подъехал по второстепенной дороге, поэтому уступает автомобилю на главной. Это правило действует и для рельсового транспорта.',
    rules: rules('13.9', '2.4'),
  },
  {
    id: 'finish-on-green',
    title: 'Зелёный включился, движение ещё заканчивают',
    difficulty: 'medium',
    topics: ['Светофор', 'Пешеходы', 'Движение прямо'],
    prompt: 'Кому водитель синего должен уступить при включении зелёного? Отметьте всех участников.',
    scene: scene([
      vehicle('a', 's', 'n'),
      vehicle('b', 'w', 'e', { position: 'inside', details: 'Въехал на разрешающий сигнал и завершает проезд' }),
      vehicle('d', 'n', 's'),
      { ...pedestrian('s', 'left', 'На полосе синего автомобиля. Заканчивает переход.'), position: 'finishing' },
    ], 'Синий и фиолетовый только получили зелёный. Оранжевый завершает проезд, отдельной стоп-линии на его пути нет. Пешеход начал переход на зелёный и успел пройти середину. Его сигнал сменился на красный, пока он на полосе синего.', {
      approaches: trafficLights('green', 'red'), crossings: ['s'], pedestrianSignals: { s: 'red' },
    }),
    exercise: { kind: 'C', subject: 'a', correct: ['b', 'p'] },
    explanation: 'При включении зелёного синий пропускает оранжевого, который заканчивает проезд, и пешехода, который ещё пересекает нижнюю дорогу. Встречный фиолетовый едет прямо в своей полосе.',
    rules: rules('13.7', '13.8', '14.3'),
    solutionSteps: [['b', 'p'], ['a', 'd']],
  },
  {
    id: 'controller-sides',
    title: 'Регулировщик стоит с опущенными руками',
    difficulty: 'medium',
    topics: ['Регулировщик', 'Движение прямо', 'Поворот направо'],
    prompt: 'Кому разрешено выполнить показанный на схеме манёвр?',
    scene: scene([
      vehicle('a', 'e', 'w'), vehicle('b', 'n', 's'), vehicle('c', 's', 'e'),
    ], 'Регулировщик опустил руки и смотрит к верхнему рукаву. Синий видит его сбоку и едет прямо. Оранжевый видит грудь, зелёный — спину.', {
      controller: { facing: 'n', gesture: 'arms-down' },
    }),
    exercise: {
      kind: 'D',
      options: [
        { id: 'side', label: 'Синему — прямо', sceneTarget: 'a' },
        { id: 'chest', label: 'Оранжевому — прямо', sceneTarget: 'b' },
        { id: 'back', label: 'Зелёному — направо', sceneTarget: 'c' },
      ],
      correct: 'side',
    },
    explanation: 'При опущенных руках безрельсовому транспорту со стороны бока разрешено ехать прямо и направо. Со стороны груди и спины водители ждут.',
    rules: rules('6.10'),
    solutionSteps: [['a']],
  },
  {
    id: 'traffic-jam',
    title: 'Зелёный при заторе за перекрёстком',
    difficulty: 'medium',
    topics: ['Светофор', 'Затор', 'Движение прямо'],
    prompt: 'Какое действие водителя синего автомобиля будет ошибкой?',
    scene: scene([
      vehicle('a', 's', 'n'), vehicle('b', 'w', 'e'),
    ], 'У синего зелёный. За перекрёстком прямо по его пути стоят машины, места для выезда нет. Если синий въедет, он остановится поперёк пути оранжевого.', {
      blockedExit: 'n', approaches: trafficLights('green', 'red'),
    }),
    exercise: {
      kind: 'E', subject: 'a',
      options: [
        { id: 'stay', label: 'Остаться перед перекрёстком, пока выход занят.' },
        { id: 'enter', label: 'Въехать и ждать на пути поперечного движения.' },
        { id: 'clear', label: 'Поехать на разрешающий сигнал после появления свободного места.' },
      ],
      correct: 'enter',
    },
    explanation: 'Если затор вынудит остановиться и перекрыть поперечное движение, въезжать запрещено. Синий ждёт свободного места за перекрёстком, даже пока горит зелёный.',
    rules: rules('13.2', '6.2'),
    solutionSteps: [],
  },
  {
    id: 'cyclist-left',
    title: 'Левый поворот велосипедиста на одной полосе',
    difficulty: 'medium',
    topics: ['Велосипедисты', 'Светофор', 'Поворот налево'],
    prompt: 'Когда велосипедист вправе выполнить левый поворот?',
    scene: scene([
      vehicle('a', 's', 'w', { type: 'bicycle' }), vehicle('b', 'n', 's'),
    ], 'Взрослый велосипедист едет по проезжей части. По одной полосе в каждом направлении, трамвайных путей и велосипедной инфраструктуры нет. Для обоих горит зелёный.', {
      approaches: trafficLights('green', 'red'),
    }),
    exercise: {
      kind: 'D', subject: 'a',
      options: [
        { id: 'first', label: 'До встречного автомобиля, поскольку велосипед поворачивает.' },
        { id: 'after', label: 'На зелёный после того, как уступит встречному автомобилю.' },
        { id: 'never', label: 'Повернуть верхом на велосипеде здесь запрещено при любом сигнале.' },
      ],
      correct: 'after',
    },
    explanation: 'На показанной дороге нет условий, при которых велосипедисту запрещён левый поворот. На зелёный он выполняет его, уступив встречному автомобилю, который едет прямо.',
    rules: rules('24.2', '24.8', '13.4'),
    solutionSteps: [['b'], ['a']],
  },
]

const hard: readonly JunctionScenario[] = [
  {
    id: 'bending-main-all-arms',
    title: 'Четыре автомобиля на изгибе главной',
    difficulty: 'hard',
    topics: ['Изгиб главной дороги', 'Главная и второстепенная', 'Знаки приоритета', 'Поворот налево', 'Поворот направо'],
    prompt: 'Укажите любой допустимый порядок. В один шаг можно поставить тех, кто может двигаться одновременно.',
    scene: scene([
      vehicle('a', 'n', 'w'), vehicle('b', 'e', 's'), vehicle('c', 's', 'n'), vehicle('d', 'w', 'e'),
    ], 'Главная соединяет верхний и правый рукава. Синий поворачивает направо, оранжевый налево. С двух второстепенных дорог зелёный и фиолетовый едут прямо.', {
      mainRoad: ['n', 'e'], approaches: priorityApproaches(['n', 'e']),
    }),
    exercise: { kind: 'B', order: [['b', 'c'], ['b', 'd'], ['c', 'd']], conflicts: [] },
    explanation: 'Зелёный и фиолетовый уступают оранжевому на главной. Затем фиолетовый пропускает зелёного справа. Синий поворачивает направо по отдельной траектории и может проехать на любом шаге, если никому не придётся менять скорость или направление.',
    rules: rules('13.9', '13.10', '13.11', '1.2', '8.13'),
  },
  {
    id: 'green-compatible-sequence',
    title: 'Трамвай и переход в одной зелёной фазе',
    difficulty: 'hard',
    topics: ['Трамвай', 'Пешеходы', 'Светофор', 'Поворот направо', 'Поворот налево', 'Движение прямо'],
    prompt: 'Покажите допустимую очередность. Тех, чьи траектории совместимы, можно добавить в один шаг.',
    scene: scene([
      vehicle('a', 's', 'n'), vehicle('b', 'n', 'w'), vehicle('c', 'n', 'e', { type: 'tram' }),
      pedestrian('w', 'right', 'Пересекает левый рукав на зелёный'),
    ], 'Синий едет прямо, оранжевый поворачивает направо. С верхнего рукава трамвай поворачивает налево по отдельным путям. Им горит зелёный. Пешеход на левом переходе тоже идёт на зелёный.', {
      tramTracks: ['n', 'e'], crossings: ['w'], pedestrianSignals: { w: 'green' }, approaches: trafficLights('green', 'red'),
    }),
    exercise: { kind: 'B', order: [['c', 'a'], ['p', 'b']], conflicts: [] },
    explanation: 'Синий пропускает трамвай на пересечении их траекторий. Оранжевый уступает пешеходу на дороге после поворота. Эти две пары движутся по разным участкам, поэтому трамвай и пешеход могут начать одновременно, а затем могут проехать оба автомобиля.',
    rules: rules('13.6', '13.1', '6.5', '1.2'),
  },
  {
    id: 'tram-red-arrow',
    title: 'Трамвай поворачивает по стрелке с красным',
    difficulty: 'hard',
    topics: ['Трамвай', 'Светофор', 'Дополнительная секция', 'Поворот налево'],
    prompt: 'Кому трамвай должен уступить, прежде чем повернуть по стрелке?',
    scene: scene([
      vehicle('a', 'n', 'e', { type: 'tram' }), vehicle('b', 's', 'n'), vehicle('c', 'w', 'e'),
    ], 'Трамвай следует по левой стрелке дополнительной секции при основном красном. Оранжевый едет навстречу прямо на зелёный. Зелёный автомобиль стоит перед своим красным.', {
      tramTracks: ['n', 'e'],
      approaches: trafficLights('green', 'red', { n: { main: 'red', arrow: { direction: 'left', lit: true } } }),
    }),
    exercise: { kind: 'C', subject: 'a', correct: ['b'] },
    explanation: 'При движении по стрелке дополнительной секции вместе с красным трамвай уступает транспорту с других направлений. Здесь первым проходит пересечение путей оранжевый автомобиль, а зелёный остаётся перед стоп-линией.',
    rules: rules('13.6', '6.3', '6.13'),
    solutionSteps: [['b'], ['a']],
  },
  {
    id: 'tram-turn-on-green',
    title: 'Трамвай налево и автомобиль прямо',
    difficulty: 'hard',
    topics: ['Трамвай', 'Светофор', 'Знаки приоритета', 'Поворот налево', 'Движение прямо'],
    prompt: 'Какое утверждение о проезде ошибочно?',
    scene: scene([
      vehicle('a', 'n', 'e', { type: 'tram' }), vehicle('b', 's', 'n'), vehicle('c', 'e', 'w'),
    ], 'Перед трамваем знак 2.4, перед встречным оранжевым — 2.1. Для обоих горит зелёный. Трамвай поворачивает налево, оранжевый едет прямо. У зелёного автомобиля красный.', {
      tramTracks: ['n', 'e'], mainRoad: ['s', 'e'],
      approaches: trafficLights('green', 'red').map((approach) => ({
        ...approach, signs: [approach.arm === 's' || approach.arm === 'e' ? '2.1' : '2.4'],
      })),
    }),
    exercise: {
      kind: 'E',
      options: [
        { id: 'tram', label: 'Трамвай имеет преимущество при одновременно разрешённом движении.', sceneTarget: 'a' },
        { id: 'car-first', label: 'Оранжевый проедет первым, поскольку трамвай поворачивает налево.', sceneTarget: 'b' },
        { id: 'red', label: 'Зелёный автомобиль ждёт разрешающего сигнала.', sceneTarget: 'c' },
      ],
      correct: 'car-first',
    },
    explanation: 'Очередность определяет работающий светофор. Трамвай и оранжевый получили разрешение одновременно, поэтому при пересечении их путей автомобиль уступает трамваю. Правило о встречном движении прямо при левом повороте трамвая применяется между двумя трамваями.',
    rules: rules('6.15', '13.6', '13.4', '6.2'),
    solutionSteps: [['a'], ['b']],
  },
  {
    id: 'controller-over-green',
    title: 'Жест регулировщика при работающем светофоре',
    difficulty: 'hard',
    topics: ['Регулировщик', 'Светофор', 'Поворот налево', 'Движение прямо'],
    prompt: 'Кому разрешено двигаться в показанном направлении?',
    scene: scene([
      vehicle('a', 's', 'w'), vehicle('b', 'e', 'w'), vehicle('c', 'w', 'n'), vehicle('d', 'n', 's'),
    ], 'Регулировщик смотрит к левому рукаву и вытянул правую руку вперёд. Светофоры слева и справа показывают зелёный, сверху и снизу — красный.', {
      controller: { facing: 'w', gesture: 'right-forward' }, approaches: trafficLights('red', 'green'),
    }),
    exercise: {
      kind: 'D',
      options: [
        { id: 'back', label: 'Оранжевому — прямо', sceneTarget: 'b' },
        { id: 'chest', label: 'Зелёному — налево', sceneTarget: 'c' },
        { id: 'left-side', label: 'Синему — налево', sceneTarget: 'a' },
        { id: 'right-side', label: 'Фиолетовому — прямо', sceneTarget: 'd' },
      ],
      correct: 'left-side',
    },
    explanation: 'Сигнал регулировщика обязателен и при работающем светофоре. С его левого бока синий может повернуть налево. Со стороны груди зелёному разрешён лишь правый поворот. Со стороны спины и правого бока движение запрещено.',
    rules: rules('6.10', '6.15'),
    solutionSteps: [['a']],
  },
  {
    id: 'controller-crossing',
    title: 'Переход за спиной регулировщика',
    difficulty: 'hard',
    topics: ['Регулировщик', 'Пешеходы', 'Поворот направо'],
    prompt: 'Кому синий должен уступить при разрешённом правом повороте?',
    scene: scene([
      vehicle('a', 'w', 's'), vehicle('b', 'n', 'w'), pedestrian('s', 'right', 'Пересекает дорогу за спиной регулировщика'),
    ], 'Регулировщик смотрит к верхнему рукаву и вытянул правую руку вперёд. Синий и оранжевый поворачивают направо. Пешеход идёт через нижний рукав.', {
      controller: { facing: 'n', gesture: 'right-forward' }, crossings: ['s'],
    }),
    exercise: { kind: 'C', subject: 'a', correct: ['p'] },
    explanation: 'Синий подъехал со стороны левого бока регулировщика, откуда правый поворот разрешён. Пешеход переходит за спиной регулировщика, и синий уступает ему при повороте. Оранжевый поворачивает на другой рукав по отдельной траектории.',
    rules: rules('6.10', '13.1', '1.2'),
    solutionSteps: [['p', 'b'], ['a']],
  },
  {
    id: 'emergency-crossing',
    title: 'Скорая помощь на пересечении потоков',
    difficulty: 'hard',
    topics: ['Спецсигналы', 'Светофор', 'Трамвай', 'Движение прямо'],
    prompt: 'Кто вправе проехать первым после того, как остальные уступят дорогу?',
    scene: scene([
      vehicle('a', 'n', 's', {
        type: 'emergency', label: 'Машина скорой помощи', beacon: 'blue', siren: true,
        details: 'Срочный вызов. Синий маячок и специальный звуковой сигнал включены.',
      }),
      vehicle('b', 'w', 'e', { type: 'tram' }), vehicle('c', 'e', 'w'),
    ], 'Скорая едет на срочный вызов с синим маячком и сиреной. На её направлении красный. Трамвай и автомобиль на поперечной дороге получили зелёный и могут безопасно уступить.', {
      tramTracks: eastWest, approaches: trafficLights('red', 'green'),
    }),
    exercise: { kind: 'A', correct: 'a' },
    explanation: 'Трамвай и автомобиль должны обеспечить беспрепятственный проезд скорой с включёнными маячком и специальным звуковым сигналом. Водитель скорой может проехать на красный при обеспечении безопасности, убедившись, что ему уступают.',
    rules: rules('3.1', '3.2'),
  },
  {
    id: 'amber-no-priority',
    title: 'Оранжевый маячок у знака 2.4',
    difficulty: 'hard',
    topics: ['Спецсигналы', 'Знаки приоритета', 'Главная и второстепенная', 'Движение прямо'],
    prompt: 'Какое решение водителя дорожного грузовика будет ошибкой?',
    scene: scene([
      vehicle('a', 's', 'n', { type: 'truck', beacon: 'amber', details: 'Оранжевый маячок, выполняются работы по содержанию дороги' }),
      vehicle('b', 'w', 'e'),
    ], 'Дорожный грузовик обрабатывает покрытие и движется к знаку 2.4 с оранжевым маячком. Перед ним разметка 1.13. Оранжевый автомобиль едет по главной.', {
      mainRoad: eastWest, approaches: priorityApproaches(eastWest),
    }),
    exercise: {
      kind: 'E', subject: 'a',
      options: [
        { id: 'yield', label: 'Уступить оранжевому автомобилю на главной дороге.' },
        { id: 'beacon-first', label: 'Проехать первым, рассчитывая на преимущество от маячка.' },
        { id: 'after', label: 'Продолжить движение после проезда оранжевого, если дорога свободна.' },
      ],
      correct: 'beacon-first',
    },
    explanation: 'Оранжевый маячок предупреждает об опасности и не даёт преимущества. Для машины, занятой содержанием дороги, знак 2.4 обязателен. Грузовик пропускает оранжевый автомобиль, при необходимости остановившись у разметки 1.13.',
    rules: rules('3.4', '3.5', '13.9', '2.4', '1.13'),
    solutionSteps: [['b'], ['a']],
  },
  {
    id: 'main-road-roundabout',
    title: 'Въезд на круг по главной дороге',
    difficulty: 'hard',
    topics: ['Круговое движение', 'Знаки приоритета', 'Главная и второстепенная'],
    prompt: 'Кому разрешено первым проехать точку слияния?',
    scene: scene([
      vehicle('a', 's', 'e'), vehicle('b', 'w', 'e', { position: 'circulating', details: 'Едет по кольцу к знаку 2.4 перед слиянием' }),
    ], 'У синего на нижнем въезде установлены знаки 2.1 и 4.3. Оранжевый едет по кольцу. Перед точкой слияния у него знак 2.4.', {
      geometry: 'roundabout', circulatingYieldAt: 's',
      approaches: allArms.map((arm) => ({ arm, signs: arm === 's' ? ['2.1', '4.3'] : ['4.3'] })),
    }),
    exercise: {
      kind: 'D',
      options: [
        { id: 'circulating', label: 'Оранжевому автомобилю на кольце', sceneTarget: 'b' },
        { id: 'entering', label: 'Синему автомобилю на въезде', sceneTarget: 'a' },
        { id: 'both', label: 'Обоим автомобилям одновременно' },
      ],
      correct: 'entering',
    },
    explanation: 'Обязанность уступить при въезде по пункту 13.11(1) относится к въезду с дороги, которая не является главной. Здесь у синего знак 2.1, а у оранжевого на кольце знак 2.4. Оранжевый уступает синему в точке слияния.',
    rules: rules('13.11(1)', '13.9', '2.1', '2.4', '4.3'),
    solutionSteps: [['a'], ['b']],
  },
  {
    id: 'raised-hand',
    title: 'Поднятая рука и спецсигналы',
    difficulty: 'hard',
    topics: ['Регулировщик', 'Спецсигналы', 'Движение прямо'],
    prompt: 'Кто может продолжить движение сразу после поднятия руки?',
    scene: scene([
      vehicle('a', 's', 'n', {
        type: 'emergency', label: 'Патрульный автомобиль', beacon: 'blue-red', siren: true,
        details: 'Неотложное задание. Есть возможность плавно остановиться.',
      }),
      vehicle('b', 'w', 'e', { position: 'inside', details: 'Остановка перед пересекаемой дорогой потребовала бы экстренного торможения' }),
    ], 'Регулировщик только что поднял руку. Патрульный автомобиль с включёнными маячками и сиреной может плавно остановиться. В момент сигнала оранжевый был у края пересекаемой проезжей части и мог остановиться до края только экстренным торможением.', {
      controller: { facing: 's', gesture: 'arm-up' },
    }),
    exercise: { kind: 'A', correct: 'b' },
    explanation: 'При поднятой руке водители останавливаются. Оранжевому разрешено продолжить, поскольку остановка в нужном месте потребовала бы экстренного торможения. Патрульный обязан выполнить сигнал регулировщика даже с включёнными спецсигналами.',
    rules: rules('6.10', '6.13', '6.14', '3.1'),
  },
  {
    id: 'cyclist-with-tram-tracks',
    title: 'Левый поворот велосипедиста на трамвайной улице',
    difficulty: 'hard',
    topics: ['Велосипедисты', 'Трамвай', 'Пешеходы', 'Светофор', 'Поворот налево'],
    prompt: 'Какое действие в этой ситуации нарушит ПДД?',
    scene: scene([
      vehicle('a', 'n', 'e', { type: 'bicycle' }), vehicle('b', 's', 'n', { type: 'tram' }),
    ], 'Велосипедист хочет повернуть налево. Попутные трамвайные пути слева идут в одном уровне с дорогой. Велосипедной зоны нет, поворот налево из правой полосы не разрешён. Светофор зелёный.', {
      tramTracks: northSouth, crossings: ['e'], approaches: trafficLights('green', 'red'),
    }),
    exercise: {
      kind: 'E',
      options: [
        { id: 'tram-straight', label: 'Трамвай проезжает прямо по рельсам на зелёный.', sceneTarget: 'b' },
        { id: 'cycle-left', label: 'Велосипедист пропускает трамвай и поворачивает налево верхом.', sceneTarget: 'a' },
        { id: 'walk', label: 'Велосипедист спешивается и пересекает дорогу по переходу, соблюдая правила для пешеходов.', sceneTarget: 'a' },
      ],
      correct: 'cycle-left',
    },
    explanation: 'Показанные условия запрещают велосипедисту левый поворот на дороге с трамвайным движением. Спешившись и ведя велосипед, он становится пешеходом и может воспользоваться переходом по правилам для пешеходов.',
    rules: rules('24.8', '8.5', '1.2', '6.2'),
    solutionSteps: [['b']],
  },
  {
    id: 'off-signal-priority',
    title: 'Светофоры выключены, траектории частично совпадают',
    difficulty: 'hard',
    topics: ['Светофор', 'Знаки приоритета', 'Главная и второстепенная', 'Поворот направо', 'Движение прямо'],
    prompt: 'Соберите допустимую последовательность. Можно объединять участников, которые могут проехать без взаимных помех.',
    scene: scene([
      vehicle('a', 'n', 's'), vehicle('b', 's', 'n'), vehicle('c', 'e', 'w'), vehicle('d', 'w', 's'),
    ], 'Светофоры не работают. Синий и оранжевый едут прямо по главной. Зелёный выполнил остановку у знака 2.5 и едет прямо. Фиолетовый поворачивает направо со стороны знака 2.4.', {
      mainRoad: northSouth, approaches: priorityApproaches(northSouth, { signal: 'off', stop: 'e' }),
    }),
    exercise: { kind: 'B', order: [['a', 'c'], ['b', 'c'], ['a', 'd']], conflicts: [] },
    explanation: 'По знакам приоритета зелёный уступает обоим автомобилям на главной. Фиолетовый пропускает синего, с которым выезжает в одну полосу. Траектория фиолетового совместима с проездом оранжевого в противоположной полосе и с проездом зелёного.',
    rules: rules('13.3', '13.9', '2.4', '2.5', '1.2'),
  },
]

export const junctionScenarios = [...easy, ...medium, ...hard].map(scenario => ({ ...scenario, review: junctionSourceReview }))
