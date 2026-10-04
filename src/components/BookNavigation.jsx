import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'
import './BookNavigation.css'
export default function BookNavigation({ lang, current, settings = {} }) {
 const links = [
  { id: 'reading', label: 'task_reading', icon: '📖', to: '/child/reading' },
  { id: 'writing', label: 'task_writing', icon: '✏️', to: '/child/stories' },
  { id: 'library', label: 'lib_title', to: '/child/library' },
  { id: 'archive', label: 'la_title', icon: '🗄️', to: '/child/library?view=archive' },
 ]
 return <nav className="book-navigation" aria-label={t('lib_title', lang)}>
  {links.filter(link => link.id !== current && (settings?.[link.id]?.active ?? true)).map(link => <Link key={link.id} to={link.to}><span>{link.icon} {t(link.label, lang)}</span><span aria-hidden="true">→</span></Link>)}
 </nav>
}
