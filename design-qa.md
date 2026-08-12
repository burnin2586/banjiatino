# Banjiatino Blue Toy UI — Design QA

- **日期:** 2026-08-12
- **设备:** iPhone 17 Pro Simulator, iOS 26.3
- **构建:** Xcode Debug, scheme `BanjiaTiaoli`, SDK `iphonesimulator`
- **验证执行:** 实现会话(上一 agent);本文档由接力 agent 汇总归档
- **对照稿:** Home `562f483c` / Boxes `7d4c726f` / Memories `51a2cfbc`(Superdesign approved drafts)

> 本文汇总实现会话的构建/测试记录与同态截图,按实现计划 Task 9 的 8 项维度归档。视觉对照在实现会话中完成,本文为结果记录。

---

## 1. 自动化门禁(JS gate)

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | ✅ pass |
| `npm run lint` | ✅ pass |
| `npm test -- --runInBand` | ✅ 10 suites / 49 tests pass |

新增样式契约测试覆盖 token 与组件:`app-theme.test.ts`、`ui-kit-style.test.ts`、`tab-presentation.test.ts`、`index.test.ts`、`memory/index.test.ts`、`boxes-presentation.test.ts`。

## 2. 原生构建

```
xcodebuild -workspace ios/BanjiaTiaoli.xcworkspace \
  -scheme BanjiaTiaoli -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' build
→ ** BUILD SUCCEEDED **
```

x86_64 产物已安装并运行于 iPhone 17 Pro / iOS 26.3 Simulator。Codegen 与原生链接中无 Expo 模块。

## 3. 设计契约落地(token 核对)

`src/constants/app-theme.ts` 实际值与 spec 对照:

| 维度 | 实际值 | spec |
|---|---|---|
| 主色 | `#176BDB` / `#2F80ED` / `#BFDFFF` / `#F3F9FF` / `#FFFFFF` | ✅ 一致 |
| 黄重点 | `#FFC928` / `#FFF3BD` | ✅ 一致 |
| Ink / Line | `#17243A` / `#53657D` / `#D8E8F7` | ✅ 一致 |
| 语义红(Danger) | `#A12F2F` | ✅ 一致(删除/危险未用黄替代) |
| 圆角 | page 24 / card 18 / control 14 / label 10 | ✅ 一致 |
| 阴影 | ceramic(opacity 0.08,低浮起)+ raised(opacity 0.2,可操作),top-left 光照 | ✅ 一致 |
| 动效 | press 120ms / standard 180ms | ✅ 一致(spec 100–140 / 180–220) |

## 4. 三页视觉对照(8 维度)

按 Task 9 Step 4 检查:spacing / hierarchy / radii / soft shadows / one-yellow-focus / nav selection / Dynamic Type wrapping / content accuracy。

### Home(进度首页)— `design-qa/home.jpg`
- 顶部当前阶段 + 整体进度,中部立体进度滑轨 ✅
- 待办放入白色模块化托盘,五栏底部导航选中项为蓝色实体 ✅
- 黄色仅用于当前唯一里程碑,可见面积 < 10% ✅
- 「开始我的搬家」仅走到确认弹窗,样本数据未破坏 ✅

### Boxes(箱子页)— `design-qa/boxes.jpg` / `boxes-lower.jpg`
- 三箱真实数据 + 五种状态控件齐全 ✅
- 蓝/白模块化搬运箱(非棕色纸箱),编号 / 起点 / 终点 / 状态层级清晰 ✅
- 新建箱子 sheet 开合正常 ✅

### Memories(回忆首页)— `design-qa/memories.jpg`
- 零房屋初始态 + 新增家 sheet ✅
- 蓝白立体相框,无泛黄照片 / 牛皮纸 / 旧皮革 ✅

## 5. Dynamic Type 验证

截图 `design-qa/home-dynamic-type.jpg`、`design-qa/memories-dynamic-type.jpg`(取自 Simulator 最大无障碍字号档)。关键字段换行而非截断,卡片高度自适应 — 符合 spec §10「Dynamic Type 放大后允许卡片增高,不截断关键字段」。

## 6. 可访问性核对

- 最小触控区 44×44pt ✅
- 安全区 inset 已处理 ✅
- 状态非单靠颜色(文字/图标并存)✅
- 正文/背景对比度满足 WCAG AA(Ink `#17243A` on `#F3F9FF` / `#FFFFFF`)✅

## 7. 已知遗留(非阻断)

1. **Simulator 无障碍字号** 验证后未恢复默认,仍停在最大档。属环境态,不影响实现交付;可在模拟器 *Settings → Accessibility → Larger Text* 拖回默认。
2. **`.xcodebuildmcp-derived/`** 为 xcodebuildmcp 派生产物,已加入 `.gitignore`,不纳入提交。

## 8. 截图清单

- `design-qa/home.jpg`
- `design-qa/home-dynamic-type.jpg`
- `design-qa/boxes.jpg`
- `design-qa/boxes-lower.jpg`
- `design-qa/memories.jpg`
- `design-qa/memories-dynamic-type.jpg`

---

## final result: passed

原生构建与全部 JS 门禁通过,三页同态截图齐备,token 契约与 spec 一致,Task 9 的 8 项视觉维度达标。唯一遗留(Simulator 字号未回默认)为环境态,不影响实现交付。
