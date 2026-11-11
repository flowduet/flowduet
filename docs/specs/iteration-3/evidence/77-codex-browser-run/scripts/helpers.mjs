export function makeHelpers({tab,cdp,fs,root,assert}){
 const p=tab.playwright;
 const state=()=>tab.getAXState({emit:false});
 const read=async()=>{const r=await cdp.send('Runtime.evaluate',{expression:'localStorage.getItem("flowduet.playground.design")',returnByValue:true});return r.result.value?JSON.parse(r.result.value):null;};
 const waitStatus=(text)=>p.locator('[data-test="doc-status"]').filter({hasText:text}).waitFor({state:'visible',timeoutMs:8000});
 const save=async()=>{await p.getByRole('button',{name:'保存草稿',exact:true}).click();await waitStatus('已保存到本地');return read();};
 const pick=async(name)=>{let promise=p.waitForEvent('filechooser',{timeoutMs:8000});await p.getByRole('button',{name:'打开文档',exact:true}).click();let chooser=await promise;if(chooser.isMultiple())throw new Error('文件输入意外支持多选');await chooser.setFiles([root+'/fixtures/'+name+'.flowduet.json']);await state();};
 const load=async(name='S1',confirm=true)=>{await pick(name);if(await p.locator('[data-test="discard-ok"]').isVisible()){if(confirm)await p.locator('[data-test="discard-ok"]').click();else await p.locator('[data-test="discard-cancel"]').click();await state();}if(confirm)await waitStatus('已打开设计文档');await state();};
 const manager=async()=>{await p.getByRole('button',{name:'表单管理',exact:true}).click();await p.locator('[data-test="form-manager"]').waitFor({state:'visible',timeoutMs:5000});await state();};
 const editor=async(id='form_1')=>{await manager();await p.locator('[data-test="form-edit-btn-'+id+'"]').click();await p.locator('[data-test="form-designer"]').waitFor({state:'visible',timeoutMs:5000});await state();};
 const closeEditor=async(doSave=true)=>{await p.getByRole('button',{name:doSave?'保存表单内容':'取消',exact:true}).filter({visible:true}).click();await p.locator('.el-overlay:has(> .el-overlay-dialog > [data-test="form-manager-edit-dialog"])').waitFor({state:'hidden',timeoutMs:5000});await state();};
 const closeManager=async()=>{await p.locator('[data-test="form-manager-dialog"]').locator(':scope > header > button',{}).click();await p.locator('.el-overlay:has(> .el-overlay-dialog > [data-test="form-manager-dialog"])').waitFor({state:'hidden',timeoutMs:5000});await state();};
 const field=async(title)=>{await p.locator('._fc-m-con').getByText(title,{exact:true}).click();await state();};
 const preview=async(node='approval_1')=>{await p.getByRole('button',{name:'预览表单',exact:true}).click();await p.locator('[data-test="form-preview-dialog"]').waitFor({state:'visible',timeoutMs:5000});await state();await p.locator('[data-test="preview-node-select"]').selectOption(node);await state();};
 const closePreview=async()=>{await p.locator('[data-test="form-preview-dialog"]').locator(':scope > header > button',{}).click();await p.locator('.el-overlay:has(> .el-overlay-dialog > [data-test="form-preview-dialog"])').waitFor({state:'hidden',timeoutMs:5000});await state();};
 const validate=async(ok)=>{await p.getByRole('button',{name:'触发校验',exact:true}).click();await p.locator('[data-test="form-preview-validation"]').filter({hasText:ok?'校验通过':'校验未通过'}).waitFor({state:'visible',timeoutMs:5000});};
 const node=async(title)=>{await p.locator('[data-test="node-card"]').filter({hasText:title}).click();await state();};
 const closeNode=async()=>{await p.locator('[data-test="drawer-save"]').click();await p.locator('[data-test="node-drawer"]').waitFor({state:'hidden',timeoutMs:5000});await state();};
 const dump=async(id)=>{let doc=await save();await fs.writeFile(root+'/'+id+'.flowduet.json',JSON.stringify(doc,null,2));return doc;};
 const defaultForm=async(id)=>{await p.locator('[data-test="default-form-select"]').selectOption(id);await state();};
 return {p,state,read,waitStatus,save,pick,load,manager,editor,closeEditor,closeManager,field,preview,closePreview,validate,node,closeNode,dump,defaultForm};
}
