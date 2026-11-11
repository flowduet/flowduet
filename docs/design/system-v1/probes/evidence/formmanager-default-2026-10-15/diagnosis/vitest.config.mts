import { defineConfig } from 'vitest/config';
import vue from '/Users/l/.codex/worktrees/design-system-stage-zero/flowduet/apps/playground/node_modules/@vitejs/plugin-vue/dist/index.mjs';
const repo='/Users/l/.codex/worktrees/design-system-stage-zero/flowduet';
export default defineConfig({root:'/tmp/flowduet-formmanager-diagnosis',cacheDir:'/tmp/flowduet-formmanager-diagnosis/cache',plugins:[{name:'fm-diagnostic-hooks',enforce:'pre',transform(code,id){
 if(!id.endsWith('/FormDesigner.vue')&&!id.endsWith('/FormManager.vue'))return;
 code=code.replace('<script setup lang="ts">','<script setup lang="ts">\nconst fmTrace=(stage:string)=>Reflect.get(globalThis,"__fmDiagMark")?.(stage);');
 if(id.endsWith('/FormDesigner.vue')) {
  code=code.replace('onBeforeMount(ensureFormCreateInstalled);','onBeforeMount(()=>{fmTrace("install.begin");ensureFormCreateInstalled();fmTrace("install.end");});');
  code=code.replace('onMounted(() => {','onMounted(() => {fmTrace("designer.mounted.begin");');
  code=code.replace('designer.setRule(prepareCheckboxDefaults(props.rules) as never);','fmTrace("setRule.begin");designer.setRule(prepareCheckboxDefaults(props.rules) as never);fmTrace("setRule.end");');
  code=code.replace('designer.setOption(parseFormOptions(props.options) as never);','fmTrace("setOption.begin");designer.setOption(parseFormOptions(props.options) as never);fmTrace("setOption.end");');
 } else {
  code=code.replace('assertFormDefinitionValid({ ...form, rules, options }, new Set());','fmTrace("guard.begin");assertFormDefinitionValid({ ...form, rules, options }, new Set());fmTrace("guard.end");');
  code=code.replace('} catch (e) {','} catch (e) {fmTrace("guard.reject");');
 }
 return {code,map:null};
}},vue()],test:{execArgv:process.env.FM_CPU?['--cpu-prof','--cpu-prof-dir=/tmp/flowduet-formmanager-diagnosis/profiles']:[],environment:'happy-dom',include:['instrumented.test.ts'],fileParallelism:false},resolve:{alias:{'@flowduet/core':repo+'/packages/core/src/index.ts','@flowduet/designer':repo+'/packages/designer/src/index.ts'}}});
