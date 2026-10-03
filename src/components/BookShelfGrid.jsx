// Covers stay book-sized on wide screens and wrap naturally on phones.
export default function BookShelfGrid({ items, renderItem }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(140px, 100%), 1fr))', gap: '24px 20px', maxWidth: 1040, alignItems: 'start' }}>
      {items.map((item, i) => (
        <div key={item.id} style={{ width: '100%', maxWidth: 190, minWidth: 0 }}>
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  )
}
