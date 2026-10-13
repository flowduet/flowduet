export async function runRequired(qa,tab,id){return qa.run(id,async()=>{
 if(await qa.q.p.locator('[data-test="form-preview-dialog"]').isVisible())await qa.q.closePreview();
 const n=Number(id.slice(1))-15,p=tab.playwright,q=qa.q,titles=['申请人','申请说明','申请金额','申请类型','申请附件类别','申请部门','申请日期','紧急申请'];
 await q.load(n===7?'S1':'no-default-'+(n+1));await q.preview();let v=p.locator('[data-test="form-preview-dialog"]');
 if(n!==4)await v.locator('.el-checkbox',{}).filter({has:p.getByRole('checkbox',{name:'是',exact:true})}).click();
 if(n<7){await q.validate(false);qa.assert((await v.innerText()).includes(titles[n]),'字段错误未呈现');}
 if(n<2)await v.getByRole('textbox',{name:new RegExp(titles[n])}).fill(n?'一行\n二行':'必填中文');
 if(n===2)await v.getByRole('spinbutton',{name:/申请金额/}).fill('0');
 if(n===3)await v.locator('.el-radio',{}).filter({has:p.getByRole('radio',{name:'否',exact:true})}).click();
 if(n===4)await v.locator('.el-checkbox',{}).filter({has:p.getByRole('checkbox',{name:'是',exact:true})}).click();
 if(n===5){await v.locator('.el-select__wrapper',{}).click();await p.getByRole('option',{name:'否',exact:true}).click();}
 if(n===6){let date=v.getByRole('combobox',{name:/申请日期/});await date.fill('2026-10-12');await date.press('Enter');}
 await q.state();await q.validate(true);
 if(n===2){await v.getByRole('spinbutton',{name:/申请金额/}).fill('12');await q.validate(true);}
 if(n===7){await v.locator('.el-switch',{}).click();await q.validate(true);await v.locator('.el-switch',{}).click();await q.validate(true);}
 await qa.fs.writeFile(qa.root+'/'+id+'-validation.jpg',await tab.getScreenshot({emit:false}));await q.closePreview();return {emptyRejected:n<7,validAccepted:true,falseAndZeroValid:n===2||n===7};
});}
