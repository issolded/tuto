// Keep the same ID on retry so a lost response cannot create a second book.
export async function saveNewBook(client, row) {
 const existing=await client.from('books').select('*').eq('id',row.id).eq('child_id',row.child_id).maybeSingle()
 if(existing.error)throw existing.error
 if(existing.data)return existing.data
 const result=await client.from('books').insert(row).select('*').single()
 if(result.error)throw result.error
 if(!result.data?.id)throw new Error('Book save returned no row')
 return result.data
}
export async function updateBookPages(client, id, childId, changes) {
 const result=await client.from('books').update(changes).eq('id',id).eq('child_id',childId).select('*').single()
 if(result.error)throw result.error
 if(!result.data?.id)throw new Error('Book update returned no row')
 return result.data
}
