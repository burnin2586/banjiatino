# 家庭协作基础版验收记录

日期：2026-08-20 · 构建：Debug ad-hoc（Metro dev bundle，commit f961fb6）· 设备：iPhone 17 Pro 模拟器（创建者）+ iPhone 17 Pro Max 模拟器（加入者）· 后端：Supabase Free（cbykcfylvtktejatxlad）

## 结果矩阵

| 场景 | 结果 | 证据 |
|---|---|---|
| 匿名引导创建项目 | PASS | 服务端项目 + profile + membership 原子建立（curl 验证） |
| 邀请链接生成（256 位 token、只存哈希、7 天有效） | PASS | curl 全链路验证：生成/接受/重复接受幂等/伪造拒绝 |
| 手动邀请码加入（粘贴链接或裸 token） | PASS | Pro Max 加入 Pro 的项目，项目 ID 一致 |
| A 推送房间/箱子 → 服务端编号分配 | PASS | BOX-001~004 依次分配，幂等重放无重复 |
| B 冷启动拉取全量数据 | PASS | B 拉到 2 房间 + 箱子，游标与 A 一致 |
| B 新建箱子 → A 实时出现（Realtime 唤醒 + UI 刷新） | PASS | BOX-003/004 数秒内自动出现在 A |
| 跨用户 RLS 隔离 | PASS | 陌生人读项目返回空、直接写表 403（curl） |
| 同步失败可见性（横幅 + 重试） | PASS | 拉取/推送失败计入横幅，点按重试 |

## 验收期间修复的缺陷（commit）

1. `51384f9` 加入设备缺本地项目行（外键全面失败）+ 拉取失败不可见
2. `e65b87d` Hermes crypto 探测产出非 UUID ID（RPC 22P02 拒绝）+ 错误序列化为 [object Object]
3. `de7c359` 解码器 readRecord 自 Task 3 起未拆 {result}/{page} 信封（旧测试喂错形状而全绿）
4. `8cad6ad` 推送成功后未将服务端回执（版本/箱号）写回本地行，导致永不收敛
5. `af1cf42` Realtime 订阅缺少 table 参数，事件永不送达
6. `f961fb6` 拉取落库后未发本地通知，界面不刷新

## 未在本轮覆盖（后续计划）

- 同时离线双建箱的编号冲突（服务端 max+1 分配已由 curl 验证，未做双机同时操作）
- 箱子状态回退提交（merge 规则单测覆盖，未双机实测）
- 杀进程后离线队列恢复、三设备矩阵
- 真机 Universal Link（需 Team ID 替换 AASA/entitlements 占位）
- pgTAP 运行时（无 Docker）
