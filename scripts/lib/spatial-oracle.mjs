// Independent answer checks: never import the production transforms, folder or key.
// Slots are read in screen coordinates; cube face normals are hand-folded fixtures
// for the three supported nets, with handedness checked by a determinant.
const key = s => s.parts.map(p => `${p.x},${p.y},${p.shape},${p.fill}`).sort().join('|')
function moved(s, turn, invert, mirror) {
  return { parts: s.parts.map(p => {
    const x = mirror ? 2-p.x : p.x, y = p.y
    const coords = [[x,y],[2-y,x],[2-x,2-y],[y,2-x]][turn]
    return { ...p, x: coords[0], y: coords[1], fill: invert ? 1-p.fill : p.fill }
  }) }
}
const normals = [
  { '1,0':[0,-1,0], '0,1':[-1,0,0], '1,1':[0,0,1], '2,1':[1,0,0], '1,2':[0,1,0], '1,3':[0,0,-1] },
  { '0,0':[0,0,1], '1,0':[1,0,0], '1,1':[0,1,0], '2,1':[0,0,-1], '2,2':[-1,0,0], '3,2':[0,-1,0] },
  { '0,0':[0,0,1], '0,1':[0,1,0], '1,1':[1,0,0], '2,1':[0,-1,0], '3,1':[-1,0,0], '3,2':[0,0,-1] },
]
export function spatialOracle(q) {
  let accepts
  if (q.type === 'cube-net') {
    const cells = q.prompt[0].cells
    const map = normals.find(n => cells.every(c => n[`${c.x},${c.y}`]))
    if (!map) return 'unknown net in independent oracle'
    accepts = o => {
      const ns = o.spec.faces.map(s => { const c=cells.find(c=>c.symbol===s); return map[`${c.x},${c.y}`] })
      const [a,b,c]=ns
      const determinant=a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0])
      // Read the question's actual stem, not its hidden rule flag.
      return q.stem_key === 'puzzle_stem_cube_not' ? determinant !== -1 : determinant === -1
    }
  } else if (q.type === 'hidden-part') {
    const target = q.prompt[0].parts[0]
    accepts = o => o.spec.parts.some(p=>p.shape===target.shape && p.fill===target.fill)
  } else {
    let predictions=[]
    if (q.type === 'overlay') predictions=[{parts:q.prompt.flatMap(s=>s.parts)}]
    if (q.type === 'compound-mirror') predictions=[moved(q.prompt[0],0,false,true)]
    if (q.type === 'compound-analogy') {
      for(let t=0;t<4;t++) for(const f of [false,true]) for(const m of [false,true]) {
        if(key(moved(q.prompt[0],t,f,m))===key(q.prompt[1])) predictions.push(moved(q.prompt[2],t,f,m))
      }
    }
    if (q.type === 'matrix') {
      // Infer a single horizontal step from all complete adjacent pairs, and a
      // single vertical fill step. Test the blank by those local constraints,
      // rather than reconstructing the generator's base cell and indices.
      accepts = o => {
        const cells=q.prompt.map(s=>s || o.spec)
        const symbols=['circle','square','diamond','cross']
        return [1,3].some(t=>[1,3].some(step=>cells.every((s,k)=> {
          const down=moved(s,0,true,false)
          down.parts.forEach(p=>{p.shape=symbols[(symbols.indexOf(p.shape)+step)%4]})
          return (k%3===2 || key(moved(s,t,false,false))===key(cells[k+1])) &&
            (k>=6 || key(down)===key(cells[k+3]))
        })))
      }
    } else {
      const keys=new Set(predictions.map(key))
      if(keys.size!==1) return 'ambiguous spatial example'
      accepts=o=>keys.has(key(o.spec))
    }
  }
  const matches=q.options.map(accepts)
  return matches.filter(Boolean).length===1 && matches[q.correct_index] ? null : 'independent spatial answer mismatch'
}
