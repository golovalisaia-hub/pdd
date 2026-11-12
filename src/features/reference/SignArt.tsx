export default function SignArt({ art }: { art: string }) {
  const circle = (fill: string, stroke = 'white') => <circle cx="36" cy="36" r="27" fill={fill} stroke={stroke} strokeWidth="3" />
  const path = (d: string, stroke = 'white', width = 4) => <path d={d} stroke={stroke} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  const title = (text: string, y = 41, size = 15, fill = 'white') => <text x="36" y={y} fontSize={size} textAnchor="middle" fontWeight="800" fill={fill}>{text}</text>
  const diamond = <><path d="M36 7 65 36 36 65 7 36Z" fill="#faf8ef" stroke="#909198" /><path d="M36 15 57 36 36 57 15 36Z" fill="#ffcb49" /></>
  let body
  switch (art) {
    case 'main-road': body = diamond; break
    case 'main-end': body = <>{diamond}{path('M15 57 57 15', '#3a3d44', 5)}</>; break
    case 'yield': body = <path d="M9 17h54L36 63Z" fill="#f7f5ee" stroke="#f34548" strokeWidth="7" strokeLinejoin="round" />; break
    case 'stop': body = <><path d="M25 9h22l16 16v22L47 63H25L9 47V25Z" fill="#ed4146" stroke="white" strokeWidth="2" />{title('STOP')}</>; break
    case 'no-entry': body = <>{circle('#ef444b')}<rect x="14" y="31" width="44" height="10" rx="2" fill="white" /></>; break
    case 'no-left': body = <>{circle('#fcfbf4', '#ef444b')}{path('M42 53V28H23m8-8-8 8 8 8', '#292931')}{path('M17 56 56 17', '#ef444b', 5)}</>; break
    case 'no-pass': body = <>{circle('#fff', '#ef444b')}<path fill="#e94146" d="m15 42 2-10 5-5h8l5 5 2 10Zm4 2h5v4h-5Zm10 0h5v4h-5Z" /><path fill="#25252b" d="m38 42 2-10 5-5h8l5 5 2 10Zm3 2h5v4h-5Zm11 0h5v4h-5Z" /></>; break
    case 'speed': body = <>{circle('#fff', '#ef444b')}{title('40', 44, 24, '#222229')}</>; break
    case 'straight': body = <>{circle('#296dcf')}{path('M36 52V21m-9 9 9-9 9 9')}</>; break
    case 'roundabout': body = <>{circle('#296dcf')}{[0, 120, 240].map(angle => <g key={angle} transform={'rotate(' + angle + ' 36 36)'}>
      {path('M52 32A16 16 0 0 0 38 20m6-5-6 5 5 5', 'white', 3)}
    </g>)}</>; break
    case 'warning-crossing':
    case 'crossing': body = <>
      {art === 'crossing' ? <rect x="7" y="7" width="58" height="58" rx="2" fill="#2f77d2" stroke="white" strokeWidth="2" /> : null}
      <path d="M36 13 61 58H11Z" fill="white" stroke={art === 'warning-crossing' ? '#ef444b' : '#fff'} strokeWidth={art === 'warning-crossing' ? '5' : '1'} strokeLinejoin="round" />
      <circle cx="37" cy="30" r="3" fill="#25252b" />{path('m32 52 6-11 5 10M31 41l5-6 8 5m-8-5 2 6', '#25252b', 2.5)}
    </>; break
    case 'residential': body = <><rect x="8" y="10" width="56" height="52" rx="2" fill="#3075cc" stroke="white" strokeWidth="2" /><path d="M46 30h10v23H46zM39 35h6v18h-6z" fill="white" /><path d="m14 46 2-5 3-3h8l3 4 2 4v6h-3v-2H17v2h-3Z" fill="white" /><circle cx="23" cy="23" r="3" fill="white" />{path('M23 28v8m-4 5 4-5 4 5m-9-10 5-3 5 3', 'white', 2)}<circle cx="32" cy="34" r="2" fill="white" /></>; break
    case 'bend': body = <><rect x="7" y="10" width="58" height="52" rx="4" fill="white" /><path d="M36 16v40M12 36h48" stroke="#27272b" strokeWidth="2" />{path('M36 55V36h23', '#27272b', 8)}</>; break
    case 'stop-sign': body = <><rect x="5" y="20" width="62" height="32" rx="3" fill="#faf9f4" stroke="#37373c" strokeWidth="2" />{title('СТОП', 42, 17, '#242427')}</>; break
    case 'stop-line': body = <>{path('M12 48h48', '#f3f0e7', 6)}{path('M36 38V21m-5 6 5-6 5 6', '#a1a1aa', 2)}</>; break
    case 'solid': body = path('M10 36h52', '#f3f0e7', 4); break
    case 'dashed': body = path('M10 36h10m11 0h10m11 0h10', '#f3f0e7', 4); break
    case 'triangles': body = <path d="M9 30h12l-6 13Zm14 0h12l-6 13Zm14 0h12l-6 13Zm14 0h12l-6 13Z" fill="#f3f0e7" />; break
    case 'zebra': body = <path d="M10 27h8v18h-8zm11 0h8v18h-8zm11 0h8v18h-8zm11 0h8v18h-8zm11 0h8v18h-8z" fill="#f3f0e7" />; break
    case 'grid': body = <><rect x="14" y="14" width="44" height="44" fill="none" stroke="#edbd4e" strokeWidth="2" />{path('M14 14 58 58M58 14 14 58M14 36 36 14 58 36 36 58Z', '#edbd4e', 2)}</>; break
    default: return null
  }
  return <svg viewBox="0 0 72 72" className="reference-art" aria-hidden="true">{body}</svg>
}
