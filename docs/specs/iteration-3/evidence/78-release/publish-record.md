#78 发布执行记录（2026-10-13）

## 发布动作

- 命令：`pnpm changeset publish`（在 chore/78-release-iteration-3 分支，HEAD = 085802a）
- Changesets 判定三包均未在 registry，全部发布：@flowduet/core@0.3.0、@flowduet/designer@0.1.0、@flowduet/form-create@0.1.0
- 退出码 0；自动创建三个附注 tag（均指向 085802a）：
  - @flowduet/core@0.3.0
  - @flowduet/designer@0.1.0
  - @flowduet/form-create@0.1.0
- `git push origin` 推送三 tag 成功（远端规则集：发版 tag 不可删改）
- 无手工裸 v 版本 tag，无版本复用，无手工 dist-tag 操作（latest 均由 publish 原生置位）

## 发布后读回（明细见同目录 npm-readback.json / git-tags-readback.txt / published-tarballs.json）

- 与 #77 批准版本清单核对：@flowduet/core 0.3.0、@flowduet/designer 0.1.0、@flowduet/form-create 0.1.0 —— 三包 latest 与批准清单一一相等，无不一致
- 三包 registry shasum 与本地 pack SHA1 逐一相等（数值见 published-tarballs.json）
- 远端 git tag `git ls-remote --tags` 读回：三 tag peeled 均指向 085802a470147b9f7cf322d217f7450fe1c4700e（与所发提交一致）

## 异常与恢复记录：form-create packument CDN 负缓存

- 现象：publish 退出码 0 且三 tag 均建，但 `npm view @flowduet/form-create` 在 registry.npmjs.org 持续 404（core 约 30 秒内可见、designer 约 90 秒内可见）
- 甄别：
  1. tarball 直连探测 HTTP 200：https://registry.npmjs.org/@flowduet/form-create/-/form-create-0.1.0.tgz
  2. 下载远端 tarball SHA256 = b95ea68e...（与本地 pack、#77 基准三方一致）
  3. registry.yarnpkg.com（同后端不同 CDN）packument 正常：dist-tags.latest=0.1.0
  4. registry.npmjs.org 带 bypass 查询参数读回完整 packument：dist-tags.latest=0.1.0，versions 含 0.1.0
- 结论：发布与写入完全成功，仅 Cloudflare 边缘（观测节点 FRA）对 packument 404 负缓存；非部分失败，无需重发、未重复发布任何版本
- 恢复确认：发布约 5 分钟后 `npm view @flowduet/form-create --registry https://registry.npmjs.org/` 恢复正常——version=0.1.0、latest=0.1.0，负缓存自然过期，三包读回通道全部一致
- 附注：packument 另含 0.0.0-stage stub 版本，为 npm org 建包时自动创建的占位（maintainer 为 org owner），非本次发布产物。发布前官方源 `npm view` 持续 404 而主库 packument 已含该 stub，两者并存说明 stub 阶段的 packument 从未传播到官方域名公共读路径——对「发布前版本不存在」的判定无影响：0.0.0-stage 不在批准清单、无 dist-tag 指向、本次发布未复用它，latest 由 publish 原生置位。

## 消费入口

- 真实安装演练（见 install-check.txt）：临时目录自官方源 `npm install @flowduet/{core,designer,form-create}@latest`，安装后 node_modules 内三包实际版本 0.3.0 / 0.1.0 / 0.1.0，与批准清单一致
- 产物内容与 #77 外部验收产物逐字节一致（SHA256 比对见 local-verification.txt），完整外部消费证据（JS/类型/CSS/浏览器/Flowable 6.8）沿用 docs/specs/iteration-3/evidence/77-version-prep/，无差异，未重新验证。
