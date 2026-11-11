<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { ElDialog } from "element-plus";
import { ProbeSelect, ProbeOption } from "../contracts/ep-select-binding";

const props = defineProps<{ label: string }>();
const emit = defineEmits<{ observe: [event: string, detail: Record<string, unknown>] }>();
// 归属跟随挂载生命期；相同label及不同Vue应用也不能共享关闭标记。
const ownerKey = crypto.randomUUID();
const ownerModalClass = `b03-modal-${ownerKey}`;
const ownerContentClass = `b03-content-${ownerKey}`;
const ownerPopupClass = `b03-popup-${ownerKey}`;
let disposed = false;
function record(event: string, detail: Record<string, unknown> = {}) {
  emit("observe", event, { ...detail, ownerKey, label: props.label });
}
const dialogVisible = ref(false),
  dialogMounted = ref(true),
  guarded = ref(true),
  busy = ref(false);
const popup = ref(""),
  dialogSerial = ref(0);
let refusedGesture = false;
function closeRequest(done?: () => void) {
  record("dialog-before-close", { busy: busy.value, refusedGesture });
  if (guarded.value && (busy.value || refusedGesture)) {
    refusedGesture = false;
    return;
  }
  if (done) done();
  else dialogVisible.value = false;
}
function preflight(event: Event) {
  if (disposed || !dialogMounted.value || !dialogVisible.value) return;
  const path = event.composedPath();
  const own = path.some(
    (el) =>
      el instanceof HTMLElement &&
      (el.classList.contains(ownerModalClass) || el.dataset.seamCloseOwner === ownerKey),
  );
  const content = path.some(
    (el) => el instanceof HTMLElement && el.classList.contains(ownerContentClass),
  );
  const closeControl = path.some(
    (el) => el instanceof HTMLElement && el.dataset.seamCloseOwner === ownerKey,
  );
  const keyboard = event instanceof KeyboardEvent;
  if (!own || (!closeControl && content) || (keyboard && !["Enter", " "].includes(event.key)))
    return;
  record("dialog-preflight", {
    type: event.type,
    key: keyboard ? event.key : null,
    busy: busy.value,
    active: (document.activeElement as HTMLElement | null)?.getAttribute("data-test"),
  });
  if (guarded.value && busy.value) {
    event.preventDefault();
    event.stopPropagation();
    refusedGesture = true;
  } else refusedGesture = false;
}
function composition(value: boolean) {
  busy.value = value;
  record(value ? "dialog-compositionstart" : "dialog-compositionend-sync");
}
function openDialog() {
  refusedGesture = false;
  dialogMounted.value = true;
  dialogSerial.value++;
  dialogVisible.value = true;
}
onMounted(() => {
  document.addEventListener("pointerdown", preflight, true);
  document.addEventListener("keydown", preflight, true);
});
onBeforeUnmount(() => {
  disposed = true;
  document.removeEventListener("pointerdown", preflight, true);
  document.removeEventListener("keydown", preflight, true);
  record("dialog-probe-unmount");
});
</script>
<template>
  <section
    :data-dialog-probe="label"
    :data-owner-key="ownerKey"
    :data-content-class="ownerContentClass"
    :data-modal-class="ownerModalClass"
    :data-popup-class="ownerPopupClass"
    :data-dialog-open="dialogVisible"
  >
    <h3>Dialog公开接线（独立样稿，不是FormManager实现）</h3>
    <label><input v-model="guarded" type="checkbox" data-test="dialog-guarded" />显式保护</label>
    <label><input v-model="busy" type="checkbox" data-test="dialog-busy" />busy协议开关</label>
    <button data-test="dialog-open" @click="openDialog">打开Dialog</button>
    <button data-test="dialog-program-close" @click="dialogVisible = false">
      程序化关闭（对照）
    </button>
    <button data-test="dialog-destroy" @click="dialogMounted = false">父级强制销毁（对照）</button>
    <ElDialog
      v-if="dialogMounted"
      v-model="dialogVisible"
      :class="`b03-seam-dialog ${ownerContentClass}`"
      :modal-class="`b03-seam-modal ${ownerModalClass}`"
      title="P0关闭接缝"
      :show-close="false"
      :close-on-press-escape="!guarded"
      destroy-on-close
      :before-close="closeRequest"
      @closed="record('dialog-closed', { dialogSerial })"
      @open="record('dialog-open', { dialogSerial })"
    >
      <template #header
        ><button
          data-seam-close
          :data-seam-close-owner="ownerKey"
          data-test="dialog-x"
          @click="closeRequest()"
        >
          X
        </button></template
      >
      <input
        data-test="dialog-raw"
        aria-label="Dialog原文"
        @blur="record('dialog-blur')"
        @compositionstart="composition(true)"
        @compositionend="composition(false)"
      />
      <ProbeSelect
        v-model="popup"
        placeholder="内部弹层"
        :popper-class="`b03-dialog-popup ${ownerPopupClass}`"
        ><ProbeOption label="一" value="1" /><ProbeOption label="二" value="2"
      /></ProbeSelect>
      <button data-test="dialog-normal" @click="record('dialog-normal')">正常按钮</button>
      <button
        data-seam-close
        :data-seam-close-owner="ownerKey"
        data-test="dialog-cancel"
        @click="closeRequest()"
      >
        取消（样稿不实现放弃确认）
      </button>
    </ElDialog>
  </section>
</template>
