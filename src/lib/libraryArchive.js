const COLORS = ['#567660', '#a35f47', '#526c87', '#856484', '#72516f', '#3d807c', '#87594b', '#466b69']
export function bookColor(key) {
  let hash = 0
  for (const c of String(key)) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length]
}
export function archiveItems(books = [], stories = [], childName = '', untitled = '') {
  const normalise = (record, kind) => {
    // Never substitute creation date for a completion date: older books may not have one.
    const date = record.completed_at ? new Date(record.completed_at) : null
    return { key: kind + ':' + record.id, kind, record, title: record.title || untitled,
      author: kind === 'story' ? childName : record.author || '',
      year: date && !isNaN(date) ? date.getFullYear() : null }
  }
  return [...books.filter(b => b.completed).map(b => normalise(b, 'book')),
    ...stories.filter(s => s.status === 'completed').map(s => normalise(s, 'story'))]
    .sort((a, b) => (Date.parse(b.record.completed_at || b.record.created_at) || 0) - (Date.parse(a.record.completed_at || a.record.created_at) || 0) || a.key.localeCompare(b.key))
}
export function filterArchive(items, { query = '', year = '', kind = '', locale = 'en' } = {}) {
  const q = query.trim().toLocaleLowerCase(locale)
  return items.filter(item => (!kind || item.kind === kind) && (!year || item.year === Number(year)) &&
    (item.title + ' ' + item.author).toLocaleLowerCase(locale).includes(q))
}
export function archivePage(items, page, size = 36) {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const currentPage = Math.max(0, Math.min(page, pages - 1))
  return { pages, currentPage, shown: items.slice(currentPage * size, (currentPage + 1) * size) }
}
