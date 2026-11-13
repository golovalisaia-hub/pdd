import { useEffect, useId, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowUpRight, BookOpen, Maximize2, Minus, Plus, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ruleLink } from '../domain/reference'
import { publicAssetUrl } from '../publicAssetUrl'

export function Button({ children, className = '', variant = 'secondary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <button type="button" className={'button button--' + variant + ' ' + className} {...props}>{children}</button>
}

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="page-title">
    <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="page-title-actions">{actions}</div>}
  </div>
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="back-link" href={href}><ArrowLeft size={17} />{children}</a>
}

export function Empty({ icon: Icon = BookOpen, title, text, children }: { icon?: LucideIcon; title: string; text: string; children?: ReactNode }) {
  return <section className="panel empty-state">
    <span className="icon-box"><Icon size={23} /></span>
    <h2>{title}</h2><p>{text}</p>{children}
  </section>
}

export function ProgressRing({ value, children, label }: { value: number; children: ReactNode; label: string }) {
  return <div className="progress-ring" role="img" aria-label={label}>
    <svg viewBox="0 0 164 164" aria-hidden="true">
      <circle cx="82" cy="82" r="74" className="ring-base" />
      <circle cx="82" cy="82" r="62" className="ring-detail" />
      <motion.circle cx="82" cy="82" r="74" className="ring-fill"
        transform="rotate(-90 82 82)" initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: Math.min(1, Math.max(0, value / 100)), opacity: value > 0 ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 75, damping: 19 }} />
    </svg>
    <div className="ring-label" aria-hidden="true">{children}</div>
  </div>
}

export function Track({ value }: { value: number }) {
  return <span className="track" aria-hidden="true"><motion.span initial={false} animate={{ width: Math.max(0, Math.min(100, value)) + '%' }} transition={{ type: 'spring', stiffness: 110, damping: 25 }} /></span>
}

export function Dialog({ children, label, onClose, className = '', closeLabel = 'Закрыть окно' }: { children: ReactNode; label: string; onClose: () => void; className?: string; closeLabel?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const labelId = useId()
  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
    return () => { if (element?.open) element.close() }
  }, [])
  return <dialog ref={dialog} className={'dialog ' + className} aria-labelledby={labelId}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <motion.div className="dialog-body" initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
      <div className="dialog-heading"><h2 id={labelId}>{label}</h2><button type="button" className="icon-button" aria-label={closeLabel} onClick={onClose}><X size={20} /></button></div>
      {children}
    </motion.div>
  </dialog>
}

export function Illustration({ src }: { src: string }) {
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [failed, setFailed] = useState(false)
  const url = publicAssetUrl(src)
  if (failed) return <p role="alert" className="notice">Иллюстрация не загрузилась. Проверьте файлы комплекта.</p>
  return <>
    <button type="button" className={'illustration' + (src.startsWith('/media/signs/') ? ' illustration--sign' : '')} aria-label="Увеличить иллюстрацию" onClick={() => { setZoom(1); setOpen(true) }}>
      <img src={url} alt="Иллюстрация к вопросу" decoding="async" onError={() => setFailed(true)} />
      <span className="image-expand"><Maximize2 size={17} /></span>
    </button>
    {open && <Dialog label="Иллюстрация" closeLabel="Закрыть иллюстрацию" onClose={() => setOpen(false)} className="picture-dialog">
      <div className="zoom-tools">
        <button className="icon-button" type="button" aria-label="Уменьшить масштаб" disabled={zoom <= 1} onClick={() => setZoom(value => value - .25)}><Minus size={20} /></button>
        <output>{Math.round(zoom * 100)}%</output>
        <button className="icon-button" type="button" aria-label="Увеличить масштаб" disabled={zoom >= 3} onClick={() => setZoom(value => value + .25)}><Plus size={20} /></button>
      </div>
      <div className="zoom-viewport"><img src={url} alt="Иллюстрация к вопросу" style={{ width: (zoom * 100) + '%' }} /></div>
    </Dialog>}
  </>
}

export function RuleLinks({ rules }: { rules?: string[] }) {
  if (!rules?.length) return null
  return <div className="rule-links">{rules.map(code => {
    const { label, href } = ruleLink(code)
    const external = href.startsWith('https:')
    return <a key={code} className="rule-link" href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      <BookOpen size={14} /> {label}<ArrowUpRight size={13} />
    </a>
  })}</div>
}

export function clockText(ms: number) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000)
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
}

export function durationText(ms: number) {
  const seconds = Math.round(ms / 1000)
  return seconds >= 60 ? Math.floor(seconds / 60) + ' мин ' + (seconds % 60) + ' с' : seconds + ' с'
}

export function shortDate(at: number) {
  const date = new Date(at)
  if (!Number.isFinite(date.getTime())) return 'Дата недоступна'
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function plural(n: number, one: string, few: string, many: string) {
  const remainder = Math.abs(n) % 100
  if (remainder > 10 && remainder < 20) return many
  return remainder % 10 === 1 ? one : remainder % 10 >= 2 && remainder % 10 <= 4 ? few : many
}
