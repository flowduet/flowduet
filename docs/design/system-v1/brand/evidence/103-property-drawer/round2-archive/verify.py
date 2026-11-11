"""核对恢复的原始证据与固定提交；仅使用 Python 标准库和 Git。"""

from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
REPO = Path(subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "--show-toplevel"], text=True).strip())
HISTORICAL_ROOT = "/Users/l/Documents/projects/flowduet-103-property-appearance"


def git(*args, env=None):
    return subprocess.check_output(["git", *args], cwd=REPO, env=env)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tree(commit):
    result = {}
    for entry in git("ls-tree", "-rz", commit).split(b"\0"):
        if entry:
            metadata, path = entry.split(b"\t", 1)
            mode, kind, oid = metadata.decode().split()
            result[path.decode()] = (mode, kind, oid)
    return result


def new_file_patch(path, data, temporary):
    file = temporary / Path(path).name
    file.write_bytes(data)
    file.chmod(0o644)
    result = subprocess.run(
        ["git", "-c", "core.abbrev=7", "-c", "color.ui=false", "diff", "--no-index", "--no-ext-diff", "/dev/null", str(file)],
        cwd=REPO, capture_output=True,
    )
    assert result.returncode == 1, result.stderr.decode()
    historical = f"{HISTORICAL_ROOT}/{path}".lstrip("/").encode()
    # 原哈希包含绝对路径前缀；只还原 diff 头，不改动文件内容。
    lines = result.stdout.splitlines(keepends=True)
    lines[0] = b"diff --git a/" + historical + b" b/" + historical + b"\n"
    lines = [b"+++ b/" + historical + b"\n" if line.startswith(b"+++ b/") else line for line in lines]
    return b"".join(lines)


