import {defineConfig} from 'vitest/config';
import vue from "/Users/l/.codex/worktrees/design-system-stage-zero/flowduet/apps/playground/node_modules/@vitejs/plugin-vue/dist/index.mjs";
const repo="/Users/l/.codex/worktrees/design-system-stage-zero/flowduet";
export default defineConfig({root:"/tmp/flowduet-formmanager-fix",cacheDir:"/tmp/flowduet-formmanager-fix/cache",plugins:[vue()],test:{environment:"happy-dom",include:["cleanup-audit.test.ts"],fileParallelism:false},resolve:{alias:{"@flowduet/core":repo+"/packages/core/src/index.ts","@flowduet/designer":repo+"/packages/designer/src/index.ts"}}});
