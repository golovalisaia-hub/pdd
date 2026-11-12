import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Direction, JunctionScene, Participant, VehicleParticipant } from './model'
import {
  armLength, armTransform, bearings, centerX, centerY, innerCircle, outerCircle,
  participantLabelOffset, participantLetter, participantPose, participantRoute,
  roadHalfWidth, roadOutline, roadPoint, roundaboutLaneRadius, roundaboutRoadHalfWidth,
  sceneHeight, sceneWidth, trackPath,
} from './sceneGeometry'

export interface SceneParticipantState {
  selectable?: boolean
  selected?: boolean
  subject?: boolean
  result?: 'correct' | 'incorrect'
  step?: number
}

interface RoadSceneProps {
  scene: JunctionScene
  participantStates: ReadonlyMap<string, SceneParticipantState>
  onSelect: (participantId: string) => void
  solution: readonly (readonly string[])[] | null
  playback: number
}

type Approach = NonNullable<JunctionScene['approaches']>[number]
type Sign = NonNullable<Approach['signs']>[number]
type Signal = NonNullable<Approach['signal']>

const terrain = [
  { x: 148, y: 74, width: 159, height: 87, trees: [[-53, -14, 15], [-24, 17, 18], [40, -11, 19], [61, 13, 11]] },
  { x: 575, y: 74, width: 154, height: 87, trees: [[-45, 12, 19], [-14, -12, 13], [27, 13, 16], [51, -11, 14]] },
  { x: 143, y: 405, width: 155, height: 81, trees: [[-47, -3, 18], [-13, 14, 16], [22, -12, 16], [55, 7, 13]] },
  { x: 581, y: 405, width: 161, height: 81, trees: [[-53, 8, 14], [-18, -10, 19], [27, 13, 16], [56, -7, 16]] },
]

function Terrain({ id }: { id: string }) {
  return (
    <>
      <rect width={sceneWidth} height={sceneHeight} fill={`url(#${id}-land)`} />
      <rect width={sceneWidth} height={sceneHeight} fill={`url(#${id}-grid)`} />
      {terrain.map(({ x, y, width, height, trees }) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <rect x={-width / 2 - 7} y={-height / 2 - 7} width={width + 14} height={height + 14} rx={17} fill="#272a28" stroke="#393c35" />
          <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={12} fill="#1c2521" stroke="#323c34" />
          <path d={`M ${-width / 2 + 14} 0 H ${width / 2 - 14}`} stroke="#45473d" strokeWidth="5" strokeLinecap="round" opacity=".35" />
          {trees.map(([cx, cy, r]) => (
            <g key={cx}>
              <circle cx={cx + 4} cy={cy + 5} r={r + 2} fill="#151e1b" />
              <circle cx={cx} cy={cy} r={r} fill="#293a2e" stroke="#354538" strokeWidth="1.1" />
              <circle cx={cx - 3} cy={cy - 3} r={r * .64} fill="#334639" opacity=".75" />
              <path d={`M ${cx - r / 3} ${cy + r / 4} l ${r / 3} ${-r / 3} l ${r / 3} ${r / 8}`} stroke="#60715c" fill="none" strokeLinecap="round" opacity=".28" />
            </g>
          ))}
        </g>
      ))}
    </>
  )
}

