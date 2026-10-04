import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'
import './BookNavigation.css'
export default function BookNavigation({ lang, current }) {
 const links = [
  { id: 'library', label: 'lib_title', to: '/child/library' },
  { id: 'archive', label: 'la_title', to: '/child/library?view=archive' },
 ]
 return <nav className="book-navigation" aria-label={t('lib_title', lang)}>
  {links.map(link => <Link key={link.id} to={link.to} aria-current={current === link.id ? 'page' : undefined}><span>{t(link.label, lang)}</span></Link>)}
 </nav>
}
