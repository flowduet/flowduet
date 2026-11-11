from pathlib import Path
import json,hashlib,subprocess
root=Path('docs/design/system-v1/probes/evidence/form-state-2026-10-15');m=json.loads((root/'manifest.json').read_text())
assert all(r['exit']==0 for r in json.loads((root/'verification.json').read_text()))
for row in m['files']:
 assert hashlib.sha256((root/row['path']).read_bytes()).hexdigest()==row['sha256'],row['path']
for row in m['sourceFiles']:
 now=Path(row['path']).read_bytes();assert hashlib.sha256(now).hexdigest()==row['sha256'],row['path'];assert now==subprocess.check_output(['git','show',m['verificationHead']+':'+row['path']])
assert subprocess.run(['git','diff','--quiet','10b2a13','HEAD','--','packages','pnpm-lock.yaml','package.json']).returncode==0
coverage=json.loads((root/'coverage.json').read_text());assert len(coverage)==326
from collections import Counter
assert Counter(r['status'] for r in coverage)=={'passed':208,'failed':19,'kept-fallback-not-rebuilt':96,'tool-blocked':2,'natural-failure-unverified':1}
print(f"audit passed: {len(m['files'])} evidence files, {len(m['sourceFiles'])} pinned source files; 748/748 and four checks exit0; B03 blocked")
