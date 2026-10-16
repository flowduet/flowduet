from pathlib import Path
import subprocess,json,os,shutil
w=Path(__file__).resolve().parent
out=w/'replay-output';out.mkdir(exist_ok=True)
cli=os.environ.get('FLOWDUET_PLAYWRIGHT_CLI',str(Path.home()/'.codex/skills/playwright/scripts/playwright_cli.sh'))
summary=[]
def run(name,script):
 log=out/(name+'.log')
 with log.open('w') as f:p=subprocess.run([cli,'-s=flowduet-c','run-code',script],stdout=f,stderr=subprocess.STDOUT)
 text=log.read_text(); record={'name':name,'exit':p.returncode}
 if '### Result' in text:
  data=json.JSONDecoder().raw_decode(text.split('### Result',1)[1].strip())[0];(out/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');record['result']=name+'.json'
 else:record['tool_failure']=text[-500:]
 summary.append(record);(out/'replay-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(record,flush=True)
run('entry',"async(page)=>{await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:5173/probes/stage-zero/index.html');await page.getByRole('button',{name:'表单状态 C',exact:true}).click();return {url:page.url(),userAgent:await page.evaluate(()=>navigator.userAgent),viewport:page.viewportSize(),dpr:await page.evaluate(()=>devicePixelRatio)}}")
cases=json.loads((w/'C1-cases.json').read_text())
for i in range(0,len(cases),6):run('C1-load-'+str(i//6),(w/'C1-load.browser.js.txt').read_text().replace('CASES_PLACEHOLDER',json.dumps(cases[i:i+6],ensure_ascii=False)))
for i in range(1,9):
 cases=[dict(field='F0'+str(i),layout=layout) for layout in ['top','grid']]
 run('C1-edit-F0'+str(i),(w/'C1-edit.browser.js.txt').read_text().replace('CASES_PLACEHOLDER',json.dumps(cases)))
for field in ['F04','F05','F06']:
 run('C1-options-'+field,(w/'C1-options.browser.js.txt').read_text().replace('CASES_PLACEHOLDER',json.dumps([dict(field=field,layout=l) for l in ['top','grid']])))
for name,source in [('C2-navigation','C2-navigation'),('C2-focus','C2-focus-diagnostic'),('C2-pending','C2-pending'),('C3-drag','C3-drag'),('C3-layout','C3-layout'),('C4-real','C4-real'),('C4-loaded','C4-loaded')]:run(name,(w/(source+'.browser.js.txt')).read_text())

cases=json.loads((w/'C1-cases.json').read_text())
for i in range(0,len(cases),4):run('C1-R-load-'+str(i//4),(w/'C1-R-load.browser.js.txt').read_text().replace('CASES_PLACEHOLDER',json.dumps(cases[i:i+4],ensure_ascii=False)))
