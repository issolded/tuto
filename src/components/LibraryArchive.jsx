import { useRef, useState, useEffect } from 'react'
import { t, localeFor } from '../lib/i18n'
import { archiveItems, filterArchive, bookColor, archivePage } from '../lib/libraryArchive'
import './LibraryArchive.css'

function Cover({ item }) {
  return <div className="la-cover" style={{ backgroundColor: bookColor(item.key) }}>
    {item.record.cover_url ? <img src={item.record.cover_url} alt="" loading="lazy" /> : <span aria-hidden="true">✦</span>}
    <strong>{item.title}</strong><small>{item.author}</small>
  </div>
}

export default function LibraryArchive({ books, stories, childName, lang, onBack, onStory, onRemove }) {
  const [query, setQuery] = useState('')
  const [year, setYear] = useState('')
  const [kind, setKind] = useState('')
  const [mode, setMode] = useState('room')
  const [page, setPage] = useState(0)
  const [selectedKey, setSelectedKey] = useState(null)
  const [detail, setDetail] = useState(null)
  const dialog = useRef(null)
  const s = key => t(key, lang)
  const items = archiveItems(books, stories, childName, s('story_untitled'))
  const filtered = filterArchive(items, { query, year, kind, locale: localeFor(lang) })
  const { shown, currentPage, pages } = archivePage(filtered, page)
  const selected = shown.find(item => item.key === selectedKey) || shown[0]
  const years = [...new Set(items.map(item => item.year).filter(Boolean))].sort((a, b) => b - a)
  const change = fn => value => { fn(value); setPage(0); setSelectedKey(null) }
  useEffect(() => { if (detail && !dialog.current?.open) dialog.current?.showModal() }, [detail])
  return <section className="la-archive">
    <button className="la-soft" onClick={onBack}>← {s('lib_title')}</button>
    <h1>{s('la_title')}</h1>
    <div className="la-filters">
      <input aria-label={s('la_search')} placeholder={s('la_search')} value={query} onChange={e => change(setQuery)(e.target.value)} />
      {years.length > 0 && <select aria-label={s('la_year')} value={year} onChange={e => change(setYear)(e.target.value)}><option value="">{s('la_year')}</option>{years.map(y => <option key={y}>{y}</option>)}</select>}
      <select aria-label={s('la_kind')} value={kind} onChange={e => change(setKind)(e.target.value)}><option value="">{s('la_kind')}</option><option value="book">{s('la_read')}</option><option value="story">{s('la_written')}</option></select>
    </div>
    <div className="la-modes"><button className="la-soft" aria-pressed={mode === 'room'} onClick={() => setMode('room')}>{s('la_room')}</button><button className="la-soft" aria-pressed={mode === 'covers'} onClick={() => setMode('covers')}>{s('la_covers')}</button><span aria-live="polite">{filtered.length} {s('chip_books')}</span></div>
    {mode === 'room' ? <>
      <p className="la-hint">{s('la_hint')}</p>
      <div className="la-room-scroll" tabIndex={0} aria-label={s('la_room')}><div className="la-room">
        {[0, 1, 2].map(row => <div className={'la-shelf la-shelf-' + row} key={row}>
          {shown.slice(row * 12, row * 12 + 12).map(item => <button key={item.key} className="la-spine" style={{ '--cover': bookColor(item.key) }} aria-label={item.title + (item.author ? ' — ' + item.author : '')} aria-pressed={item.key === selected?.key} onClick={() => setSelectedKey(item.key)}><span aria-hidden="true">{item.title}</span></button>)}
        </div>)}
        {selected ? <button className="la-chair" aria-label={s('la_open') + ': ' + selected.title} onClick={() => setDetail(selected)}><Cover item={selected} /><span>{s('la_open')} →</span></button> : <div className="la-room-empty">{s(items.length ? 'la_no_match' : 'la_empty')}</div>}
      </div></div>
    </> : shown.length ? <div className="la-cover-grid">{shown.map(item => <button key={item.key} aria-label={item.title} onClick={() => setDetail(item)}><Cover item={item} /></button>)}</div> : <p>{s(items.length ? 'la_no_match' : 'la_empty')}</p>}
    {pages > 1 && <nav className="la-pages" aria-label={s('la_title')}><button className="la-soft" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>← {s('la_prev')}</button><span>{currentPage + 1} / {pages}</span><button className="la-soft" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>{s('la_next')} →</button></nav>}
    <dialog aria-label={detail?.title} ref={dialog} className="la-dialog" onCancel={() => setDetail(null)} onClose={() => setDetail(null)}>
      {detail && <><button className="la-soft la-close" onClick={() => { dialog.current.close(); setDetail(null) }}>{s('la_close')}</button><div className="la-detail"><Cover item={detail} /><div><h2>{detail.title}</h2><p>{detail.author}</p>{detail.year && <p>{s('la_finished_year')}: {detail.year}</p>}</div></div>{detail.kind === 'story' && <button className="la-soft" onClick={() => { dialog.current.close(); setDetail(null); onStory(detail.record) }}>{s('la_open')}</button>}{detail.kind === 'book' && <button className="la-soft" onClick={() => { dialog.current.close(); setDetail(null); onRemove(detail.record.id) }}>{s('lib_remove')}</button>}</>}
    </dialog>
  </section>
}
