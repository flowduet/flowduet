<script setup lang="ts">
import {
  defineComponent,
  h,
  resolveComponent,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";
import type { PropType } from "vue";
import FcDesigner from "../../../../../packages/form-create/node_modules/@form-create/designer";
import type { Config } from "../../../../../packages/form-create/node_modules/@form-create/designer/types/index.d";
import DialogCloseSeamProbe from "./DialogCloseSeamProbe.vue";
import { ensureFormCreateInstalled } from "../../../../../packages/form-create/src/form-create-setup";
import {
  DESIGNER_CONFIG,
  FIELD_MENU,
} from "../../../../../packages/form-create/src/components/designer-config";
import { formRules } from "../form-state/fixtures";
import { createSeamRecorder } from "./seam-proof";

type Rule = {
  type?: string;
  field?: string;
  value?: unknown;
  props?: Record<string, unknown>;
  children?: Rule[];
};
type Designer = InstanceType<typeof FcDesigner>;
type Owner = "A" | "B";
const revision = ref(0),
  layout = ref<"top" | "grid">("top"),
  mounted = ref(true);
const dateType = ref("date"),
  valueFormat = ref("YYYY-MM-DD");
const recorder = createSeamRecorder("P0");
function log(event: string, detail: unknown) {
  recorder.record(event, detail);
  revision.value++;
}
const refs: Partial<Record<Owner, Designer>> = {};
const sourceByOwner: Record<Owner, Set<Rule>> = { A: new Set(), B: new Set() };
function publicRules(owner: Owner) {
  return refs[owner]?.getRule() ?? [];
}
function select(owner: Owner, field: string) {
  try {
    refs[owner]?.triggerActive(field);
  } catch (error) {
    log("public-select-failed", { owner, field, error: String(error) });
  }
}

// 样稿组件无跨挂载状态，不实现retained缓存。原文观察和样本提交分别记录。
const SampleInput = defineComponent({
  props: {
    modelValue: { type: [String, Number] as PropType<string | number>, default: "" },
    owner: { type: String, required: true },
    field: { type: String, required: true },
    sourceToken: { type: String, required: true },
    kind: String,
    dateKind: String,
    format: String,
    observe: {
      type: Function as PropType<(event: string, value: unknown) => void>,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    onMounted(() => props.observe("sample-mounted", props.sourceToken));
    onBeforeUnmount(() => props.observe("sample-unmounted", props.sourceToken));
    function publish(value: unknown) {
      props.observe("before-emit", { value, prop: props.modelValue });
      emit("update:modelValue", value);
      props.observe("after-emit-sync", { value, prop: props.modelValue });
      void nextTick(() => props.observe("after-emit-nextTick", { value, prop: props.modelValue }));
    }
    return () =>
      h("div", { "data-seam-input": props.owner, "data-field": props.field }, [
        h("input", {
          "aria-label": `${props.owner}:${props.field}:raw`,
          "data-test": "seam-raw",
          type: "text",
          value: props.modelValue,
          onInput: (e: Event) => props.observe("raw-input", (e.target as HTMLInputElement).value),
          onBlur: (e: FocusEvent) =>
            props.observe("raw-blur", (e.target as HTMLInputElement).value),
          onCompositionstart: () => props.observe("compositionstart", null),
          onCompositionend: () => {
            props.observe("compositionend-sync", null);
            void nextTick(() => props.observe("compositionend-nextTick", null));
          },
        }),
        props.kind === "datePicker"
          ? h(resolveComponent("ElDatePicker"), {
              modelValue: typeof props.modelValue === "string" ? props.modelValue : undefined,
              type: (props.dateKind || "date") as "date",
              valueFormat: props.format || "YYYY-MM-DD",
              popperClass: `b03-calendar-${props.owner}`,
              "onUpdate:modelValue": publish,
            })
          : h("button", { "data-test": "seam-publish", onClick: () => publish(37) }, "发射样本37"),
      ]);
  },
});
onBeforeMount(() => {
  ensureFormCreateInstalled();
  FcDesigner.component("b03SeamInput", SampleInput);
});
function config(owner: Owner): Config {
  return {
    ...DESIGNER_CONFIG,
    fieldReadonly: false,
    componentRule: {
      default: (source) => {
        const rule = source as Rule;
        const token = recorder.token(source);
        if (rule.field) sourceByOwner[owner].add(rule);
        log("componentRule", { owner, field: rule.field, token, type: rule.type });
        if (!["inputNumber", "datePicker"].includes(String(rule.type))) return [];
        return [
          {
            type: "b03SeamInput",
            field: "formCreateValue",
            title: "P0样稿默认值",
            props: {
              owner,
              field: rule.field,
              sourceToken: token,
              kind: rule.type,
              dateKind: rule.props?.type,
              format: rule.props?.valueFormat,
              observe: (event: string, value: unknown) =>
                log(event, {
                  owner,
                  field: rule.field,
                  token,
                  value,
                  publicValue: find(publicRules(owner) as Rule[], String(rule.field))?.value,
                }),
            },
          },
        ];
      },
    },
  };
}
const configA = config("A"),
  configB = config("B");
function find(rules: Rule[], field: string): Rule | undefined {
  for (const rule of rules) {
    if (rule.field === field) return rule;
    const child = find(rule.children ?? [], field);
    if (child) return child;
  }
}
function bind(owner: Owner, vm: unknown) {
  if (!vm || refs[owner] === vm) return;
  refs[owner] = vm as Designer;
  load(owner);
}
function load(owner: Owner) {
  // setRule只用于明确的夹具装载；不用于取消或保真恢复。
  const rules = JSON.parse(
    formRules("a", { field: "all", layout: layout.value, dateType: dateType.value }),
  ) as Rule[];
  const date = find(rules, "a_date");
  if (date) date.props = { ...date.props, valueFormat: valueFormat.value };
  sourceByOwner[owner].clear();
  refs[owner]?.setRule(rules as never);
  refs[owner]?.setOption({});
  log("fixture-load", {
    owner,
    layout: layout.value,
    dateType: dateType.value,
    valueFormat: valueFormat.value,
  });
}
function publicEvent(owner: Owner, event: string, value: unknown) {
  const rule = value && typeof value === "object" ? (value as Rule) : null;
  log(`public-${event}`, {
    owner,
    field: rule?.field,
    token: rule ? recorder.token(rule) : null,
    sourceToken: rule && sourceByOwner[owner].has(rule) ? recorder.token(rule) : null,
    knownSubtree: rule ? knownSubtree(owner, rule) : [],
    children: rule?.children?.map((child) => ({
      field: child.field,
      token: recorder.token(child),
    })),
    publicFieldsAtEvent: allFields(publicRules(owner) as Rule[]),
  });
  if (event === "delete" && rule) {
    const release = (node: Rule) => {
      sourceByOwner[owner].delete(node);
      node.children?.forEach(release);
    };
    release(rule);
  }
}
function knownSubtree(owner: Owner, rule: Rule): { field?: string; token: string }[] {
  return [
    ...(sourceByOwner[owner].has(rule)
      ? [{ ...(rule.field ? { field: rule.field } : {}), token: recorder.token(rule) }]
      : []),
    ...(rule.children ?? []).flatMap((child) => knownSubtree(owner, child)),
  ];
}
function allFields(rules: Rule[]): string[] {
  return rules.flatMap((rule) => [
    ...(rule.field ? [rule.field] : []),
    ...allFields(rule.children ?? []),
  ]);
}
async function toggleMounted() {
  mounted.value = !mounted.value;
  if (!mounted.value) {
    await nextTick();
    delete refs.A;
    delete refs.B;
    sourceByOwner.A.clear();
    sourceByOwner.B.clear();
    log("observer-references-released", null);
  }
}
function nativeEvent(owner: Owner, event: Event) {
  log(`native-${event.type}`, {
    owner,
    trusted: event.isTrusted,
    target: (event.target as HTMLElement | null)?.tagName,
    ...(event.target instanceof HTMLInputElement
      ? {
          inputType: event.target.type,
          raw: event.target.value,
          badInput: event.target.validity.badInput,
          nativeControlToken: recorder.token(event.target),
        }
      : {}),
  });
}
function observeClones(owner: Owner) {
  const rules = publicRules(owner) as Rule[];
  log("public-clone", {
    owner,
    fields: [...sourceByOwner[owner]].map((source) => {
      const field = String(source.field);
      const clone = find(rules, field);
      return {
        field,
        source: recorder.token(source),
        clone: clone ? recorder.token(clone) : null,
        sameReference: clone === source,
      };
    }),
    rules,
  });
}

const dialogPeerMounted = ref(false);
onBeforeUnmount(() => log("probe-unmount", { ownerTokensReleasedByGC: true }));
</script>

<template>
  <section data-test="seam-probe">
    <h2>B03 P0 · 公开接缝样稿（不是retained实现）</h2>
    <p>
      actualMode=public-seam-sample；生产FormDesigner仍为legacy。样稿不保留跨字段raw、不改session、不实现captureContent。
    </p>
    <select v-model="layout" data-test="seam-layout">
      <option>top</option>
      <option>grid</option>
    </select>
    <select v-model="dateType" data-test="seam-date-type">
      <option v-for="v in ['', 'date', 'datetime', 'week', 'month', 'year']" :key="v">
        {{ v }}
      </option>
    </select>
    <input v-model="valueFormat" data-test="seam-format" aria-label="样稿日期格式" />
    <button
      data-test="seam-load"
      @click="
        load('A');
        load('B');
      "
    >
      明确重装夹具
    </button>
    <button data-test="seam-mount" @click="toggleMounted">挂载/销毁样稿</button>
    <button
      data-test="seam-clear"
      @click="
        recorder.events.length = 0;
        revision++;
      "
    >
      清观察日志
    </button>
    <div
      v-for="owner in ['A', 'B'] as const"
      :key="owner"
      :data-seam-owner="owner"
      @pointerdown.capture="nativeEvent(owner, $event)"
      @pointerup.capture="nativeEvent(owner, $event)"
      @dragstart.capture="nativeEvent(owner, $event)"
      @dragend.capture="nativeEvent(owner, $event)"
      @input.capture="nativeEvent(owner, $event)"
      @change.capture="nativeEvent(owner, $event)"
      @focusout.capture="nativeEvent(owner, $event)"
    >
      <h3>同ID实例 {{ owner }}</h3>
      <button :data-test="`seam-number-${owner}`" @click="select(owner, 'a_amount')">选数字</button>
      <button :data-test="`seam-date-${owner}`" @click="select(owner, 'a_date')">选日期</button>
      <button :data-test="`seam-text-${owner}`" @click="select(owner, 'a_subject')">选文字</button>
      <button :data-test="`seam-clone-${owner}`" @click="observeClones(owner)">观察公开副本</button>
      <FcDesigner
        v-if="mounted"
        :ref="(vm) => bind(owner, vm)"
        :config="owner === 'A' ? configA : configB"
        :menu="FIELD_MENU"
        height="540px"
        @active="publicEvent(owner, 'active', $event)"
        @delete="publicEvent(owner, 'delete', $event)"
        @drag="publicEvent(owner, 'drag', $event)"
        @create="publicEvent(owner, 'create', $event)"
        @change-field="publicEvent(owner, 'change-field', $event)"
      />
    </div>
    <DialogCloseSeamProbe label="A" @observe="log" />
    <button data-test="dialog-peer-toggle" @click="dialogPeerMounted = !dialogPeerMounted">
      挂载/销毁第二Dialog样稿
    </button>
    <DialogCloseSeamProbe v-if="dialogPeerMounted" label="B" @observe="log" />

    <pre data-test="seam-events" :data-revision="revision">{{
      JSON.stringify(recorder.events)
    }}</pre>
  </section>
</template>
