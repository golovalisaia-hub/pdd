import { useState } from 'react'
import { ArrowUpRight, BookOpen, Lightbulb, Search, Signpost, TrafficCone } from 'lucide-react'
import { Empty, PageTitle } from '../../components/ui'
import { normalizeRule, reference, ruleSource } from '../../domain/reference'
import type { ReferenceGroup } from '../../domain/reference'
import SignArt from './SignArt'

const groups: ReferenceGroup[] = ['Знаки', 'Разметка', 'Светофоры', 'Регулировщик', 'Приоритет', 'Правила']

export default function ReferencePage({ signsOnly, code }: { signsOnly?: boolean; code?: string | null }) {
  const [search, setSearch] = useState(code ?? '')
  const [group, setGroup] = useState<ReferenceGroup | 'Все'>(signsOnly ? 'Знаки' : 'Все')
  const query = normalizeRule(search).replaceAll('ё', 'е')
  const exact = Boolean(code && search === code)
  const items = reference.filter(item => (group === 'Все' || item.group === group) &&
    (!query || (exact ? normalizeRule(item.code) === query : [normalizeRule(item.code), item.title, item.group, item.text].join(' ').toLocaleLowerCase('ru').replaceAll('ё', 'е').includes(query))))
  return <div className="screen-stack">
    <PageTitle title={signsOnly ? 'Дорожные знаки' : 'Справочник ПДД'} description="Знаки, разметка, сигналы и правила с примерами." />
    <div className="reference-toolbar">
      <label className="search-input reference-search"><Search size={20} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Название, номер или тема" aria-label="Поиск по справочнику" /></label>
      <div className="segmented reference-filters" aria-label="Раздел справочника">
        {(['Все', ...groups] as const).map(item => <button type="button" key={item} aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>)}
      </div>
    </div>
    {items.length ? <div className="reference-grid">{items.map(item => {
      const Icon = item.group === 'Светофоры' ? Lightbulb : item.group === 'Регулировщик' ? TrafficCone : item.group === 'Знаки' ? Signpost : BookOpen
      return <article className="panel reference-card" key={item.group + ':' + item.code}>
        <div className="reference-card-top">
          {item.art ? <SignArt art={item.art} /> : <span className="icon-box"><Icon size={23} /></span>}
          <span className="data-label">{item.code}</span>
        </div>
        <h2>{item.title}</h2><p>{item.text}</p>
        <a className="text-link" href={item.source} target="_blank" rel="noreferrer">Читать в ПДД <ArrowUpRight size={15} /></a>
      </article>
    })}</div> : <Empty icon={Search} title="Совпадений нет" text="Попробуй другой номер или название."><a className="button button--secondary" href={ruleSource} target="_blank" rel="noreferrer">Открыть полный текст ПДД <ArrowUpRight size={16} /></a></Empty>}
    <p className="bank-footer">Краткие пояснения к постановлению Правительства РФ № 1090. Редакция от 28 августа 2026 года. <a href={ruleSource} target="_blank" rel="noreferrer">Текст Правил</a></p>
  </div>
}
