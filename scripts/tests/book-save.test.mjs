import {test} from 'node:test'
import assert from 'node:assert/strict'
import {saveNewBook,updateBookPages} from '../../src/lib/bookSave.js'
function fake(){let row=null,lose=false;const client={from(){const query={select(){return query},eq(){return query},maybeSingle:async()=>({data:row}),insert(value){row=value;return query},update(value){row={...row,...value};return query},single:async()=>lose?(lose=false,{error:Error('response lost')}):({data:row})};return query}};return {client,lose(){lose=true},get row(){return row}}}
test('retry after a lost insert response returns original book, then saves both page fields',async()=>{const f=fake(),row={id:'book',child_id:'child',title:'Test'};f.lose();await assert.rejects(saveNewBook(f.client,row));assert.deepEqual(await saveNewBook(f.client,row),row);await updateBookPages(f.client,'book','child',{total_pages:240});await updateBookPages(f.client,'book','child',{current_page:35});assert.equal(f.row.total_pages,240);assert.equal(f.row.current_page,35)})
test('failed page writes are not reported as successful',async()=>{const f=fake();f.lose();await assert.rejects(updateBookPages(f.client,'book','child',{total_pages:240}))})
