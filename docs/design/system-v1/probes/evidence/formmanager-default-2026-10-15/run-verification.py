from pathlib import Path
import subprocess,time,json
repo=Path('/Users/l/.codex/worktrees/design-system-stage-zero/flowduet');out=Path('/tmp/flowduet-formmanager-fix');rows=[]
commands=[('build',['pnpm','build']),('strict-probe',['pnpm','--filter','@flowduet/form-create','exec','vue-tsc','--noEmit','-p','../../apps/playground/probes/stage-zero/tsconfig.json']),('lint',['pnpm','lint'])]
for name,args in commands:
 start=time.monotonic()
 with (out/(name+'.log')).open('w') as f:p=subprocess.run(args,cwd=repo,stdout=f,stderr=subprocess.STDOUT)
 row=dict(name=name,command=args,exitCode=p.returncode,wallSeconds=round(time.monotonic()-start,3));rows.append(row);(out/'verification-runs.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');print(json.dumps(row),flush=True)
 if p.returncode:raise SystemExit(p.returncode)
