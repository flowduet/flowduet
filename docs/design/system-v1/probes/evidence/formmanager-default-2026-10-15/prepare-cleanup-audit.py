from pathlib import Path
import re
repo=Path('/Users/l/.codex/worktrees/design-system-stage-zero/flowduet')
out=Path('/tmp/flowduet-formmanager-fix')
s=(repo/'packages/form-create/src/components.test.ts').read_text()
s=s.replace('afterEach, beforeEach,','afterAll, afterEach, beforeEach,')
s=s.replace('flushPromises, mount }','flushPromises, mount as rawMount }')
s=re.sub(r'from "\./([^\"]+)"',lambda m:'from "'+str(repo/'packages/form-create/src'/m.group(1))+'"',s)
audit='''
// 诊断副本专用：记录真实实例卸载和描述符恢复，不替换任何组件。
const auditMode = process.env.FM_AUDIT_MODE ?? "normal";
const suiteDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
if (auditMode === "absent") Reflect.deleteProperty(Element.prototype, "toString");
const expectedDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "toString");
const alive = new Set<ReturnType<typeof rawMount>>();
let currentCase = "";
let auditCount = 0;
const mount: typeof rawMount = ((...args: Parameters<typeof rawMount>) => {
  const mounted = rawMount(...args);
  alive.add(mounted);
  const unmount = mounted.unmount.bind(mounted);
  mounted.unmount = () => {
    try { unmount(); }
    finally {
      expect(mounted.vm.$.isUnmounted).toBe(true);
      alive.delete(mounted);
    }
    if (auditMode === "unmount-throws" && currentCase.startsWith("内容守卫前置")) {
      throw new Error("FM_AUDIT_INTENTIONAL_UNMOUNT_FAILURE");
    }
  };
  return mounted;
}) as typeof rawMount;
beforeEach((context) => {
  currentCase = context.task.name;
  expect(alive.size).toBe(0);
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(expectedDescriptor);
  console.log("FM_AUDIT_START", JSON.stringify({mode:auditMode, case:currentCase, alive:alive.size}));
});
afterAll(() => {
  expect(auditCount).toBe(2);
  expect(alive.size).toBe(0);
  expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(expectedDescriptor);
  if (suiteDescriptor) Object.defineProperty(Element.prototype, "toString", suiteDescriptor);
  else Reflect.deleteProperty(Element.prototype, "toString");
  console.log("FM_AUDIT_SUITE", JSON.stringify({mode:auditMode, cases:auditCount, alive:alive.size, suiteDescriptorRestored:true}));
});
'''
s=s.replace('let wrapper: ReturnType<typeof mount> | undefined;',audit+'\nlet wrapper: ReturnType<typeof mount> | undefined;')
s=s.replace('originalElementString = undefined;\n  }','''originalElementString = undefined;
    expect(alive.size).toBe(0);
    expect(wrapper).toBeUndefined();
    expect(document.body.childNodes.length).toBe(0);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, "toString")).toEqual(expectedDescriptor);
    auditCount++;
    console.log("FM_AUDIT_CLEAN", JSON.stringify({mode:auditMode, case:currentCase, alive:alive.size, wrapperCleared:true, bodyEmpty:true, descriptorRestored:true}));
  }''')
s=s.replace('expect(designer.find("._fc-l-item").exists()).toBe(true);','''expect(designer.find("._fc-l-item").exists()).toBe(true);
    if (auditMode === "assert-fails") expect("FM_AUDIT_INTENTIONAL_ASSERT_FAILURE").toBe("pass");
    if (auditMode === "timeout") await new Promise<void>(() => {});''',1)
(out/'cleanup-audit.test.ts').write_text(s)
(out/'node_modules').symlink_to(repo/'apps/playground/node_modules',target_is_directory=True) if not (out/'node_modules').exists() else None
(out/'cleanup.config.mts').write_text('''import {defineConfig} from 'vitest/config';
import vue from "'''+str(repo)+'''/apps/playground/node_modules/@vitejs/plugin-vue/dist/index.mjs";
const repo="'''+str(repo)+'''";
export default defineConfig({root:"/tmp/flowduet-formmanager-fix",cacheDir:"/tmp/flowduet-formmanager-fix/cache",plugins:[vue()],test:{environment:"happy-dom",include:["cleanup-audit.test.ts"],fileParallelism:false},resolve:{alias:{"@flowduet/core":repo+"/packages/core/src/index.ts","@flowduet/designer":repo+"/packages/designer/src/index.ts"}}});
''')
