export async function executeDefault(qa,tab,id){
 const n=Number(id.slice(1))-7;
 const titles=['申请人','申请说明','申请金额','申请类型','申请附件类别','申请部门','申请日期','紧急申请'];
 const fields=['apply_text','apply_textarea','apply_number','apply_radio','apply_checkbox','apply_select','apply_date','apply_switch'];
 const vals=['中文验收默认','第一行验收\n第二行验收',0,'0',[], '0','2026-10-12',false];
 const p=tab.playwright, q=qa.q;
 const choose=async(label)=>{await p.locator('.el-select__wrapper').filter({has:p.getByRole('combobox',{name:'默认值',exact:true})}).click();await q.state();await p.getByRole('option',{name:label,exact:true}).click();await q.state();};
 const toggle=async(enabled)=>{let input=p.getByRole('switch',{name:'设置默认值',exact:true});let value=await input.evaluate(el=>el.checked);if(value!==enabled)await p.locator('.el-switch').filter({has:input}).click();await q.state();};
 const readCurrent=async()=>{await qa.fs.writeFile(qa.root+'/'+id+'-editor.jpg',await tab.getScreenshot({emit:false}));await q.closeEditor();await q.closeManager();let doc=await q.dump(id);let rule=JSON.parse(doc.forms[0].rules).find(r=>r.field===fields[n]);qa.assert(!!rule,'字段ID丢失');return {doc,rule};};
 return qa.run(id,async()=>{
  await q.load(n===4?'S1':'no-default-'+(n+1));await q.save();await q.editor();await q.field(titles[n]);
  if(n===0||n===1){await p.getByRole('textbox',{name:'默认值',exact:true}).fill(vals[n]);}
  else if(n===2){await p.getByRole('spinbutton',{name:'默认值',exact:true}).fill('1');await p.getByRole('spinbutton',{name:'默认值',exact:true}).fill('0');}
  else if(n===3||n===5){await choose('是');await choose('否');}
  else if(n===6){let input=p.getByRole('combobox',{name:'默认值',exact:true});await input.fill('2026-10-12');await input.press('Enter');}
  else if(n===7){await choose('开启');await choose('关闭');}
  else{
    await toggle(false);let unset=await readCurrent();qa.assert(!Object.hasOwn(unset.rule,'value'),'未设置多选仍含value');
    await q.editor();await q.field(titles[n]);await toggle(true);let empty=await readCurrent();qa.assert(Array.isArray(empty.rule.value)&&empty.rule.value.length===0,'显式[]被丢失');
    await q.editor();await q.field(titles[n]);let combo=p.getByRole('combobox',{name:'默认选项',exact:true});await p.locator('.el-select__wrapper').filter({has:combo}).click();await p.getByRole('option',{name:'是',exact:true}).click();await q.state();let nonempty=await readCurrent();qa.assert(JSON.stringify(nonempty.rule.value)==='["1"]','多选非空数组不正确');return {unsetAbsent:true,explicitEmptyPreserved:true,nonempty:nonempty.rule.value};
  }
  let result=await readCurrent();qa.assert(JSON.stringify(result.rule.value)===JSON.stringify(vals[n]),'默认值或类型变化',{actual:result.rule.value,expected:vals[n]});
  await q.preview();let view=p.locator('[data-test="form-preview-dialog"]'),actual;
  if(n===0||n===1)actual=await view.getByRole('textbox',{name:new RegExp(titles[n])}).evaluate(el=>el.value);
  else if(n===2)actual=Number(await view.getByRole('spinbutton',{name:new RegExp(titles[n])}).evaluate(el=>el.value));
  else if(n===3){actual=await view.getByRole('radio',{name:'否',exact:true}).evaluate(el=>el.checked)?'0':undefined;}
  else if(n===5)actual=await view.getByRole('combobox',{name:new RegExp(titles[n])}).evaluate(el=>el.value==='0'?'0':el.closest('.el-select').innerText.trim()==='否'?'0':el.value);
  else if(n===6)actual=await view.getByRole('combobox',{name:new RegExp(titles[n])}).evaluate(el=>el.value);
  else if(n===7)actual=await view.getByRole('switch',{name:new RegExp(titles[n])}).evaluate(el=>el.checked);
  qa.assert(JSON.stringify(actual)===JSON.stringify(vals[n]),'真实可见字段未回显默认值',{actual,expected:vals[n]});await q.closePreview();
  return {field:fields[n],value:result.rule.value,type:typeof result.rule.value,previewCorrect:true};
 });
}
