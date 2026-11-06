import { watch } from "vue";
import type { AppearanceColorSource, AppearanceMode } from "@flowduet/designer";

interface HostModeControls {
  colorSource: AppearanceColorSource;
  mode: AppearanceMode;
}

interface HostThemeProps {
  hostDark: boolean;
  scopedDark: boolean;
}

/** host 配色必须跟随宿主声明；品牌实例的独立主题不由这里改写。 */
export function useAppearanceHostMode(
  props: HostThemeProps,
  instances: readonly HostModeControls[],
): {
  syncHostMode: (controls: HostModeControls) => void;
} {
  function syncHostMode(controls: HostModeControls): void {
    if (controls.colorSource === "host")
      controls.mode = props.hostDark || props.scopedDark ? "dark" : "light";
  }

  watch(
    () => props.hostDark || props.scopedDark,
    () => instances.forEach(syncHostMode),
    { immediate: true },
  );

  return { syncHostMode };
}
