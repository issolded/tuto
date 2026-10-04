import test from 'node:test'
import assert from 'node:assert/strict'
import { archiveItems, filterArchive, archivePage, bookColor } from '../../src/lib/libraryArchive.js'
test('empty archive has no invented books and ignores unfinished records', () => {
 assert.deepEqual(archiveItems(), [])
 const result=archiveItems([{id:'a',title:'Reading',completed:false},{id:'b',title:'Done',completed:true,created_at:'2025-01-01'}],[{id:'a',status:'in_progress'},{id:'b',status:'completed',completed_at:'2026-03-05'}],'Alp','Untitled')
 assert.equal(result.length,2);assert.equal(new Set(result.map(x=>x.key)).size,2)
 assert.equal(result.find(x=>x.kind==='book').year,null)
 assert.equal(result.find(x=>x.kind==='story').author,'Alp')
})
test('newly completed book joins the archive; filtering and paging keep all records', () => {
 const books=Array.from({length:129},(_,i)=>({id:String(i),title:i===0?'İnci':'Book '+i,completed:true,completed_at:'2026-01-01'}))
 const items=archiveItems(books,[])
 assert.equal(filterArchive(items,{query:'inci',locale:'tr'}).length,1)
 assert.equal(filterArchive(items,{year:'2025'}).length,0)
 const all=[0,1,2,3].flatMap(p=>archivePage(items,p).shown)
 assert.equal(new Set(all.map(x=>x.key)).size,129)
 assert.equal(archivePage(items,100).currentPage,3)
 assert.equal(archivePage([],9).currentPage,0)
 books.push({id:'new',title:'New',completed:false});assert.equal(archiveItems(books,[]).length,129)
 books.at(-1).completed=true;assert.equal(archiveItems(books,[]).length,130)
 assert.equal(bookColor('book:new'),bookColor('book:new'))
})
