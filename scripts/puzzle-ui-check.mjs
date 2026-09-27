// Start Vite first. PLAYWRIGHT_CORE=/path/to/playwright node scripts/puzzle-ui-check.mjs
// All remote requests are blocked or mocked: no production account or DB writes.
const { webkit } = await import(process.env.PLAYWRIGHT_CORE ? `${process.env.PLAYWRIGHT_CORE}/index.mjs` : 'playwright')
import {generateQuestion} from '../src/lib/puzzleTemplates.js'
import {explainQuestion} from '../src/lib/puzzleExplain.js'
const types=['matrix','overlay','compound-analogy','compound-mirror','cube-net','hidden-part']
const sheet=types.map((t,i)=>generateQuestion(t==='hidden-part'?'6-7':'11-12',t,79000+i*31))
const publicQ=q=>({type:q.type,layout:q.layout,stem_key:q.stem_key,prompt:q.prompt,options:q.options.map(o=>({spec:o.spec}))})
const browser=await webkit.launch()
const correctMode = process.env.UI_ANSWERS === 'correct'
const base = process.env.PUZZLE_UI_URL || 'http://127.0.0.1:5173'
const devices = [['small',{width:320,height:568}],['landscape',{width:667,height:375}]]
for(const lang of (process.env.UI_LANGS || 'en,tr,es').split(',')) for(const [device,viewport] of devices.filter(([name]) => !process.env.UI_SIZE || name === process.env.UI_SIZE)) {
 const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(lang=>localStorage.setItem('child',JSON.stringify({id:'nvr-ui-fixture',name:'Test',age:12,language:lang})),lang)
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  if(url.origin===new URL(base).origin) return route.continue()
  const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}})
  if(req.method()==='OPTIONS') return json({})
  if(url.pathname.endsWith('/puzzle-session')) return json({session_id:'fixture',questions:sheet.map(publicQ),will_pay:false,gems:0})
  if(url.pathname.endsWith('/answer')){const p=req.postDataJSON(),q=sheet[p.question_index];return json({correct:correctMode,chosen_index:p.chosen_index,correct_index:q.correct_index,why:explainQuestion(q,lang)})}
  if(url.pathname.endsWith('/finish')) return json({total:sheet.length,correct:correctMode?sheet.length:0,gems_earned:0,capped:true})
  return route.abort()
 })
 await page.goto(`${base}/child/puzzle`)
 await page.locator('button.pz-press').click()
 for(let i=0;i<sheet.length;i++) {
  await page.getByText(`${i+1} / ${sheet.length}`,{exact:true}).waitFor()
  const controls=page.locator('button.pz-press')
  await controls.nth((sheet[i].correct_index+(correctMode?0:1))%5).click()
  await controls.last().scrollIntoViewIfNeeded()
  const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth>innerWidth,scroll:[...document.querySelectorAll('.pz-scroll')].some(e=>e.scrollWidth>e.clientWidth), card:[...document.querySelectorAll('.pz-scroll > div')].some(e=>e.scrollWidth>e.clientWidth)}))
  if(overflow.page||overflow.scroll||overflow.card) throw new Error(`${lang}/${device}/${types[i]} overflow ${JSON.stringify(overflow)}`)

  await controls.last().click()
  if (!correctMode) {
  await page.getByText(explainQuestion(sheet[i],lang),{exact:true}).scrollIntoViewIfNeeded()
  const next = page.getByText({en:'Tap to carry on',tr:'Devam etmek için dokun',es:'Toca para seguir'}[lang],{exact:true})
  await next.scrollIntoViewIfNeeded()
  const reachable = await next.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight })
  if (!reachable) throw new Error(`${lang}/${device}/${types[i]} feedback continuation is clipped`)
  await next.click()
  }
 }
 await page.getByText(`${correctMode?sheet.length:0} / ${sheet.length}`,{exact:false}).first().waitFor()
 if(errors.length) throw new Error(errors.join('\n'))
 console.log(lang,device,correctMode?'correct answers':'wrong answers','6 questions and result passed; no overflow; no live requests')
 await page.close()
}
await browser.close()