def main():
    sealed = ROOT / "SHA256SUMS"
    checked = 0
    assert sealed.is_file(), "缺少归档校验清单 SHA256SUMS"
    sealed_names = set()
    for line in sealed.read_text().splitlines():
        expected, name = line.split("  ", 1)
        file = (ROOT / name).resolve()
        assert ROOT in file.parents and file.is_file(), name
        assert name not in sealed_names, name
        assert sha(file.read_bytes()) == expected, f"归档文件哈希不一致：{name}"
        sealed_names.add(name)
        checked += 1
    actual_names = {str(path.relative_to(ROOT)) for path in ROOT.rglob("*") if path.is_file() and path != sealed}
    assert sealed_names == actual_names, "归档校验清单存在漏项或多余项"

    manifest = json.loads((ROOT / "snapshots/source-manifest.json").read_text())
    target = manifest["target_commit"]
    base = manifest["base_commit"]
    target_files = tree(target)
    assert len(target_files) == manifest["file_count"] == len(manifest["files"])
    assert set(target_files) == {item["path"] for item in manifest["files"]}
    process = subprocess.Popen(["git", "cat-file", "--batch"], cwd=REPO, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    for item in manifest["files"]:
        assert target_files[item["path"]] == (item["mode"], "blob", item["git_blob"])
        process.stdin.write(item["git_blob"].encode() + b"\n")
        process.stdin.flush()
        header = process.stdout.readline().decode().split()
        data = process.stdout.read(int(header[2]))
        assert process.stdout.read(1) == b"\n"
        assert len(data) == item["bytes"] and sha(data) == item["sha256"], item["path"]
    process.stdin.close()
    assert process.wait() == 0

    original = (ROOT / "snapshots/original-diff-from-cd39258.patch").read_bytes()
    exported = (ROOT / "source-records/step-283-output.txt").read_bytes()
    for name in ["original-diff-from-cd39258.patch", "original-diff-from-79bbea9.patch"]:
        assert sha((ROOT / "snapshots" / name).read_bytes()).encode() in exported
    pieces = re.split(rb"(?=^diff --git )", original, flags=re.M)
    payload = b"".join(piece for piece in pieces if re.match(rb"diff --git a/(packages|apps)/", piece))
    with tempfile.TemporaryDirectory(prefix="flowduet-103-verify-") as directory:
        temporary = Path(directory)
        for name in ["round2-fixes.json", "round2-fixes.mjs.txt"]:
            path = "docs/design/system-v1/brand/evidence/103-property-drawer/" + name
            payload += new_file_patch(path, git("show", f"{target}:{path}"), temporary)
        assert payload == (ROOT / "snapshots/reviewed-scope.patch").read_bytes()
        assert sha(payload) == manifest["historical_reviewed_scope_sha256"]
        assert sha(payload).encode() in (ROOT / "source-records/step-292-output.txt").read_bytes()

        final_parts = re.split(rb"(?=^diff --git )", payload, flags=re.M)
        readme = "packages/designer/README.md"
        readme_bytes = git("show", f"{target}:{readme}")
        for index, part in enumerate(final_parts):
            if part.startswith(b"diff --git a/packages/designer/README.md "):
                before = next(line for line in part.splitlines(keepends=True) if line.startswith("+宿主颜色支持".encode()))
                after = next(line for line in readme_bytes.splitlines(keepends=True) if line.startswith("宿主颜色支持".encode()))
                part = part.replace(before, b"+" + after, 1)
                oid = target_files[readme][2].encode()
                final_parts[index] = re.sub(rb"^(index [a-f0-9]+\.\.)[a-f0-9]+", lambda match: match[1] + oid[:7], part, flags=re.M)
        final_payload = b"".join(final_parts)
        assert final_payload == (ROOT / "snapshots/final-scope.patch").read_bytes()
        assert sha(final_payload) == manifest["historical_final_scope_sha256"]
        assert sha(final_payload).encode() in (ROOT / "logs/lint.log").read_bytes()

        # 临时索引不触及用户暂存区；先比对历史审查后的产品/测试，再验证完整二进制补丁。
        env = dict(os.environ, GIT_INDEX_FILE=str(temporary / "index"))
        git("read-tree", base, env=env)
        git("apply", "--cached", "--whitespace=nowarn", str(ROOT / "snapshots/original-diff-from-cd39258.patch"), env=env)
        reviewed_tree = tree(git("write-tree", env=env).decode().strip())
        reviewed_code = {path: entry for path, entry in reviewed_tree.items() if path.startswith(("packages/", "apps/")) and path != readme}
        final_code = {path: entry for path, entry in target_files.items() if path.startswith(("packages/", "apps/")) and path != readme}
        assert reviewed_code == final_code
        git("read-tree", base, env=env)
        full = ROOT / "snapshots/final-full.patch"
        assert sha(full.read_bytes()) == manifest["final_full_patch_sha256"]
        git("apply", "--cached", "--binary", "--whitespace=nowarn", str(full), env=env)
        assert git("write-tree", env=env).decode().strip() == manifest["target_tree"]

    provenance = json.loads((ROOT / "provenance.json").read_text())
    for command in provenance["commands"]:
        data = (ROOT / command["log"]).read_bytes()
        assert len(data) == command["source_log_bytes"] and sha(data) == command["source_log_sha256"]
        assert sha(command["tool_result_prefix"].encode() + data) == command["source_tool_result_sha256"]
        assert f"code {command['exit_code']}" in command["tool_result_prefix"]
    for report in provenance["reviews"]:
        message = ROOT / "source-records" / f"{report['axis']}-message.json.txt"
        raw = message.read_bytes()
        assert sha(raw) == report["source_message_sha256"]
        assert json.loads(raw)["content"].encode() == (ROOT / report["report"]).read_bytes()
        assert sha((ROOT / report["report"]).read_bytes()) == report["report_sha256"]
    test_log = (ROOT / "logs/test.log").read_bytes()
    assert set(re.findall(rb"Tests\s+(\d+) passed", test_log)) == {b"148", b"202", b"312", b"306"}
    assert b"Failed Tests" not in test_log
    result = {
        "result": "PASS", "target_commit": target,
        "sealed_artifacts_checked": checked, "source_files_checked": len(target_files),
        "product_and_test_files_unchanged_after_review": len(final_code),
        "historical_reviewed_sha256": sha(payload), "historical_final_sha256": sha(final_payload),
        "full_patch_reproduces_target_tree": True,
        "original_test_passed": [148, 202, 312, 306], "original_test_total": 968,
        "historical_tests_rerun_by_this_verifier": False,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
