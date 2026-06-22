// 3-across cover grid with a thin "shelf" board under each row, per
// design_handoff_book_open_animation/README.md ("My Stories shelf"). Used by
// LibraryScreen's "Books by {child}" grid and StoriesScreen's "My Stories" grid.
export default function BookShelfGrid({ items, renderItem }) {
  const rows = []
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3))

  return (
    <div>
      {rows.map((row, ri) => (
        <div key={ri}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'end' }}>
            {row.map((item, ci) => renderItem(item, ri * 3 + ci))}
          </div>
          <div style={{ height: 12, margin: '0 -4px 26px', borderRadius: '0 0 6px 6px', background: 'linear-gradient(#fff,#f3ecfd)', boxShadow: '0 8px 14px -6px rgba(120,90,200,.28)' }} />
        </div>
      ))}
    </div>
  )
}
