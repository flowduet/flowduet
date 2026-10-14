<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { ElSelect, ElOption, ElPopover, ElButton } from "element-plus";
import { ProbeHostController } from "./host-protocol";
import { ValidationTracker } from "./identity-policy";
import { record } from "./probe-log";
import LocationProbe from "./LocationProbe.vue";
const controllers = [new ProbeHostController(), new ProbeHostController()];
const trackers = [new ValidationTracker(), new ValidationTracker()];
const names = ref(controllers.map((c) => String(c.session.current!.model.process.get("name")))),
  values = ref(["", ""]),
  roots: HTMLElement[] = [];
const pending = new Map<number, { resolve: () => void; reject: () => void }>(),
  result = ref(""),
  sequence = ref(0),
  requests = ref(0),
  hostShortcuts = ref(0),
  adapter = ref(true);
function view() {
  sequence.value++;
  result.value = JSON.stringify(
    controllers.map((c, i) => ({
      instance: i,
      epoch: c.epoch,
      dirty: c.dirty,
      generation: c.generation,
      saved: c.savedGeneration,
      validation: trackers[i]!.current(),
      pending: pending.has(i),
    })),
    null,
    2,
  );
}
function edit(i: number) {
  controllers[i]!.edit();
  trackers[i]!.update(names.value[i]!, `doc:${controllers[i]!.epoch}`);
  view();
}
function apply(i: number) {
  controllers[i]!.session.current!.model.process.set("name", names.value[i]);
  trackers[i]!.update(names.value[i]!, `doc:${controllers[i]!.epoch}`);
  view();
}
function validate(i: number) {
  trackers[i]!.update(names.value[i]!, `doc:${controllers[i]!.epoch}`);
  trackers[i]!.validate();
  view();
}
function log(i: number, action: string, observed: unknown) {
  record("host", action, observed, undefined, controllers[i]!.epoch);
}
async function save(i: number) {
  if (!adapter.value || pending.has(i)) return;
  apply(i);
  requests.value++;
  const requestEpoch = controllers[i]!.epoch;
  const status = await controllers[i]!.save(
    () =>
      new Promise<void>((resolve, reject) => {
        pending.set(i, { resolve, reject: () => reject(new Error("宿主拒绝")) });
        view();
      }),
  );
  pending.delete(i);
  log(i, "save-result", { i, status, requestEpoch, dirty: controllers[i]!.dirty });
  view();
}
function shortcut(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
  const target = event.target as HTMLElement;
  const i = roots.findIndex(
    (root, index) => root?.contains(target) || target.closest(`.owned-${index}`),
  );
  if (i < 0 || !adapter.value) return;
  event.preventDefault();
  log(i, "shortcut", { i });
  void save(i);
}
onMounted(() => {
  document.addEventListener("keydown", shortcut);
  view();
});
onUnmounted(() => document.removeEventListener("keydown", shortcut));
</script>
<template>
  <section>
    <label><input type="checkbox" v-model="adapter" />提供实验保存适配器</label>
    <p>人工控制异步返回；不连接外部存储。保存请求数：{{ requests }}</p>
    <label
      >宿主输入<input
        placeholder="宿主自己的输入"
        @keydown.meta.s.prevent="hostShortcuts++"
        @keydown.ctrl.s.prevent="hostShortcuts++"
    /></label>
    <p data-test="host-shortcuts">宿主快捷键次数：{{ hostShortcuts }}</p>
    <div class="host-cards">
      <article
        v-for="(c, i) in controllers"
        :key="i"
        :ref="
          (el) => {
            if (el) roots[i] = el as HTMLElement;
          }
        "
        :data-host-instance="i"
      >
        <h3>实例 {{ i === 0 ? "甲" : "乙" }}</h3>
        <label
          >候选名称<input
            v-model="names[i]"
            :aria-label="'实例' + i + '候选名称'"
            @input="edit(i)" /></label
        ><ElSelect
          v-model="values[i]"
          :popper-class="'owned-' + i"
          filterable
          placeholder="打开所属弹层"
          ><ElOption label="候选一" value="one" /><ElOption label="候选二" value="two" /></ElSelect
        ><ElPopover trigger="click" :popper-class="'owned-' + i"
          ><template #reference><ElButton>打开所属测试弹层</ElButton></template
          ><input
            :aria-label="'实例' + i + '弹层输入'"
            placeholder="弹层内按保存快捷键" /></ElPopover
        ><button @click="validate(i)">标记候选已校验（模拟）</button
        ><button @click="apply(i)">原样应用</button
        ><button v-if="adapter" @click="save(i)">开始保存</button
        ><button @click="pending.get(i)?.resolve()">宿主确认成功</button
        ><button @click="pending.get(i)?.reject()">宿主确认失败</button
        ><button
          @click="
            c.newDesign('new_' + i + '_' + sequence);
            names[i] = String(c.session.current!.model.process.get('name'));
            values[i] = '';
            trackers[i]!.replaceDocument();
            view();
          "
        >
          模拟新建替换</button
        ><button
          @click="
            log(i, 'leave-cancel', { i, dirty: c.dirty });
            view();
          "
        >
          取消离开
        </button>
      </article>
    </div>
    <pre data-test="host-result">{{ result }}</pre>
    <LocationProbe />
    <h3>补充样例：外层支路开头的嵌套块</h3>
    <LocationProbe nested />
  </section>
</template>
<style scoped>
.host-cards {
  display: flex;
  gap: 20px;
}
.host-cards article {
  padding: 15px;
  border: 1px solid #bbc4d9;
  background: white;
  width: 45%;
}
.host-cards label {
  display: block;
}
.host-cards :deep(.el-select) {
  margin: 12px 0;
  width: 100%;
}
</style>
