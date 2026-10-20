// Run Vite first. All nonlocal browser requests are blocked; no account fixtures needed.
import assert from 'node:assert/strict'
import { generateSession, SKILLS } from '../src/lib/literacy/engine.js'
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_CORE ? `${process.env.PLAYWRIGHT_CORE}/index.mjs` : 'playwright')
const base=process.env.LITERACY_UI_URL||'http://127.0.0.1:5178'
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]) {
 const browser=await type.launch()
 try {
 for(const viewport of [{width:390,height:844},{width:1024,height:768}]) {
  const page=await browser.newPage({viewport}),errors=[],writes=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url())
   if(req.method()!=='GET')writes.push(url.href)
   return url.origin===base?route.continue():route.abort()
  })
  await page.goto(`${base}/literacy-lab`)
  for(const skill of Object.keys(SKILLS)) {
   await page.getByLabel('Practice area').selectOption(skill)
   const q=generateSession(1,skill).items[0]
   if(q.mode==='letters') {
    // Exercise duplicate letter tokens, undo and clear before a correct answer.
    await page.getByRole('button',{name:`Letter ${q.letters[0].letter}, tile ${q.letters[0].id+1}`,exact:true}).click()
    await page.getByRole('button',{name:'Undo',exact:true}).click()
    const used=new Set()
    for(const letter of q.answer) {
     const l=q.letters.find(x=>x.letter===letter&&!used.has(x.id));used.add(l.id)
     await page.getByRole('button',{name:`Letter ${l.letter}, tile ${l.id+1}`,exact:true}).click()
    }
   } else await page.getByRole('button',{name:q.answer,exact:true}).click()
   await page.getByRole('button',{name:'Check answer',exact:true}).click()
   await page.getByRole('heading',{name:'That’s right',exact:true}).waitFor()
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await page.getByRole('button',{name:'Next',exact:true}).click()
  }
  await page.getByLabel('Practice area').selectOption('all')
  // Supported success, wrong choice, then skip to a completed result.
  const sheet=generateSession(1).items
  await page.getByRole('button',{name:'Show hint',exact:true}).click()
  await page.getByRole('button',{name:sheet[0].answer,exact:true}).click()
  await page.getByRole('button',{name:'Check answer',exact:true}).click()
  await page.getByText('You used a hint. This is recorded as supported practice.',{exact:true}).waitFor()
  await page.getByRole('button',{name:'Next',exact:true}).click()
  const wrong=sheet[1].options.find(o=>o.text!==sheet[1].answer)
  await page.getByRole('button',{name:wrong.text,exact:true}).click()
  await page.getByRole('button',{name:'Check answer',exact:true}).click()
  await page.getByRole('heading',{name:'Let’s check',exact:true}).waitFor()
  await page.getByRole('button',{name:'Next',exact:true}).click()
  for(let i=2;i<sheet.length;i++){
   await page.getByRole('button',{name:'I don’t know yet',exact:true}).click()
   await page.getByRole('button',{name:'Next',exact:true}).click()
  }
  await page.getByRole('heading',{name:'Your practice today'}).waitFor()
  await page.getByText('0 independent · 1 with a hint · 9 to practise',{exact:true}).waitFor()
  await page.getByRole('button',{name:'Content inventory',exact:true}).click()
  await page.getByText('100 words and meanings',{exact:true}).click()
  await page.getByRole('button',{name:'Play',exact:true}).click()
  await page.getByRole('button',{name:'Restart',exact:true}).click()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await page.screenshot({path:`/tmp/literacy-${name}-${viewport.width}.png`,fullPage:true})
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[])
  console.log(name,viewport.width,'10 skills + help/wrong/skip/results/inventory passed; no writes')
  await page.close()
 }
 } finally { await browser.close() }
}
