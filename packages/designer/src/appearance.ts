export type AppearanceColorSource = "host" | "brand";
export type AppearanceMode = "light" | "dark";
export type AppearanceDensity = "comfortable" | "compact";

/** 组件实例的显式外观配置；省略整个对象才表示沿用旧路径。 */
export interface ComponentAppearance {
  colorSource?: AppearanceColorSource;
  mode: AppearanceMode;
  density?: AppearanceDensity;
}

/** 补齐默认值后的有效外观配置，可安全传给具体组件消费。 */
export interface ResolvedComponentAppearance {
  colorSource: AppearanceColorSource;
  mode: AppearanceMode;
  density: AppearanceDensity;
}

function reject(
  field: string,
  reason: string,
  previous?: ResolvedComponentAppearance,
): ResolvedComponentAppearance | undefined {
  console.warn(`[FlowDuet] ${field} ${reason}；已整份拒绝本次 appearance 配置。`);
  return previous;
}

/** 归一化公开配置；后续表单预览复用同一合同，不另建一套默认值。 */
export function resolveComponentAppearance(
  value: unknown,
  previous?: ResolvedComponentAppearance,
): ResolvedComponentAppearance | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null)
    return reject("appearance", "必须是一个配置对象", previous);

  try {
    if (Array.isArray(value)) return reject("appearance", "必须是一个配置对象", previous);
    const appearance = value as Record<string, unknown>;
    const colorSource = appearance.colorSource === undefined ? "host" : appearance.colorSource;
    const mode = appearance.mode;
    const density = appearance.density === undefined ? "comfortable" : appearance.density;
    if (colorSource !== "host" && colorSource !== "brand")
      return reject("appearance.colorSource", '只支持 "host" 或 "brand"', previous);
    if (mode !== "light" && mode !== "dark")
      return reject("appearance.mode", '必填，且只支持 "light" 或 "dark"', previous);
    if (density !== "comfortable" && density !== "compact")
      return reject("appearance.density", '只支持 "comfortable" 或 "compact"', previous);

    return { colorSource, mode, density };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return reject("appearance", `无法读取配置属性（${reason}）`, previous);
  }
}
