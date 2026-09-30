/**
 * XML 命名空间使用审计（#75，验收 A20）：
 * bpmn-moddle 对「未注册 URI 的带前缀属性」不产生警告而是静默收进 $attrs
 * （键名还可能被改写成 ns0: 前缀），语义丢失对调用者不可见——假借
 * flowable 前缀但绑定其他 URI、实际使用 camunda 扩展等内容会混过
 * rejectWarnings 检查。本模块按原始 XML 的实际使用内容判定：收集带
 * 前缀的元素/属性名，经作用域内的 xmlns 声明解析为 URI，对照已注册
 * 集合报告未注册项。仅声明未使用的命名空间不构成使用，天然放行。
 */

export interface NamespaceUsageIssue {
  /** 使用处解析出的命名空间 URI；前缀从未声明时为空串 */
  uri: string;
  /** 使用处书写的前缀（保留原样，便于回查文本） */
  prefix: string;
  /** 带前缀的限定名，如 flowable:assignee */
  qualifiedName: string;
  kind: "element" | "attribute";
  /** 使用所在行号（1 起） */
  line: number;
}

/** XML 基建命名空间：schema 实例与保留前缀，与引擎方言无关，不参与判定 */
const INFRASTRUCTURE_URIS = new Set([
  "http://www.w3.org/2001/XMLSchema-instance",
  "http://www.w3.org/XML/1998/namespace",
]);

/** 前缀作用域帧：键为前缀（"" 键表示默认命名空间） */
type ScopeFrame = Map<string, string>;

// 名字字符集：字母数字、"."、"_"、连字符与宽 Unicode；"-" 必须放字符类
// 末尾作为字面量，否则与相邻字符组成范围（曾把 "=" 误吞进名字）
const isNameChar = (ch: string): boolean => /[A-Za-z0-9_.\u00B7\u00C0-\uFFFF:-]/.test(ch);

/**
 * 扫描 XML 文本，报告「实际使用但未注册」的命名空间项。
 * 扫描器只求使用判定可靠（跳过注释/CDATA/PI/DOCTYPE，按引号切属性值，
 * 维护嵌套的前缀作用域），不追求完整 XML 校验——结构坏 XML 由解析层报错。
 */
