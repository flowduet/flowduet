#!/usr/bin/env python3
"""在新输出目录重放本轮UI批次，不覆盖历史证据；须先启动专用Vite入口。"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--cli', type=Path, default=Path.home()/'.codex/skills/playwright/scripts/playwright_cli.sh')
parser.add_argument('--session', default='b03-p1-replay')
args = parser.parse_args()
root = Path.cwd()
out = args.output.resolve()
if out.exists():
    raise SystemExit('输出目录已存在，拒绝覆盖，请选择新目录')
out.mkdir(parents=True)
scripts = Path(__file__).resolve().parent
source_paths = json.loads((scripts.parent/'runtime-sources.json').read_text())['sources']
def snapshot():
    return [{'path': row['path'], 'sha256': hashlib.sha256((root/row['path']).read_bytes()).hexdigest(), 'bytes': (root/row['path']).stat().st_size} for row in source_paths]
before = snapshot()
(out/'runtime-sources.json').write_text(json.dumps({'sources': before}, ensure_ascii=False, indent=2)+'\n')
def run(name, *parts):
    result = subprocess.run([str(args.cli), f'-s={args.session}', *parts], capture_output=True, text=True)
    (out/f'{name}.log').write_text(result.stdout+result.stderr)
    if result.returncode:
        raise RuntimeError(f'{name}退出{result.returncode}，见原始日志')
    return result.stdout
try:
    for batch in ['numbers-dates', 'candidates', 'dialogs', 'calendar-shortcuts', 'dialog-boundaries']:
        run(f'{batch}-close', 'close')
        run(f'{batch}-open', 'open', 'http://127.0.0.1:5178/probes/stage-zero/index.html', '--headed')
        run(f'{batch}-viewport', 'resize', '1440', '1000')
        raw = run(batch, 'run-code', '--filename', str(scripts/f'{batch}.js.txt'))
        if '### Result\n' not in raw:
            raise RuntimeError(f'{batch}无完整结果，不能计通过')
        payload = json.loads(raw.split('### Result\n', 1)[1].split('\n### Ran Playwright code', 1)[0])
        if not payload['rows'] or not all(row.get('pass') is True for row in payload['rows']):
            raise RuntimeError(f'{batch}含失败或空目录')
        (out/f'{batch}.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n')
        print(batch, len(payload['rows']), 'PASS', flush=True)
    if snapshot() != before:
        raise RuntimeError('重放期间源码已变化，结果需作废重验')
finally:
    run('cleanup', 'close')
