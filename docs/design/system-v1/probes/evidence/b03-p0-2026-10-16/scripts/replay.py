#!/usr/bin/env python3
"""新执行写入独立输出，保留归档原字节。使用已启动的本地探针与专用CLI会话。"""
import argparse
import json
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--output", required=True, type=Path)
parser.add_argument("--session", default="flowduet-p0")
parser.add_argument("--url", default="http://127.0.0.1:5180/probes/stage-zero/index.html")
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=False)
cli = os.environ["FLOWDUET_PLAYWRIGHT_CLI"]
scripts = Path(__file__).resolve().parent

def execute(name, code):
    result = subprocess.run([cli, "-s=" + args.session, "run-code", code], text=True, capture_output=True)
    (args.output / (name + ".log")).write_text(result.stdout + result.stderr)
    if result.returncode != 0 or "### Result\n" not in result.stdout:
        raise RuntimeError(name + ": CLI error; see raw log")
    data = json.loads(result.stdout.split("### Result\n", 1)[1].split("\n###", 1)[0])
    (args.output / (name + ".json")).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    return data

execute("environment", "async page => { await page.goto(" + json.dumps(args.url) + "); await page.setViewportSize({width:1440,height:1000}); return await page.evaluate(()=>({userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}})); }")
for name in ["production-red", "production-capture", "default-seam", "lifetime", "calendar", "dialog", "dialog-additional", "subtree-and-move", "drag-owner", "ownership-and-composition", "unowned-controls"]:
    rows = execute(name, (scripts / (name + ".browser.js.txt")).read_text())
    print(json.dumps({"batch": name, "rows": len(rows), "passed": sum(row.get("pass") is True for row in rows), "failed": sum(row.get("pass") is False for row in rows), "unknown": sum(row.get("pass") is None for row in rows)}, ensure_ascii=False), flush=True)
