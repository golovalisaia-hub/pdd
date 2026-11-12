import { useEffect, useState } from 'react'
import { Activity, BookOpen, Bookmark, ChevronRight, CircleHelp, House, Layers3, ListChecks, Menu, Route, Settings, ShieldCheck, Signpost, Tickets } from 'lucide-react'
import { Dialog } from '../components/ui'
import { publicAssetUrl } from '../publicAssetUrl'

export const mainRoutes = [
  { to: '', name: 'Главная', icon: House },
  { to: 'bilety', name: 'Билеты', icon: Tickets },
  { to: 'perekrestki', name: 'Перекрёстки', icon: Route },
  { to: 'progress', name: 'Прогресс', icon: Activity },
]
const secondaryRoutes = [
  { to: 'ekzamen', name: 'Экзамен', icon: ListChecks },
  { to: 'oshibki', name: 'Работа над ошибками', icon: CircleHelp },
  { to: 'izbrannoe', name: 'Избранное', icon: Bookmark },
  { to: 'temy', name: 'Темы', icon: Layers3 },
  { to: 'znaki', name: 'Дорожные знаки', icon: Signpost },
  { to: 'spravochnik', name: 'Справочник ПДД', icon: BookOpen },
]
export const hashLink = (route = '') => '#/' + route

function readRoute() {
  const [path, search] = (location.hash.replace(/^#\/?/, '') || '').split('?')
  return { path, params: new URLSearchParams(search), key: location.hash }
}

export function useRoute() {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const onHashChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return route
}

export function go(route: string) {
  location.hash = '/' + route
}

function Brand() {
  return <a href="#/" className="brand" aria-label="PDD — главная">
    <img src={publicAssetUrl('pdd-icon.svg')} width="38" height="38" alt="" /><span>PDD</span>
  </a>
}

function Links({ items, current, onClick }: { items: typeof mainRoutes; current: string; onClick?: () => void }) {
  return <>{items.map(({ to, name, icon: Icon }) => {
    const active = to === current || (to === 'bilety' && current === 'trening')
    return <a key={to} href={hashLink(to)} className={'nav-link' + (active ? ' is-active' : '')}
      aria-current={active ? 'page' : undefined} onClick={onClick}>
      <Icon size={19} strokeWidth={1.8} /><span>{name}</span>
    </a>
  })}</>
}

export function Navigation({ current }: { current: string }) {
  const [menu, setMenu] = useState(false)
  return <>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>К содержанию</a>
    <aside className="sidebar">
      <Brand />
      <div className="sidebar-content">
        <p className="nav-label">Обучение</p>
        <nav aria-label="Основная навигация"><Links items={mainRoutes} current={current} /></nav>
        <div className="nav-divider" />
        <p className="nav-label">Материалы</p>
        <nav aria-label="Дополнительные разделы"><Links items={secondaryRoutes} current={current} /></nav>
      </div>
      <div className="sidebar-bottom">
        <a href={hashLink('nastroyki')} className={'nav-link' + (current === 'nastroyki' ? ' is-active' : '')} aria-current={current === 'nastroyki' ? 'page' : undefined}><Settings size={19} strokeWidth={1.8} /><span>Настройки</span></a>
        <div className="privacy"><ShieldCheck size={16} /> <span>Прогресс на устройстве</span></div>
      </div>
    </aside>
    <header className="topbar">
      <div className="topbar-mobile"><Brand /></div>
      <div className="topbar-desktop">
        <span>Подготовка к экзамену</span>
        <ChevronRight size={14} />
        <strong>{[...mainRoutes, ...secondaryRoutes].find(route => route.to === current)?.name ?? (current === 'nastroyki' ? 'Настройки' : 'Тренировка')}</strong>
      </div>
      <div className="topbar-right">
        <span className="category"><span />Категория ABM</span>
        <button className="icon-button mobile-menu" aria-label="Дополнительные разделы" onClick={() => setMenu(true)} type="button"><Menu size={22} /></button>
        <a className="icon-button desktop-settings" href={hashLink('nastroyki')} aria-label="Открыть настройки"><Settings size={19} /></a>
      </div>
    </header>
    <nav className="bottom-nav" aria-label="Основная навигация"><Links items={mainRoutes} current={current} /></nav>
    {menu && <Dialog label="Разделы" onClose={() => setMenu(false)} className="menu-dialog">
      <nav aria-label="Дополнительные разделы">
        <Links items={secondaryRoutes} current={current} onClick={() => setMenu(false)} />
        <a href={hashLink('nastroyki')} className="nav-link" onClick={() => setMenu(false)}><Settings size={19} /><span>Настройки</span></a>
      </nav>
    </Dialog>}
  </>
}
