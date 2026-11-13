import { useState } from 'react'
import { ArrowUpRight, BookOpen, Lightbulb, Search, TrafficCone } from 'lucide-react'
import { Empty, PageTitle } from '../../components/ui'
import { normalizeRule, reference, ruleSource } from '../../domain/reference'
import type { ReferenceGroup } from '../../domain/reference'
import SignArt from './SignArt'

const groups: ReferenceGroup[] = ['Знаки', 'Разметка', 'Светофоры', 'Регулировщик', 'Приоритет', 'Правила']
const signGroups = [
  ['1', 'Предупреждающие'],
  ['2', 'Знаки приоритета'],
  ['3', 'Запрещающие'],
  ['4', 'Предписывающие'],
  ['5', 'Знаки особых предписаний'],
  ['6', 'Информационные'],
  ['8', 'Таблички'],
]
const signStandard = 'https://protect.gost.ru/gost/details/39b75217-29bd-492b-94f4-c0dccb72b299'

function searchText(value: string) {
  return value.toLocaleLowerCase('ru').replaceAll('ё', 'е')
}

export default function ReferencePage({ signsOnly, code }: { signsOnly?: boolean; code?: string | null }) {
  const [search, setSearch] = useState(code ?? '')
  const [group, setGroup] = useState<ReferenceGroup | 'Все'>('Все')
  const [signGroup, setSignGroup] = useState('')
  const query = searchText(normalizeRule(signsOnly ? search.trim().replace(/^(?:знак\s+)?№?\s*/i, '') : search))
  const entries = reference.filter(item => signsOnly
    ? item.group === 'Знаки' && (!signGroup || item.code.startsWith(signGroup + '.'))
    : group === 'Все' || item.group === group)
  const exact = Boolean(code && search === code) || (signsOnly && entries.some(item => item.code === query))
  const items = entries.filter(item => {
    if (!query) return true
    const itemCode = normalizeRule(item.code)
    if (exact) return itemCode === query
    if (signsOnly && /^\d[\d.]*$/.test(query)) return itemCode.startsWith(query)
    const searchable = searchText([itemCode, item.title, item.group, item.text].join(' '))
    return query.split(' ').every(term => searchable.includes(term))
  })

  return <div className="screen-stack">
    <PageTitle title={signsOnly ? 'Дорожные знаки' : 'Справочник ПДД'} description={signsOnly ? 'Найди знак по номеру или названию.' : 'Знаки, разметка, сигналы и правила с примерами.'} />
    <div className={signsOnly ? 'reference-toolbar reference-toolbar--signs' : 'reference-toolbar'}>
      <label className="search-input reference-search">
        <Search size={20} aria-hidden="true" />
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={signsOnly ? 'Номер или название знака' : 'Название, номер или тема'} aria-label={signsOnly ? 'Поиск дорожных знаков' : 'Поиск по справочнику'} />
      </label>
      {signsOnly ? <select className="reference-sign-filter" aria-label="Группа знаков" value={signGroup} onChange={event => setSignGroup(event.target.value)}>
        <option value="">Все группы знаков</option>
        {signGroups.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select> : <div className="segmented reference-filters" aria-label="Раздел справочника">
        {(['Все', ...groups] as const).map(item => <button type="button" key={item} aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>)}
      </div>}
    </div>
    {items.length ? <div className="reference-grid">{items.map(item => {
      const sign = item.group === 'Знаки'
      const Icon = item.group === 'Светофоры' ? Lightbulb : item.group === 'Регулировщик' ? TrafficCone : BookOpen
      return <article className={sign ? 'panel reference-card reference-card--sign' : 'panel reference-card'} key={item.group + ':' + item.code}>
        <div className={sign ? 'reference-card-top reference-card-top--sign' : 'reference-card-top'}>
          {sign || item.art ? <SignArt item={item} /> : <span className="icon-box"><Icon size={23} aria-hidden="true" /></span>}
          <span className="data-label">{item.code}</span>
        </div>
        <h2>{item.title}</h2><p>{item.text}</p>
        <a className="text-link" href={item.source} target="_blank" rel="noreferrer">Читать в ПДД <ArrowUpRight size={15} /></a>
      </article>
    })}</div> : <Empty icon={Search} title="Совпадений нет" text="Попробуй другой номер или название."><a className="button button--secondary" href={ruleSource} target="_blank" rel="noreferrer">Открыть полный текст ПДД <ArrowUpRight size={16} /></a></Empty>}
    {signsOnly
      ? <p className="bank-footer">Изображения по приложению А. <a href={signStandard} target="_blank" rel="noreferrer">ГОСТ Р 52290-2024</a></p>
      : <p className="bank-footer">Краткие пояснения к постановлению Правительства РФ № 1090. Редакция от 28 августа 2026 года. <a href={ruleSource} target="_blank" rel="noreferrer">Текст Правил</a></p>}
  </div>
}
