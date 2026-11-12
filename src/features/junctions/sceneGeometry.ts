import type { Direction, JunctionScene, Participant } from './model'

export const sceneWidth = 720
export const sceneHeight = 480
export const centerX = sceneWidth / 2
export const centerY = sceneHeight / 2
export const roadHalfWidth = 68
export const roundaboutRoadHalfWidth = 55
export const outerCircle = 132
export const innerCircle = 67
export const roundaboutLaneRadius = (outerCircle + innerCircle) / 2
export const directions = ['n', 'e', 's', 'w'] as const
export const bearings: Record<Direction, number> = { n: 0, e: 90, s: 180, w: 270 }
const actorLetters = ['А', 'Б', 'В', 'Г', 'Д', 'Е']

export function participantLetter(index: number) {
  return actorLetters[index] ?? index + 1
}

interface Point { x: number; y: number }
interface Pose extends Point { angle: number }

export function roadPoint(direction: Direction, lateral: number, distance: number): Point {
  switch (direction) {
    case 'n': return { x: centerX + lateral, y: centerY - distance }
    case 'e': return { x: centerX + distance, y: centerY + lateral }
    case 's': return { x: centerX - lateral, y: centerY + distance }
    case 'w': return { x: centerX - distance, y: centerY - lateral }
  }
}

export function armTransform(direction: Direction) {
  return `translate(${centerX} ${centerY}) rotate(${bearings[direction]})`
}

export function armLength(direction: Direction) {
  return direction === 'n' || direction === 's' ? centerY + 24 : centerX + 24
}

const xy = (point: Point) => `${Math.round(point.x * 10) / 10} ${Math.round(point.y * 10) / 10}`

export function roadOutline(arms: readonly Direction[]) {
  const radius = 25
  const half = roadHalfWidth
  const corners = directions.map((direction, index) => {
    const arm = arms.includes(direction)
    const next = arms.includes(directions[(index + 1) % directions.length])
    const point = (x: number, y: number) => xy(roadPoint(direction, x, y))
    const cap = arm ? [point(-half, armLength(direction)), point(half, armLength(direction))] : []
    const corner = arm && next
      ? `L ${point(half, half + radius)} Q ${point(half, half)} ${point(half + radius, half)}`
      : `L ${point(half, half)}`
    return { cap, corner }
  })
  const commands = corners.flatMap(({ cap, corner }) => [...cap.map((point) => `L ${point}`), corner])
  return `${commands.join(' ').replace(/^L /, 'M ')} Z`
}

const laneLateral = (scene: JunctionScene, arm: Direction, tram: boolean) => {
  if (tram) return 15
  if (scene.geometry === 'roundabout') return 28
  return scene.tramTracks?.includes(arm) ? 48 : 34
}

function ringPoint(angle: number): Point {
  const radians = angle * Math.PI / 180
  return { x: centerX + Math.sin(radians) * roundaboutLaneRadius, y: centerY - Math.cos(radians) * roundaboutLaneRadius }
}

export function participantLabelOffset(participant: Participant) {
  const arm = participant.type === 'pedestrian' ? participant.crossing : participant.from
  const side = participant.type === 'pedestrian' ? participant.fromSide === 'left' : participant.type === 'tram'
  const point = roadPoint(arm, side ? 24 : -24, 23)
  return { x: point.x - centerX, y: point.y - centerY }
}

export function participantPose(participant: Participant, scene: JunctionScene): Pose {
  if (participant.type === 'pedestrian') {
    const left = participant.fromSide === 'left'
    const side = left ? 1 : -1
    const lateral = participant.position === 'finishing'
      ? -side * 18
      : participant.position === 'crossing' ? side * 18 : side * (roadHalfWidth + 13)
    return {
      ...roadPoint(participant.crossing, lateral, 116),
      angle: bearings[participant.crossing] + (left ? -90 : 90),
    }
  }

  if (participant.position === 'circulating' && scene.geometry === 'roundabout') {
    const bearing = bearings[participant.from]
    return { ...ringPoint(bearing), angle: bearing - 90 }
  }

  const inward = laneLateral(scene, participant.from, participant.type === 'tram')
  const nearby = scene.geometry === 'roundabout' ? 183 : 168
  const distance = participant.position === 'inside' ? 54 : participant.position === 'queued' ? 211 : nearby
  return { ...roadPoint(participant.from, -inward, distance), angle: bearings[participant.from] + 180 }
}

export function trackPath(arms: readonly Direction[], lateral: number) {
  const [start, end] = arms
  if (!start || !end) return ''
  const entry = roadPoint(start, -lateral, 86)
  const exit = roadPoint(end, lateral, 86)
  const entryControl = roadPoint(start, -lateral, 32)
  const exitControl = roadPoint(end, lateral, 32)
  return `M ${xy(roadPoint(start, -lateral, armLength(start)))} L ${xy(entry)} C ${xy(entryControl)} ${xy(exitControl)} ${xy(exit)} L ${xy(roadPoint(end, lateral, armLength(end)))}`
}

export function participantRoute(participant: Participant, scene: JunctionScene, continueOffScene = false) {
  const start = participantPose(participant, scene)
  if (participant.type === 'pedestrian') {
    const endSide = participant.fromSide === 'left' ? -1 : 1
    const end = roadPoint(participant.crossing, endSide * (roadHalfWidth + 15), 116)
    return `M ${xy(start)} L ${xy(end)}`
  }

  const tram = participant.type === 'tram'
  const inLane = laneLateral(scene, participant.from, tram)
  const outLane = laneLateral(scene, participant.to, tram)
  const visibleExit = participant.to === 'n' || participant.to === 's' ? 215 : 255
  const exitDistance = continueOffScene ? armLength(participant.to) + 20 : visibleExit
  const end = roadPoint(participant.to, outLane, exitDistance)

  if (scene.geometry === 'roundabout') {
    const circulating = participant.position === 'circulating'
    const entryAngle = bearings[participant.from] - (circulating ? 0 : 34)
    const exitAngle = bearings[participant.to] + 34
    const degrees = (entryAngle - exitAngle + 360) % 360
    const ringStart = ringPoint(entryAngle)
    const ringExit = ringPoint(exitAngle)
    const entry = circulating
      ? `M ${xy(start)}`
      : `M ${xy(start)} C ${xy(roadPoint(participant.from, -inLane, 139))} ${xy(ringPoint(entryAngle + 14))} ${xy(ringStart)}`
    const exit = roadPoint(participant.to, outLane, 154)
    return `${entry} A ${roundaboutLaneRadius} ${roundaboutLaneRadius} 0 ${degrees > 180 ? 1 : 0} 0 ${xy(ringExit)} C ${xy(ringPoint(exitAngle - 14))} ${xy(roadPoint(participant.to, outLane, 112))} ${xy(exit)} L ${xy(end)}`
  }

  const entryDistance = participant.position === 'inside' ? 50 : 87
  const entry = roadPoint(participant.from, -inLane, entryDistance)
  const exit = roadPoint(participant.to, outLane, 87)
  const entryControl = roadPoint(participant.from, -inLane, 31)
  const exitControl = roadPoint(participant.to, outLane, 31)
  return `M ${xy(start)} L ${xy(entry)} C ${xy(entryControl)} ${xy(exitControl)} ${xy(exit)} L ${xy(end)}`
}
