import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { storyDraftHandler, storyAssessmentHandler } from '../../server/storyDrafts.js';
import { memoryDB, invoke, CHILD, OTHER, STORY } from './helpers/story-memory.mjs';
const text = 'Bir çocuk ormana gitti ve orada küçük bir kuş buldu. Kuşu yuvasına götürüp arkadaşlarıyla eve döndü.';
const body = (extra={}) => ({ id:STORY, revision:0, title:'Orman', text,...extra });
test('draft retries create one row, preserve words and never award gems', async()=>{
 const db=memoryDB(), handler=storyDraftHandler(db);
 assert.equal((await invoke(handler,body())).status,200);
 assert.equal((await invoke(handler,body())).status,200);
 assert.equal(db.tables.stories.length,1);
 assert.equal(db.tables.stories[0].transcribed_text,text);
 assert.equal(db.tables.stories[0].gems_earned,0);
});
test('stale edits cannot overwrite a newer draft; lost update response can be retried',async()=>{
 const db=memoryDB(),h=storyDraftHandler(db); await invoke(h,body());
 const update=body({text:text+' Yeni bölüm.'});
 assert.equal((await invoke(h,update)).story.revision,1);
 assert.equal((await invoke(h,update)).status,200);
 assert.equal((await invoke(h,body({text:'stale'}))).status,409);
 assert.equal(db.tables.stories[0].transcribed_text,update.text);
});
test('cross-child ID, oversized input and deleted nonzero revision cannot create or overwrite',async()=>{
 const db=memoryDB(),h=storyDraftHandler(db);await invoke(h,body());
 db.tables.children.push({id:OTHER});
 assert.equal((await invoke(h,body({text:'intruder'}),OTHER)).status,409);
 assert.equal((await invoke(h,body({text:'x'.repeat(50001)}))).status,400);
 db.tables.stories=[];
 assert.equal((await invoke(h,body({revision:1}))).status,409);
});
test('emptying an existing draft is persisted; completed drafts cannot reopen',async()=>{
 const db=memoryDB(),h=storyDraftHandler(db);await invoke(h,body());
 assert.equal((await invoke(h,body({text:''}))).story.transcribed_text,'');
 db.tables.stories[0].status='completed';
 assert.equal((await invoke(h,body({revision:1}))).status,409);
});
test('assessment keeps original text, caches retry and rejects a concurrent edit',async()=>{
 const db=memoryDB(),h=storyDraftHandler(db);await invoke(h,body());
 let calls=0;
 const a=storyAssessmentHandler(db,async()=>{calls++;return {quality:80,encouragement:'Merak ettim!',has_profanity:false,transcribed_text:'rewritten',spelling_errors:[]}});
 const r=await invoke(a,{id:STORY,revision:0});
 assert.equal(r.evaluation.transcribed_text,text);
 assert.equal(r.story.revision,1);
 assert.equal((await invoke(a,{id:STORY,revision:1})).status,200);
 assert.equal(calls,1);
 const racing=storyAssessmentHandler(db,async()=>{await invoke(h,body({revision:2,text:text+' Son.'}));return {quality:80,encouragement:'OK',has_profanity:false}});
 await invoke(h,body({revision:1,text:text+' Bölüm.'}));
 assert.equal((await invoke(racing,{id:STORY,revision:2})).status,409);
});
test('actual completion route awards once and uses server assessment instead of client quality',async()=>{
 const db=memoryDB(),h=storyDraftHandler(db);await invoke(h,body());
 db.tables.stories[0].draft_assessment={transcribed_text:text,quality:73,has_profanity:false};
 const source=fs.readFileSync(new URL('../../server/index.js',import.meta.url),'utf8');
 const start=source.indexOf("app.post('/api/children/:childId/stories',");
 const end=source.indexOf("\napp.delete('/api/children/:childId/stories/",start);
 let handler,awards=0,observedQuality,notices=0;
 vm.runInNewContext(source.slice(start,end),{
  app:{post(_p,h){handler=h}},supabase:db,console,Date,
  countWords:s=>s.trim().split(/\s+/).length,WRITING_DEFAULTS:{},
  taskSettingsFor:()=>({active:true,dailyCap:3,gems:30}),tzForChild:async()=> 'UTC',
  rewardedToday:async()=>0,rewardScale:q=>{observedQuality=q;return 1},effortScale:()=>1,
  recordGems:async()=>{awards++},queueDailyBonus:()=>{},
  screenChildInput:async()=>({concern_level:'none'}),sendNotification:async()=>{notices++}
 });
 const request={storyId:STORY,expectedRevision:0,status:'completed',corrected_text:text,transcribed_text:text,quality:100};
 const result=await invoke(handler,request);
 assert.equal(result.status,200);assert.equal(awards,1);assert.equal(notices,1);assert.equal(observedQuality,73);
 await invoke(handler,request);assert.equal(awards,1);
 assert.equal((await invoke(handler,{...request,expectedRevision:result.story.revision,status:'in_progress'})).status,409);
 assert.equal((await invoke(handler,{...request},OTHER)).status,404);
});
