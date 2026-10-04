import { t } from '../lib/i18n'
import './BookWorldPicker.css'

export default function BookWorldPicker({ lang, area, archiveOpen, onChoose, onLibrary }) {
  return <nav className="book-worlds" aria-label={t('lib_title', lang)}>
    <div className="book-worlds-choices">
      {[{ id: 'writer', title: 'bw_studio', hint: 'bw_studio_hint', icon: '✏️' },
        { id: 'reader', title: 'bw_explorer', hint: 'bw_explorer_hint', icon: '🧭' }].map(item =>
        <button key={item.id} className={'book-world book-world-' + item.id}
          aria-pressed={!archiveOpen && area === item.id} onClick={() => onChoose(item.id)}>
          <span className="book-world-icon" aria-hidden="true">{item.icon}</span>
          <strong>{t(item.title, lang)}</strong>
          <span className="book-world-hint">{t(item.hint, lang)}</span>
          <span className="book-world-dot" aria-hidden="true">{!archiveOpen && area === item.id ? '●' : '○'}</span>
        </button>)}
    </div>
    <button className="book-world-library" aria-pressed={archiveOpen} onClick={onLibrary}>
      <span className="book-world-library-icon" aria-hidden="true">📚</span>
      <span><strong>{t('la_title', lang)}</strong><small>{t('bw_library_hint', lang)}</small></span>
      <span aria-hidden="true">→</span>
    </button>
  </nav>
}
