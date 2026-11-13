import type { ReferenceEntry } from '../../domain/reference'
import { publicAssetUrl } from '../../publicAssetUrl'

export default function SignArt({ item }: { item: ReferenceEntry }) {
  if (item.group === 'Знаки') {
    return <div className="reference-sign-tile">
      <img
        className="reference-sign-art"
        src={publicAssetUrl(`media/signs/${item.code}.svg`)}
        alt=""
        decoding="async"
        loading="lazy"
      />
    </div>
  }

  const line = (d: string, stroke = '#f3f0e7', width = 4) =>
    <path d={d} stroke={stroke} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />

  let body
  switch (item.art) {
    case 'stop-line': body = <>{line('M12 48h48', '#f3f0e7', 6)}{line('M36 38V21m-5 6 5-6 5 6', '#a1a1aa', 2)}</>; break
    case 'solid': body = line('M10 36h52'); break
    case 'dashed': body = line('M10 36h10m11 0h10m11 0h10'); break
    case 'triangles': body = <path d="M9 30h12l-6 13Zm14 0h12l-6 13Zm14 0h12l-6 13Zm14 0h12l-6 13Z" fill="#f3f0e7" />; break
    case 'zebra': body = <path d="M10 27h8v18h-8zm11 0h8v18h-8zm11 0h8v18h-8zm11 0h8v18h-8zm11 0h8v18h-8z" fill="#f3f0e7" />; break
    case 'grid': body = <><rect x="14" y="14" width="44" height="44" fill="none" stroke="#edbd4e" strokeWidth="2" />{line('M14 14 58 58M58 14 14 58M14 36 36 14 58 36 36 58Z', '#edbd4e', 2)}</>; break
    default: return null
  }

  return <svg viewBox="0 0 72 72" className="reference-art" aria-hidden="true">{body}</svg>
}
