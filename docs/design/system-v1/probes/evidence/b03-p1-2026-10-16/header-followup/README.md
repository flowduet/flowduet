# P1页头关闭来源补修

基线46f720b，修复d9617b0。属于同一关闭来源P2级缺陷，不是后续文字P2切片。

页头原@click表达式在事件到达时读取当前editorSession；旧DOM按钮迟到click会弹新表单的放弃确认。现直接绑定渲染时的requestClose函数，保留来源会话。新增真实组件回归保存旧按钮、保存/重开并输入新值，再派发click，断言不弹确认、不关闭、不新增提交；RED与GREEN保留。

verification记录默认全量828/828（148+184+199+297），build/lint/strict/ESM均退出0。final重放21条Dialog+9条双Dialog/Tab/拖动保护，共30通过；这是同一受影响子集再次验证，不是再增30种新场景，也不声称最终head重跑全部125。runtime-sources.json中96源码匹配d9617b0；新测试文件另存SHA256。patch.diff.txt与限定静态补核内容一致。

Spec限定静态核对一行绑定及一项回归，0发现；没有重复全分支复审或亲跑。原有B03未验证项及APP-T单列不变，未推送。