export function collectUnregisteredNamespaceUsage(
  xml: string,
  registeredUris: ReadonlySet<string>,
): NamespaceUsageIssue[] {
  const issues: NamespaceUsageIssue[] = [];
  const scopes: ScopeFrame[] = [];
  const lookupUri = (prefix: string): string | undefined => {
    // xml 前缀由 XML 规范保留、隐式绑定固定 URI，不要求（也不允许）显式声明
    if (prefix === "xml") return "http://www.w3.org/XML/1998/namespace";
    for (let s = scopes.length - 1; s >= 0; s -= 1) {
      const uri = scopes[s]?.get(prefix);
      if (uri !== undefined) return uri;
    }
    return undefined;
  };

  const n = xml.length;
  let i = 0;
  let line = 1;

  /** 越界安全取字符：循环条件已保证边界，双保险防 undefined 串入正则 */
  const at = (index: number): string => xml[index] ?? "";

  const advance = (end: number): void => {
    for (; i < end; i += 1) {
      if (at(i) === "\n") line += 1;
    }
  };

  /** 记录一次带前缀使用：URI 在作用域内解析，未注册才进诊断 */
  const record = (qualifiedName: string, kind: "element" | "attribute"): void => {
    const separator = qualifiedName.indexOf(":");
    if (separator <= 0) {
      // 无前缀元素：仅当默认命名空间在作用域时按默认 URI 审计；
      // 无前缀属性不属于任何命名空间（XML 规范），不审计
      if (kind === "element") {
        const defaultUri = lookupUri("");
        if (defaultUri !== undefined && !isRegistered(defaultUri)) {
          issues.push({ uri: defaultUri, prefix: "", qualifiedName, kind, line });
        }
      }
      return;
    }
    const prefix = qualifiedName.slice(0, separator);
    if (prefix === "xmlns") return;
    const uri = lookupUri(prefix);
    if (uri !== undefined && isRegistered(uri)) return;
    issues.push({
      uri: uri ?? "",
      prefix,
      qualifiedName,
      kind,
      line,
    });
  };

  const isRegistered = (uri: string): boolean =>
    INFRASTRUCTURE_URIS.has(uri) || registeredUris.has(uri);

  while (i < n) {
    const ch = at(i);
    if (ch === "\n") {
      line += 1;
      i += 1;
      continue;
    }
    if (ch !== "<") {
      i += 1;
      continue;
    }

    if (xml.startsWith("<!--", i)) {
      const end = xml.indexOf("-->", i + 4);
      advance(end === -1 ? n : end + 3);
      continue;
    }
    if (xml.startsWith("<![CDATA[", i)) {
      const end = xml.indexOf("]]>", i + 9);
      advance(end === -1 ? n : end + 3);
      continue;
    }
    if (xml.startsWith("<?", i)) {
      const end = xml.indexOf("?>", i + 2);
      advance(end === -1 ? n : end + 2);
      continue;
    }
    if (xml.startsWith("<!", i)) {
      // DOCTYPE 等 DTD 标记：跳到本声明收尾（内部子集极少嵌套，解析层兜底）
      const end = xml.indexOf(">", i + 2);
      advance(end === -1 ? n : end + 1);
      continue;
    }

    if (at(i + 1) === "/") {
      // 闭标签：只弹作用域，不解析内容
      const end = xml.indexOf(">", i + 2);
      advance(end === -1 ? n : end + 1);
      scopes.pop();
      continue;
    }

    // ---------- 开标签：解析元素名与属性 ----------

    const tagLine = line;
    let cursor = i + 1;
    let name = "";
    while (cursor < n && isNameChar(at(cursor))) {
      name += at(cursor);
      cursor += 1;
    }
    const frame: ScopeFrame = new Map();
    scopes.push(frame);
    let selfClosing = false;

    while (cursor < n) {
      // 跳过标签内空白
      while (cursor < n && /\s/.test(at(cursor))) {
        if (at(cursor) === "\n") line += 1;
        cursor += 1;
      }
      if (cursor >= n) break;
      if (at(cursor) === ">") {
        cursor += 1;
        break;
      }
      if (at(cursor) === "/") {
        selfClosing = true;
        cursor += 1;
        continue;
      }

      // 属性名
      let attrName = "";
      while (cursor < n && isNameChar(at(cursor))) {
        attrName += at(cursor);
        cursor += 1;
      }
      if (attrName === "") {
        // 无法识别的字符：推进一位防止死循环（结构问题留给解析层）
        cursor += 1;
        continue;
      }
      // 跳过 = 与空白
      while (cursor < n && /\s/.test(at(cursor))) cursor += 1;
      if (at(cursor) !== "=") continue;
      cursor += 1;
      while (cursor < n && /\s/.test(at(cursor))) cursor += 1;
      const quote = at(cursor);
      if (quote !== '"' && quote !== "'") continue;
      const valueEnd = xml.indexOf(quote, cursor + 1);
      const value = xml.slice(cursor + 1, valueEnd === -1 ? n : valueEnd);
      // 引号值内的换行计入行号；尖括号不视为标签边界（属性值语境）
      for (let k = cursor + 1; k < (valueEnd === -1 ? n : valueEnd); k += 1) {
        if (at(k) === "\n") line += 1;
      }
      cursor = valueEnd === -1 ? n : valueEnd + 1;

      if (attrName === "xmlns") {
        frame.set("", value);
      } else if (attrName.startsWith("xmlns:")) {
        frame.set(attrName.slice(6), value);
      } else if (attrName.includes(":")) {
        record(attrName, "attribute");
      }
    }

    // 元素名在帧压栈后记录：同标签上的声明即可解析（xmlns 与使用同元素合法）
    const elementLine = tagLine;
    const savedLine = line;
    line = elementLine;
    record(name, "element");
    line = savedLine;

    if (selfClosing) scopes.pop();
    i = cursor;
  }

  return issues;
}
