import { BpmnModel, CORE_VERSION, flowableAdapter } from "@flowduet/core";
import {
  DingtalkDesigner,
  resolveComponentAppearance,
  createAppearanceVariables,
  readHostAppearance,
} from "@flowduet/designer";
import {
  FormDesigner,
  FormManager,
  FormPreview,
  type FormDesignerCaptureResult,
  type FormDesignerEditingState,
} from "@flowduet/form-create";
export const version: "0.4.0" = CORE_VERSION;
export function retarget(model: BpmnModel): BpmnModel {
  return model.retargetSequenceFlow("fa", "tail");
}
export const external: InstanceType<typeof DingtalkDesigner>["$props"] = {
  model: BpmnModel.create({ processId: "public-types", adapter: flowableAdapter }),
  propertyEditing: "external",
  selectedId: "task",
  showDefaultForm: false,
  modelRevision: 1,
};
export function capture(editor: InstanceType<typeof FormDesigner>): FormDesignerCaptureResult {
  const state: FormDesignerEditingState = editor.readEditingState();
  return state.canCapture
    ? editor.captureContent()
    : { status: "blocked", blockers: state.blockers };
}
export const manager: InstanceType<typeof FormManager>["$props"]["editingMode"] = "retained";
export const preview: InstanceType<typeof FormPreview>["$props"]["appearance"] = {
  mode: "dark",
  colorSource: "brand",
  density: "compact",
};
export const publicAppearance = {
  resolveComponentAppearance,
  createAppearanceVariables,
  readHostAppearance,
};

export async function focusExternal(component: InstanceType<typeof DingtalkDesigner>) {
  const result = await component.focusElement("a");
  if (result.status === "focused") {
    const id: string = result.selectedId;
    return id;
  }
  return result.status;
}
export function commitManager(component: InstanceType<typeof FormManager>): boolean {
  const state: FormDesignerEditingState | null = component.readEditingState();
  return state?.canCapture ? component.commitPendingEdit() : !component.hasOpenEditor();
}