function RoadSurface({ scene, id }: { scene: JunctionScene; id: string }) {
  if (scene.geometry === 'roundabout') {
    const half = roundaboutRoadHalfWidth
    return (
      <>
        <g fill="#55554f" stroke="#353732" strokeWidth="10" strokeLinejoin="round">
          <circle cx={centerX} cy={centerY} r={outerCircle + 8} />
          {scene.arms.map((arm) => <rect key={arm} transform={armTransform(arm)} x={-half - 8} y={-armLength(arm)} width={half * 2 + 16} height={armLength(arm) - 99} />)}
        </g>
        <g fill={`url(#${id}-asphalt)`}>
          <circle cx={centerX} cy={centerY} r={outerCircle} />
          {scene.arms.map((arm) => <rect key={arm} transform={armTransform(arm)} x={-half} y={-armLength(arm)} width={half * 2} height={armLength(arm) - 103} />)}
        </g>
        <circle cx={centerX} cy={centerY} r={innerCircle + 3} fill="#666656" stroke="#303333" strokeWidth="3" />
        <circle cx={centerX} cy={centerY} r={innerCircle - 4} fill={`url(#${id}-island)`} stroke="#566049" strokeWidth="1.5" />
        <circle cx={centerX} cy={centerY} r={innerCircle - 13} fill="none" stroke="#52634c" strokeWidth="2" strokeDasharray="1 5" />
        <path d="M 366 225 C 354 225 346 231 346 240 C 346 247 351 252 358 253 M 355 258 L 362 253 L 357 246 M 365 253 C 375 252 379 246 379 238 C 379 231 374 226 367 225 M 370 220 L 363 225 L 368 232" fill="none" stroke="#6c7d63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )
  }

  const outline = roadOutline(scene.arms)
  return (
    <>
      <path d={outline} fill="none" stroke="#282d2b" strokeWidth="27" strokeLinejoin="round" />
      <path d={outline} fill="none" stroke="#4e504a" strokeWidth="20" strokeLinejoin="round" />
      <path d={outline} fill="none" stroke="#63615a" strokeWidth="13" strokeLinejoin="round" />
      <path d={outline} fill={`url(#${id}-asphalt)`} stroke="#383936" strokeWidth="3" strokeLinejoin="round" />
      <path d={outline} fill={`url(#${id}-grain)`} />
    </>
  )
}

function RoadMarkings({ scene }: { scene: JunctionScene }) {
  const tracks = scene.tramTracks
  const trackRails = tracks ? [10, 20, -10, -20].map((lateral) => trackPath(tracks, lateral)) : []
  return (
    <>
      {scene.arms.map((arm) => {
        const approach = scene.approaches?.find((item) => item.arm === arm)
        const crossing = scene.crossings?.includes(arm)
        const roundabout = scene.geometry === 'roundabout'
        const start = roundabout ? 151 : 94
        const edge = (roundabout ? roundaboutRoadHalfWidth : roadHalfWidth) - 6
        const stop = approach?.stopLine ?? Boolean(approach?.signal || approach?.signs?.includes('2.5'))
        const length = armLength(arm)
        return (
          <g key={arm} transform={armTransform(arm)}>
            <path d={`M 0 -${start} V -${length}`} stroke="#d9d8cf" strokeWidth="2.5" strokeDasharray="16 12" opacity=".64" />
            <path d={`M ${-edge} -${start + 3} V -${length} M ${edge} -${start + 3} V -${length}`} stroke="#afafa9" strokeWidth="1.3" opacity=".28" />
            {crossing && (
              <g fill="#d1d1c8" opacity=".82">
                {Array.from({ length: 13 }, (_, index) => <rect key={index} x={-62 + index * 9.7} y="-126" width="6.4" height="20" rx=".45" />)}
              </g>
            )}
            {stop && <path d={`M ${-edge + 2} -${crossing ? 139 : roundabout ? 152 : 113} H -3`} stroke="#eeede4" strokeWidth="4" />}
            {!stop && (approach?.yieldLine || (roundabout && approach?.signs?.includes('2.4'))) && (
              <g fill="#d7d7cc" opacity=".84">
                {(roundabout ? [-43, -31, -19, -7] : [-53, -39, -25, -11]).map((x) => <path key={x} d={`M ${x - 5} -${roundabout ? 152 : crossing ? 139 : 109} h 10 l -5 -8 Z`} />)}
              </g>
            )}
          </g>
        )
      })}
      {trackRails.map((path) => (
        <g key={path}>
          <path d={path} fill="none" stroke="#17191c" strokeWidth="4.2" />
          <path d={path} fill="none" stroke="#acaaa2" strokeWidth="1.55" opacity=".67" />
        </g>
      ))}
      {scene.geometry === 'roundabout' && (
        <g transform={`translate(${centerX} ${centerY})`} stroke="#deded1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".6" fill="none">
          {[45, 135, 225, 315].map((angle) => <path key={angle} transform={`rotate(${angle}) translate(0 ${-roundaboutLaneRadius})`} d="M 12 0 H -12 M -6 -6 L -12 0 L -6 6" />)}
        </g>
      )}
    </>
  )
}

function SignFace({ sign }: { sign: Sign }) {
  switch (sign) {
    case '2.1':
      return <path d="M 0 -14 L 14 0 L 0 14 L -14 0 Z" fill="#f8c638" stroke="#fffdf2" strokeWidth="3.7" strokeLinejoin="round" />
    case '2.4':
      return <path d="M -13 -8 H 13 L 0 15 Z" fill="#f6f4ed" stroke="#e75754" strokeWidth="4" strokeLinejoin="round" />
    case '2.5':
      return (
        <>
          <path d="M -6 -14 H 6 L 14 -6 V 6 L 6 14 H -6 L -14 6 V -6 Z" fill="#c33738" stroke="#fcf7ee" strokeWidth="2" />
          <text y="2.7" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#fff">STOP</text>
        </>
      )
    case '4.3':
      return (
        <>
          <circle r="14" fill="#3174d0" stroke="#f1f5fa" strokeWidth="2.4" />
          <path d="M 8 1 A 8 8 0 0 0 -4 -7 M -6 -8 L -5 -3 L 0 -4 M -7 -3 A 8 8 0 0 0 0 8 M -2 10 L 2 8 L 0 4 M 4 7 A 8 8 0 0 0 8 0 M 11 1 L 8 -3 L 4 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      )
  }
}

function MainRoadPlate({ arms, mainRoad, face }: { arms: readonly Direction[]; mainRoad: readonly Direction[]; face: Direction }) {
  return (
    <g transform="translate(0 25)">
      <rect x="-13" y="-10" width="26" height="20" rx="2.5" fill="#efeee6" stroke="#fffaf2" strokeWidth="1.1" />
      <g transform={`rotate(${180 - bearings[face]})`}>
        {arms.map((arm) => {
          const primary = mainRoad.includes(arm)
          return (
            <path
              key={arm}
              transform={`rotate(${bearings[arm]})`}
              d="M 0 0 V -8"
              stroke={primary ? '#262523' : '#777674'}
              strokeWidth={primary ? 3.5 : 1.3}
              strokeLinecap="round"
            />
          )
        })}
      </g>
    </g>
  )
}

const lightColors = ['#fc575f', '#ffc957', '#62df92'] as const
const arrowAngles = { left: -90, right: 90, straight: 0 } as const

function TrafficLight({ signal }: { signal: Signal }) {
  const active = [
    signal.main === 'red' || signal.main === 'red-yellow',
    signal.main === 'yellow' || signal.main === 'red-yellow' || signal.main === 'flashing-yellow',
    signal.main === 'green',
  ]
  return (
    <>
      <rect x="-3" y="16" width="6" height="14" rx="2" fill="#969993" />
      <rect x="-12" y="-23" width="24" height="48" rx="7" fill="#121419" stroke="#81827b" strokeWidth="1.2" />
      {lightColors.map((color, index) => (
        <g key={color} className={index === 1 && signal.main === 'flashing-yellow' ? 'junction-scene__flashing' : undefined}>
          {active[index] && <circle cy={-14 + index * 14} r="9" fill={color} opacity=".17" />}
          <circle cy={-14 + index * 14} r="5.8" fill={active[index] ? color : '#2b2d33'} stroke={active[index] ? '#fff' : '#3d3e42'} strokeOpacity=".25" strokeWidth=".8" />
        </g>
      ))}
      {signal.arrow && (
        <g transform={`translate(${signal.arrow.direction === 'left' ? -21 : 21} 14)`}>
          <rect x="-9" y="-9" width="18" height="18" rx="4" fill="#14161a" stroke="#73756e" />
          <path transform={`rotate(${arrowAngles[signal.arrow.direction]})`} d="M 0 5 V -5 M -4 -1 L 0 -5 L 4 -1" fill="none" stroke={signal.arrow.lit ? '#62df92' : '#585b61'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </>
  )
}

function PedestrianLight({ phase }: { phase: 'green' | 'red' }) {
  const green = phase === 'green'
  const color = green ? '#62df92' : '#fc626b'
  return (
    <>
      <rect x="-2" y="8" width="4" height="10" rx="1.5" fill="#92938b" />
      <rect x="-10" y="-13" width="20" height="25" rx="5" fill="#14171a" stroke="#7d8076" />
      <circle cy="-6.5" r="2.2" fill={color} />
      <path
        d={green ? 'M 0 -2 L -1 3 L -4 7 M -1 3 L 3 6 M 0 -2 L 3 1 L 5 0 M 0 -2 L -4 0'
          : 'M 0 -2 V 3 M 0 -1 L -4 3 M 0 -1 L 4 3 M 0 3 L -2 7 M 0 3 L 2 7'}
        stroke={color}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  )
}

function RoadControls({ scene }: { scene: JunctionScene }) {
  const mainRoad = scene.mainRoad
  const bend = mainRoad?.length === 2 && Math.abs(bearings[mainRoad[0]] - bearings[mainRoad[1]]) !== 180
  const ringYield = scene.circulatingYieldAt
  const signAngle = ringYield ? (bearings[ringYield] + 39) * Math.PI / 180 : 0
  return (
    <>
      {scene.approaches?.map(({ arm, signs, signal }) => {
        const roundabout = scene.geometry === 'roundabout'
        const signalPoint = roadPoint(arm, -98, roundabout ? 147 : 122)
        return (
          <g key={arm}>
            {signs?.map((sign, index) => {
              const { x, y } = roadPoint(arm, -93, (roundabout ? 144 : 103) + (signal ? 63 : 0) + index * 36)
              return (
                <g key={sign} transform={`translate(${x} ${y})`}>
                  <path d="M 0 3 V 22" stroke="#91928c" strokeWidth="4" strokeLinecap="round" />
                  <SignFace sign={sign} />
                  {bend && mainRoad && index === 0 && <MainRoadPlate arms={scene.arms} mainRoad={mainRoad} face={arm} />}
                </g>
              )
            })}
            {signal && <g transform={`translate(${signalPoint.x} ${signalPoint.y})`}><TrafficLight signal={signal} /></g>}
          </g>
        )
      })}
      {scene.crossings?.map((arm) => {
        const phase = scene.pedestrianSignals?.[arm]
        if (!phase) return null
        const { x, y } = roadPoint(arm, 88, 116)
        return <g key={arm} transform={`translate(${x} ${y})`}><PedestrianLight phase={phase} /></g>
      })}
      {ringYield && (
        <g transform={`translate(${centerX + Math.sin(signAngle) * (outerCircle + 14)} ${centerY - Math.cos(signAngle) * (outerCircle + 14)})`}>
          <path d="M 0 3 V 22" stroke="#91928c" strokeWidth="4" strokeLinecap="round" />
          <SignFace sign="2.4" />
        </g>
      )}
    </>
  )
}

function Controller({ controller }: { controller: NonNullable<JunctionScene['controller']> }) {
  const { facing, gesture } = controller
  const arms = gesture === 'arm-up' ? 'M -9 2 L -12 13 M 8 2 L 12 -4'
    : gesture === 'right-forward' ? 'M -9 2 L -12 13 M 9 2 L 9 -17'
      : 'M -9 2 L -12 13 M 9 2 L 12 13'
  return (
    <g transform={`translate(${centerX} ${centerY})`}>
      <circle r="25" fill="#e6b268" fillOpacity=".1" stroke="#e6b268" strokeOpacity=".32" strokeDasharray="3 4" />
      <g transform={`rotate(${bearings[facing]})`}>
        <path d={arms} stroke="#1a1d23" strokeWidth="8" strokeLinecap="round" />
        <path d={arms} stroke="#d8dbe0" strokeWidth="4.4" strokeLinecap="round" />
        <path d="M -5 9 V 17 M 5 9 V 17" stroke="#15181d" strokeWidth="4.5" strokeLinecap="round" />
        <rect x="-9" y="-4" width="18" height="16" rx="5" fill="#f8a452" stroke="#fff0d1" strokeWidth="1" />
        <path d="M -6 4 H 6" stroke="#fff2d4" strokeWidth="2" />
        <circle cy="-7" r="6" fill="#e1bc9e" />
        <path d="M -6 -8 A 6 6 0 0 1 6 -8 H 2 L 0 -10 L -2 -8 Z" fill="#232630" />
        {gesture === 'right-forward' && (
          <path d="M 9 -18 V -28 M 9 -26 V -24 M 9 -22 V -20" stroke="#f8f8f0" strokeWidth="2" strokeLinecap="round" />
        )}
      </g>
      {gesture === 'arm-up' && (
        <g transform="translate(21 -20)">
          <circle r="10" fill="#352b24" stroke="#f8bb77" strokeWidth="1.2" />
          <path d="M 0 5 V -5 M -4 -1 L 0 -5 L 4 -1" stroke="#f8bb77" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      )}
    </g>
  )
}

type BeaconProps = Pick<VehicleParticipant, 'beacon' | 'siren'>

function BeaconGraphic({ beacon, siren }: BeaconProps) {
  if (!beacon) return null
  const beaconColor = beacon === 'amber' ? '#ffbb43' : '#54bfff'
  return (
    <>
      <ellipse rx="16" ry="9" fill={beaconColor} opacity=".23" />
      <rect x="-8" y="-2" width="16" height="4" rx="2" fill={beaconColor} stroke="#fff" strokeOpacity=".55" />
      {beacon === 'blue-red' && <rect y="-2" width="8" height="4" rx="2" fill="#ff555f" />}
      {siren && <path d="M -20 -7 Q -24 0 -20 7 M 20 -7 Q 24 0 20 7" stroke={beaconColor} strokeWidth="1.8" strokeLinecap="round" fill="none" />}
    </>
  )
}

function CarGraphic({ color, beacon, siren }: { color: string } & BeaconProps) {
  return (
    <>
      <rect x="-17" y="-25" width="34" height="57" rx="10" fill="#15171a" opacity=".54" />
      <path d="M -15 -15 V -7 M 15 -15 V -7 M -15 11 V 19 M 15 11 V 19" stroke="#121518" strokeWidth="6" strokeLinecap="round" />
      <rect x="-14.5" y="-27" width="29" height="54" rx="8.5" fill={color} stroke="#fff" strokeOpacity=".39" strokeWidth="1.15" />
      <path d="M -11 -12 Q 0 -16 11 -12 L 8.5 -4 H -8.5 Z" fill="#17242e" />
      <path d="M -8.5 11 H 8.5 L 10.5 17 Q 0 20 -10.5 17 Z" fill="#22303a" opacity=".9" />
      <path d="M -11 -6 V 11 M 11 -6 V 11" stroke="#24313d" strokeWidth="2.7" strokeLinecap="round" opacity=".6" />
      <rect x="-7.7" y="-3" width="15.4" height="13" rx="2.5" fill="#fff" opacity=".11" />
      <path d="M -9 -20 H 9 M -8 22 H 8" stroke="#fff" strokeOpacity=".26" strokeWidth="1" strokeLinecap="round" />
      <path d="M -11 -22 L -7 -23 M 11 -22 L 7 -23" stroke="#fff0d4" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M -11 22 L -8.5 23 M 11 22 L 8.5 23" stroke="#fb717b" strokeWidth="2.3" strokeLinecap="round" />
      <BeaconGraphic beacon={beacon} siren={siren} />
    </>
  )
}

function ParticipantGraphic({ participant }: { participant: Participant }) {
  const { color } = participant
  if (participant.type === 'pedestrian') {
    return (
      <>
        <ellipse cy="4" rx="10" ry="13" fill="#161a1b" opacity=".72" />
        <path d="M -3 5 L -5 12 M 3 5 L 5 11" stroke="#9299a1" strokeWidth="3.7" strokeLinecap="round" />
        <path d="M -4 -3 L -8 4 M 4 -3 L 8 4" stroke={color} strokeWidth="4" strokeLinecap="round" />
        <rect x="-5.4" y="-6" width="10.8" height="13.5" rx="4.1" fill={color} stroke="#fff" strokeOpacity=".4" />
        <circle cy="-9" r="4.5" fill="#f0c6a7" />
        <path d="M -4.4 -9 A 4.4 4.4 0 0 1 4.4 -9" fill="#433a3a" />
      </>
    )
  }
  if (participant.type === 'bicycle') {
    return (
      <>
        <rect x="-3" y="-21" width="6" height="16" rx="3" fill="#121518" stroke="#949d9f" />
        <rect x="-3" y="7" width="6" height="16" rx="3" fill="#121518" stroke="#949d9f" />
        <path d="M 0 -16 V 17 M -7 -10 H 7" stroke={color} strokeWidth="3.1" strokeLinecap="round" />
        <rect x="-5" y="-5" width="10" height="15" rx="4" fill={color} stroke="#fff" strokeOpacity=".45" />
        <circle cy="-5" r="4.7" fill="#d9e9e7" />
      </>
    )
  }
  if (participant.type === 'truck' || participant.type === 'tram') {
    const tram = participant.type === 'tram'
    return (
      <>
        <rect x="-16" y="-35" width="32" height="73" rx="7" fill="#17191c" opacity=".75" />
        <rect x="-14" y="-36" width="28" height={tram ? 72 : 22} rx={tram ? 7 : 6} fill={color} stroke="#f7f8fa" strokeOpacity=".45" strokeWidth="1.15" />
        <path d="M -10 -24 Q 0 -27 10 -24 L 8.5 -18 H -8.5 Z" fill="#1b2a35" />
        <path d="M -9 -31 H -5 M 5 -31 H 9" stroke="#fff0d4" strokeWidth="2.2" strokeLinecap="round" />
        {tram ? (
          <>
            <rect x="-10" y="-10" width="20" height="31" rx="3" fill="#d3d4d0" opacity=".81" />
            <path d="M 0 -8 L 5 4 L 0 15 L -5 4 Z M -8 4 H 8" stroke="#434750" strokeWidth="1.5" fill="none" />
            <path d="M -9 28 H 9" stroke="#293642" strokeWidth="3.8" strokeLinecap="round" />
          </>
        ) : (
          <>
            <rect x="-15" y="-12" width="30" height="48" rx="3.6" fill="#d8dbdb" stroke="#fff" strokeOpacity=".57" />
            <path d="M -10 -8 V 31 M -5 -8 V 31 M 0 -8 V 31 M 5 -8 V 31 M 10 -8 V 31" stroke="#9fa7ab" strokeOpacity=".67" strokeWidth="1.1" />
            <path d="M -11 33 H 11" stroke={color} strokeWidth="2.3" strokeLinecap="round" />
          </>
        )}
        {participant.beacon && <g transform="translate(0 -17)"><BeaconGraphic beacon={participant.beacon} siren={participant.siren} /></g>}
      </>
    )
  }
  return <CarGraphic color={color} beacon={participant.beacon} siren={participant.siren} />
}

function TrafficQueue({ arm }: { arm: Direction }) {
  return (
    <g>
      {[113, 175].map((distance) => {
        const { x, y } = roadPoint(arm, 34, distance)
        return <g key={distance} transform={`translate(${x} ${y}) rotate(${bearings[arm]})`} opacity=".83"><CarGraphic color="#7b8087" /></g>
      })}
    </g>
  )
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  ))
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

const actorDelay = (step: number) => .3 + step * 1.5

function handleActorKey(event: KeyboardEvent<SVGGElement>, choose: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  choose()
}

export default function RoadScene({ scene, participantStates, onSelect, solution, playback }: RoadSceneProps) {
  const id = `junction-scene-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  const reducedMotion = useReducedMotion()
  const activeMotion = Boolean(solution?.length && !reducedMotion)
  const animatedSteps = new Map(solution?.flatMap((step, index) => step.map((actorId) => [actorId, index] as const)))
  const actors = scene.participants.map((participant, index) => {
    const path = participantRoute(participant, scene)
    const step = animatedSteps.get(participant.id)
    return {
      participant, index, step, path,
      state: participantStates.get(participant.id),
      motionPath: activeMotion && step !== undefined ? participantRoute(participant, scene, true) : path,
    }
  })
  const routes = [...actors].sort((left, right) => (
    Number(left.step !== undefined || Boolean(left.state?.selected))
    - Number(right.step !== undefined || Boolean(right.state?.selected))
  ))

  useLayoutEffect(() => {
    if (activeMotion) svgRef.current?.setCurrentTime?.(0)
  }, [activeMotion, playback, scene])

  return (
    <svg
      ref={svgRef}
      className="junction-scene"
      viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
      preserveAspectRatio="xMidYMid slice"
      role="group"
      aria-label="Схема перекрёстка"
      aria-describedby={`${id}-description`}
    >
      <desc id={`${id}-description`}>{scene.caption}</desc>
      <defs>
        <linearGradient id={`${id}-land`} x2="90%" y2="100%">
          <stop stopColor="#212623" />
          <stop offset="1" stopColor="#141817" />
        </linearGradient>
        <linearGradient id={`${id}-asphalt`} x2="100%" y2="100%">
          <stop stopColor="#393b43" />
          <stop offset="1" stopColor="#303239" />
        </linearGradient>
        <radialGradient id={`${id}-island`}>
          <stop stopColor="#344636" />
          <stop offset="1" stopColor="#28372c" />
        </radialGradient>
        <pattern id={`${id}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 H 0 V 24" fill="none" stroke="#e5e6d8" strokeOpacity=".041" />
        </pattern>
        <pattern id={`${id}-grain`} width="13" height="17" patternUnits="userSpaceOnUse">
          <path d="M 1 3 H 3 M 8 13 H 9 M 11 6 H 12" fill="none" stroke="#f0ede4" strokeOpacity=".028" />
        </pattern>
        {scene.participants.map(({ id: actorId, color }, index) => (
          <marker key={actorId} id={`${id}-arrow-${index}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="3.1" markerHeight="3.1" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 Z" fill={color} />
          </marker>
        ))}
      </defs>
      <g aria-hidden="true">
        <Terrain id={id} />
        <RoadSurface scene={scene} id={id} />
        <RoadMarkings scene={scene} />
        <RoadControls scene={scene} />
        {scene.blockedExit && <TrafficQueue arm={scene.blockedExit} />}
        {scene.controller && <Controller controller={scene.controller} />}
        <g className="junction-scene__north" transform="translate(677 35)" opacity=".74" stroke="#d5d8ce">
          <circle r="16" fill="#1b201e" strokeOpacity=".32" />
          <path d="M 0 -9 L 5 5 L 0 2 L -5 5 Z" fill="#d5d8ce" strokeLinejoin="round" />
          <text y="27" textAnchor="middle" fill="#d5d8ce" stroke="none" fontSize="10" fontWeight="750">С</text>
        </g>
        {routes.map(({ participant, index, state, step, path, motionPath }) => {
          const selected = state?.selected
          const opacity = solution ? (step === undefined ? .2 : .7) : selected ? .86 : .52
          return (
            <g key={participant.id}>
              <path
                className="junction-scene__route"
                d={path}
                fill="none"
                stroke={participant.color}
                strokeWidth={selected || step !== undefined ? 4 : 3.1}
                opacity={opacity}
                strokeDasharray="7 7"
                strokeLinecap="round"
                markerEnd={`url(#${id}-arrow-${index})`}
              />
              {step !== undefined && (
                <path
                  key={playback}
                  className="junction-scene__route"
                  d={motionPath}
                  pathLength="100"
                  fill="none"
                  stroke={participant.color}
                  strokeWidth="4.2"
                  strokeLinecap="round"
                  strokeDasharray="100"
                  strokeDashoffset={activeMotion ? 100 : 0}
                >
                  {activeMotion && <animate attributeName="stroke-dashoffset" from="100" to="0" begin={`${actorDelay(step)}s`} dur="1.35s" fill="freeze" />}
                </path>
              )}
            </g>
          )
        })}
      </g>
      {actors.map(({ participant, index, state, step, motionPath }) => {
        const { x, y, angle } = participantPose(participant, scene)
        const moving = activeMotion && step !== undefined
        const interactive = state?.selectable === true
        const actorBadge = state?.step ?? participantLetter(index)
        const badge = participantLabelOffset(participant)
        const choose = () => onSelect(participant.id)
        return (
          <g key={`${participant.id}-${playback}`}>
            <g
              className="junction-scene__actor"
              transform={`translate(${x} ${y})`}
              data-selected={state?.selected || undefined}
              data-subject={state?.subject || undefined}
              data-result={state?.result}
              role={interactive ? 'button' : undefined}
              aria-label={interactive ? participant.label : undefined}
              aria-pressed={interactive ? Boolean(state?.selected) : undefined}
              aria-hidden={!interactive || undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? choose : undefined}
              onKeyDown={interactive ? (event) => handleActorKey(event, choose) : undefined}
            >
              {moving && <set attributeName="visibility" to="hidden" begin={`${actorDelay(step)}s`} />}
              <title>{participant.label}</title>
              <circle r="30" fill="transparent" />
              <circle r="31" fill={participant.color} stroke={participant.color} className="junction-scene__halo" />
              <g transform={`rotate(${angle})`} className="junction-scene__vehicle">
                <ParticipantGraphic participant={participant} />
              </g>
              <g transform={`translate(${badge.x} ${badge.y})`}>
                <circle r="11.5" fill="#171a1e" stroke={participant.color} strokeWidth="1.5" />
                <text dominantBaseline="central" textAnchor="middle" fill="#fff" fontSize="11.5" fontWeight="750">{actorBadge}</text>
              </g>
            </g>
            {moving && (
              <g visibility="hidden" aria-hidden="true">
                <set attributeName="visibility" to="visible" begin={`${actorDelay(step)}s`} />
                <animateMotion begin={`${actorDelay(step)}s`} dur="1.35s" fill="freeze" path={motionPath} rotate="auto" />
                <g transform="rotate(90)"><ParticipantGraphic participant={participant} /></g>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
