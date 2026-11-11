import fs from 'node:fs/promises';
import {makeHelpers} from './helpers.mjs';
export async function init(tab,cdp){
 const root='/Users/l/Documents/projects/flowduet/docs/specs/iteration-3/evidence/77-codex-browser-run';
 let manifest=JSON.parse(await fs.readFile(root+'/case-manifest.json','utf8'));
 let ledger=JSON.parse(await fs.readFile(root+'/results.json','utf8'));
 const persist=()=>fs.writeFile(root+'/results.json',JSON.stringify(ledger,null,2));
 const assert=(ok,message,data)=>{if(!ok){let e=new Error(message);e.qaProduct=true;e.data=data;throw e;}};
 const q=makeHelpers({tab,cdp,fs,root,assert});
 const run=async(id,fn)=>{
  let previous=ledger.results[id], c=manifest.cases.find(x=>x.id===id);
  let attempts=previous?.attempts??[];
  if(previous?.status!=='待执行'){
   let n=attempts.length+1;await fs.writeFile(root+'/'+id+'-attempt'+n+'.json',JSON.stringify(previous,null,2));
   for(let ext of ['jpg','ax.txt']){try{await fs.copyFile(root+'/'+id+'.'+ext,root+'/'+id+'-attempt'+n+'.'+ext);}catch{}}
   attempts=[...attempts,{status:previous.status,evidence:id+'-attempt'+n+'.json'}];
  }
  let e={title:c.title,source:c.source,method:c.method,startedUTC:new Date().toISOString(),status:'执行中',attempts};ledger.results[id]=e;await persist();
  try{e.actual=await fn();e.status='通过';}catch(err){e.status=err.qaProduct?'失败':'待诊断';e.error=String(err.message??err);e.actual=err.data;}
  await fs.writeFile(root+'/'+id+'.ax.txt',await tab.getAXState({emit:false,disableDiffing:true}));await fs.writeFile(root+'/'+id+'.jpg',await tab.getScreenshot({emit:false}));e.completedUTC=new Date().toISOString();e.evidence=[id+'.ax.txt',id+'.jpg'];await persist();return {id,status:e.status,actual:e.actual,error:e.error};
 };
 const guard=async(id)=>run(id,async()=>{
  await q.load('S1');let base=await q.save();await q.defaultForm('form_2');await q.node('经理审批');await tab.playwright.getByRole('textbox',{name:'节点名称',exact:true}).fill('未保存守卫'+id);await q.closeNode();
  await q.pick(id);if(await tab.playwright.locator('[data-test="discard-ok"]').isVisible())await tab.playwright.locator('[data-test="discard-ok"]').click();
  await tab.playwright.locator('[data-test="doc-error"]').waitFor({state:'visible',timeoutMs:6000});await tab.playwright.locator('[data-test="discard-dialog"]').waitFor({state:'hidden',timeoutMs:5000});
  let error=await tab.playwright.locator('[data-test="doc-error"]').textContent();assert(await tab.playwright.locator('[data-test="dirty-badge"]').isVisible(),'dirty丢失');let saved=await q.dump(id);
  assert(JSON.stringify(saved.forms)===JSON.stringify(base.forms),'拒绝后目录改变');assert(saved.xml.includes('flowduet:defaultFormKey="form_2"')&&saved.xml.includes('未保存守卫'+id),'拒绝后模型被替换');return {rejected:true,error,preservedForms:true,preservedUnsavedModel:true,preservedDirty:true};
 });
 return {fs,root,manifest,ledger,persist,assert,q,run,guard};
}
