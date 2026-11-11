# SDD ledger — plan: docs/design/2026-10-25-stage-zero-closeout-inventory.md

M1: 19 engineering files imported byte-for-byte from fcd715408579979240b8543cfbcab844c451436d onto develop 9a0d6bd.
Pre-flight: M2 and M3 consume the exact M1 candidate; docs must not imply legacy gained retained behavior.
Ruling: This is integration of previously tested code, not new implementation; preserve existing RED evidence and run current GREEN checks rather than recreate historical experiments.
Ruling: Use only frozen-lock offline dependency install with ignore-scripts in isolated worktree; no dependency or lockfile changes. Install succeeded.
Ruling: Compact retirement notices plus compressed immutable source documents replace importing 771 historical docs. Original worktrees remain untouched.
M2: current default root test started; no retry or timeout overrides.

M1: complete — all 19 engineering files match fcd7154.
M2: complete — pnpm test 950/950; lint/build/fixture types/core ESM exit 0; no timeout or retry override. Build retains chunk-size warning.
Ruling: Packaged-consumer offline semver resolution selected unavailable newer transitive dependencies; pin the installed production combination and preserve failed installs. Correct npm alias names in consumer-only overrides; production dependencies untouched. Cost: only the pinned combination is verified.
Ruling: Default Playground is legacy; do not alter its wiring under integration scope. Validate retained explicitly in standalone consumer and state limitation.
M3: complete as validation, not all-pass — packed consumer Node/types/build and text/save/busy/legacy assertions passed; host handlers overwritten and not restored. No vendor repair.
Ruling: Host handler failure is a pre-existing delivery blocker for embedding, not a reason to import unvalidated vendor code; retain isolated demo possibility and explicitly withhold host approval.
Final review: independent read-only 9a0d6bd..bfd7c13, zero confirmed Standards/Spec findings. No code fix pass required.
Final: Ruling: Reviewer did not promote pre-existing host risk or untested OS/theme/remote scenarios into new P2 defects; keep them as documented delivery limits and remote merge prerequisites.
M4: complete — local PR draft ready, no remote PR. Browser and owned server closed. Keep branch/worktree per user no-push/no-publish instruction.
