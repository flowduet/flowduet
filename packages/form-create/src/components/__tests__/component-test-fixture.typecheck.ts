import type { DOMWrapper } from "@vue/test-utils";
import type { FormDesignerCaptureResult } from "../../editor-state.js";
import type {
  ComponentTestFixture,
  FixtureBindings,
  FixtureCaseKey,
  ManagerVm,
  RetainedVm,
} from "./component-test-fixture.js";

type InputHandle = Omit<DOMWrapper<HTMLInputElement>, "exists">;
type IsAny<T> = 0 extends 1 & T ? true : false;
type Owner = ReturnType<ComponentTestFixture["beginManagerOwner"]>;
type Editor = Awaited<ReturnType<ComponentTestFixture["retainedEditor"]>>;
type RetainedMode = ReturnType<RetainedVm["readEditingState"]>["mode"];

/** 仅由窄vue-tsc入口检查；不由Vitest导入，也不进入公共声明。 */
export function checkFixtureTypes(
  fixture: ComponentTestFixture,
  key: FixtureCaseKey,
  bindings: FixtureBindings,
  retained: RetainedVm,
  manager: ManagerVm,
  exactTarget: Editor["target"],
) {
  fixture.afterEachCase(key);
  fixture.afterEachCase(key, { error: undefined });
  // @ts-expect-error 结束必须携带本次签发的key。
  fixture.afterEachCase();
  // @ts-expect-error 空对象没有私有身份标记。
  fixture.afterEachCase({});
  function checkReadonly(field: keyof FixtureCaseKey) {
    // @ts-expect-error 私有symbol键是只读属性，不能重新写入同值。
    key[field] = true;
  }
  void checkReadonly;
  // @ts-expect-error binding只接受undefined或wrapper，不能混入null。
  bindings.setWrapper(null);
  // @ts-expect-error 原描述符只接受完整PropertyDescriptor或undefined。
  bindings.setOriginalElementString(null);
  const descriptor: PropertyDescriptor | undefined = bindings.getOriginalElementString();
  bindings.setOriginalElementString(descriptor);
  // @ts-expect-error 原模式只有retained和legacy。
  fixture.mountText([], "rebuild");

  // 在上下文标注前检查真实函数的解包返回，Promise<any>不能混入正例。
  const ownerIsAny: IsAny<Owner> = false;
  const editorIsAny: IsAny<Editor["target"]> = false;
  const selectedIsAny: IsAny<Awaited<ReturnType<ComponentTestFixture["selectRetained"]>>> = false;
  const titleIsAny: IsAny<Awaited<ReturnType<ComponentTestFixture["retainedTitle"]>>> = false;
  const rawIsAny: IsAny<Awaited<ReturnType<ComponentTestFixture["managerRaw"]>>> = false;
  const selected: Promise<InputHandle> = fixture
    .retainedEditor()
    .then((editor) => fixture.selectRetained(editor, "amount"));
  const title: Promise<InputHandle> = fixture
    .retainedEditor()
    .then((editor) => fixture.retainedTitle(editor));
  const raw: Promise<InputHandle> = fixture
    .retainedManager()
    .then((editor) => fixture.managerRaw(editor));
  async function checkInput(pending: Promise<InputHandle>) {
    const input = await pending;
    const element: HTMLInputElement = input.element;
    await input.setValue("23");
    await input.trigger("blur");
    // @ts-expect-error get句柄已保证存在，不公开exists。
    input.exists();
    return element;
  }
  void checkInput;

  const owner = fixture.beginManagerOwner();
  const targetWithMarker = Object.assign(exactTarget, { fixtureMarker: "retained" as const });
  const mounted = owner.mount(() => targetWithMarker);
  const marker: "retained" = mounted.fixtureMarker;
  const watched = owner.spy(() => ({ mockRestore: () => undefined, marker: "spy" as const }));
  const spyMarker: "spy" = watched.value.marker;
  const stepped: Promise<"step"> = owner.step(() => "step" as const);
  const captured: FormDesignerCaptureResult = retained.captureContent();
  if (captured.status === "captured") {
    const rules: string = captured.content.rules;
    void rules;
  }
  const managerState = manager.readEditingState();
  if (managerState !== null) {
    const mode: RetainedMode = managerState.mode;
    void mode;
  }
  return {
    selected,
    title,
    raw,
    ownerIsAny,
    editorIsAny,
    selectedIsAny,
    titleIsAny,
    rawIsAny,
    marker,
    spyMarker,
    stepped,
  };
}
