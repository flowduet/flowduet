---
"@flowduet/designer": minor
---

钉钉式分支块交互（#24）：块操作四件套 `addBranchToBlock` / `removeBranch`（递归级联删支路全部节点，块至少两支）/ `removeBlock`（fork/join 与全部支路级联、前后重链，带「整块即支路」空分支守卫）/ `setDefaultBranch`（设/切/清，并行块显式拒绝）；条件表达式 `setBranchCondition` 写回 FormalExpression（仅分支 fork 出线可配，默认流转互斥守卫）；块头「+ 分支」「删块」与默认开关、支路头删除与条件抽屉；块操作与抽屉守卫抛错统一经内联可读提示呈现。
