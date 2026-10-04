export const CHILD = '11111111-1111-4111-8111-111111111111';
export const OTHER = '22222222-2222-4222-8222-222222222222';
export const STORY = '33333333-3333-4333-8333-333333333333';
export function memoryDB() {
  const tables = { children: [{id: CHILD, age: 10, name: 'Test', language: 'tr', parent_id: OTHER}], stories: [] };
  const db = { tables, from(table) {
    let operation = 'read', values, filters = [];
    const query = {
      select() { return query; }, eq(k,v) { filters.push(row => row[k] === v); return query; },
      update(v) { operation = 'update'; values = v; return query; },
      insert(v) { operation = 'insert'; values = v; return query; },
      async maybeSingle() { return run(); }, async single() { return run(); },
      then(resolve,reject) { return Promise.resolve(run()).then(resolve,reject); }
    };
    function run() {
      const rows = tables[table] || [];
      if (operation === 'insert') {
        if (rows.some(r=>r.id===values.id)) return {data:null,error:{code:'23505'}};
        const row = { revision:0, created_at: new Date().toISOString(), updated_at:new Date().toISOString(), ...values };
        rows.push(row); return {data:structuredClone(row),error:null};
      }
      const row = rows.find(r=>filters.every(f=>f(r)));
      if (!row) return {data:null,error:null};
      if (operation === 'update') Object.assign(row,values,{revision:row.revision+1,updated_at:new Date().toISOString()});
      return {data:structuredClone(row),error:null};
    }
    return query;
  }};
  return db;
}
export async function invoke(handler, body, childId = CHILD) {
  let status=200, payload;
  await handler({params:{childId},body}, {status(n){status=n;return this},json(v){payload=v;return this}});
  return {status,...payload};
}
