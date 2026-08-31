# 全 App 蓝白玩具风 — Design QA

- 日期：2026-08-31
- 设计源：Superdesign 项目 `709a20d6-e9fa-482a-9090-7be568b21f4c`
- 设计稿：首页 `a44cc94b-84c3-4a90-bd53-6eb126ebdf96`、物品 `fbc9fcc4-aeda-4931-9043-dc7bc28533af`、箱子 `6eebb693-5895-4eda-9b75-1fdfbde57de1`、搜索 `1106677b-a4db-4d21-9444-894fd09cc22b`、任务 `d34d596b-f5d1-455b-87a8-92bf99e83e7e`、收纳照片 `cc61e540-f449-4d80-b7db-1c2983589a17`、协作 `a58ee210-cd83-4af2-8dba-c06ef894ac6b`、加入项目 `3475bd8c-7f6b-4def-9efa-743b4065cb85`
- 设计系统：`.superdesign/design-system.md`
- 目标视口：390 × 844 pt，浅色模式
- 设计稿尺寸：390 × 844 CSS px，1×
- 实现截图：已采集。iPhone 17（iOS 26.3，402 × 874 pt @3x）Debug 构建，`/tmp/banjiatino-ui/`（00 onboarding、16/18/29/30 首页、23 物品、25 箱子、26 查找、27 管理房间）。与设计稿视口相差 12 pt 宽度，未做逐像素对齐。
- 状态：主流程 7 个界面状态已完成截图对照；任务时间线页与收纳照片页未采集（见"未覆盖"）。

## Findings

### P0

- [P0] 前置页无 SafeAreaProvider，内容压进状态栏
  - 位置：`src/app/collaboration-onboarding.tsx`（heroIcon 与"创建或加入搬家项目"标题）、`src/app/join-project.tsx`（同构）；根因在 `App.tsx` 未在根部挂 `SafeAreaProvider`。
  - 证据：截图 00/01 中蓝色 Users 图标叠在状态栏时钟上。主界面（NavigationContainer 内）因 bottom-tabs 自带 SafeAreaProviderCompat 而正常，反证前置页缺失 provider。
  - 影响：带刘海/灵动岛设备上首次运行的品牌首屏直接与系统 UI 重叠。
  - 修复：在 `App.tsx` 根部包一层 `SafeAreaProvider`；同时移除这两个页面外层多余的 `SafeAreaView`（与内层 `Screen` 重复嵌套）。

### P1

- [P1] Onboarding 开关使用 iOS 默认绿色
  - 位置：`src/app/collaboration-onboarding.tsx` "导入本机记录" `Switch`。
  - 证据：截图 00/01 中开关为系统绿色。设计系统规定只使用蓝白黄、成功状态用主蓝、不新增绿色体系。
  - 修复：设置 `ios_backgroundColor`（未选中 `#D8E8F7`）与 `trackColor`（选中 `#176BDB`）。

- [P1] 房间颜色体系脱离设计系统色板
  - 位置：`src/data/initial-data.ts:10-17`（默认房间）、`src/components/room-manager.tsx:16`（`ROOM_COLORS` 选择器）、`src/logic/moving.ts:53,69`、`src/context/project-data-context.tsx:52`。
  - 证据：截图 27（管理房间）与截图 30（首页房间卡）中出现紫 `#D8CBE8`、绿 `#BFDCCB`、橙 `#F0CF9F`、粉 `#F3B9B1`、卡其 `#D8D1BC`。设计系统明确"只使用以下颜色…不引入紫色、粉色、青绿色"。
  - 修复：将房间标记色收敛到色板内（如 `#176BDB`、`#2F80ED`、`#BFDFFF`、`#FFC928` 及蓝灰阶），或与设计确认新增一组低饱和蓝系标记色后更新设计系统文档。

- [P1] 日期弹窗不滚动直接点"完成"不会保存日期
  - 位置：`src/components/date-wheel.tsx` + `src/app/index.tsx:228-230`（`ModalSheet` 仅在 `onChange` 时 `setMovingDate`）。
  - 证据：实测打开"设置搬家日"后直接点"完成"，弹窗关闭但首页仍显示"设置搬家日期"卡；重启 App 后同样。只有滚动滚轮触发 `onChange` 才会保存。
  - 影响：主流程第一步（设置搬家日期）对用户表现为"点了没反应"。
  - 修复：打开弹窗时若 `movingDate === null`，确认时把当前滚轮值作为初始日期提交（或在确认回调里始终读取滚轮当前值）。

- [P1] 设置日期后首页同屏两个大面积蓝色主模块（代码确认，运行时未能复核）
  - 位置：`src/app/index.tsx:261-267`（`countdownCardActive`）与 `:304-310`（`heroCard`），均为 `#176BDB` 背景 + `AppRadius.page` 24pt。
  - 证据：因上一条日期保存 bug，带日期状态未能截图；代码显示两卡同屏并列。
  - 修复：倒计时卡改白底/次级表面，仅保留"搬运进度"为唯一大蓝模块；或合并两卡。

- [P1] `accentSoft #FFF3BD` 不在设计系统色板
  - 位置：`src/constants/app-theme.ts:9`，用于 `src/app/search.tsx` `answerWarning` 背景。
  - 修复：改用 `#EAF4FF` + `#A12F2F` 左边线表达警示，或将该色正式补进设计系统（需设计确认）。

### P2

- [P2] 物品页水平边距 16pt，其余页面 20pt
  - 位置：`src/app/items.tsx` `screenContent` 用 `AppSpacing.lg`（16），设计规定页面水平边距 20pt。截图 23 与首页对比可见内容更贴边。
- [P2] 任务时间线页标题 22pt，低于页面标题 28–32pt 规范
  - 位置：`src/app/task-timeline.tsx:235-241`（其余页面均为 `PageHeader` 32pt）。
- [P2] 勾选状态混用文本 '✓' 与 Lucide Check 图标
  - 位置：`src/app/task-timeline.tsx:88`（checkbox）、`src/components/room-manager.tsx:150`（色球选中）用文本字形；`ChoiceChip` 用 Lucide `Check` 图标。设计规定统一 Lucide 线性图标、不用字符符号。
- [P2] warning 语义色等于深色文字 `#17243A`，无警示感
  - 位置：`src/constants/app-theme.ts:14`；截图 26 中"未分配箱子 1"只是深色数字。设计规定警示状态用浅蓝或少量黄色。
- [P2] 首页房间网格与"最近更新"逐项独立卡片
  - 位置：`src/app/index.tsx` `roomGrid`/`listGap`。设计规定"避免每一项都做成悬浮卡片…房间和箱子列表应使用共享表面与行分隔"。
- [P2] 查找页搜索框圆角 22pt，超出控件 12–14pt 规范
  - 位置：`src/app/search.tsx` `searchBox` 用 `AppRadius.lg`。

### P3

- [P3] 死样式清理：`index.tsx`（`countdownDesc`、`alertEmoji`、`alertDescription`、`boxEmoji`、`progressCircle`/`progressCircleValue`/`progressCircleLabel`）、`items.tsx` `itemIconText`、`boxes.tsx` `addPlus`/`routeArrow`、`search.tsx` `searchIcon`、`invite-family-card.tsx` `hint`。
- [P3] `ui-kit.tsx:35 getChoiceChipLabel` 会拼 `"✓ " + label`，而 `ChoiceChip` 已渲染 Check 图标——一旦被使用会出现双勾，建议删除。
- [P3] 错误提示缺"下一步"：`items.tsx` "请输入物品名称"、`boxes.tsx` "请输入箱子名称/请选择旧家和新家房间"只陈述问题。
- [P3] 首页"物品总数 15"按件数求和，物品页筛选"全部 6"按类别数，口径不同易误读。

## Required Fidelity Surfaces（本轮核验结论）

- 字体与排版：标题/模块/正文层级与设计一致（首页 32pt、模块 19–20pt、标签 11–13pt）；例外见 P2 任务页标题。
- 间距与布局节奏：首页/箱子/查找 20pt 边距 ✓；物品页 16pt ✗；卡片间距与底部导航占位正常。
- 颜色与视觉 token：主体蓝白体系、单黄强调（首页异常卡图标）✓；房间颜色体系与 onboarding 开关 ✗（见 P1）。
- 图片与图标：全部为 Lucide 线性图标，无 emoji/字符导航 ✓；任务页与色球选中的 '✓' 字形为例外（P2）。
- 文案与内容：设计系统"禁止口号"清单已全部清除 ✓；页面标题、按钮动词、状态词与固定文案一致 ✓；错误提示待补下一步（P3）。

## Comparison Evidence

- 全屏比较：已完成 7 个状态（onboarding、首页×3 屏、物品、箱子、查找、管理房间弹窗），截图在 `/tmp/banjiatino-ui/`。
- 局部比较：顶部标题、进度主模块、筛选 chips、状态徽章、箱卡 route 区、空状态均已对照；差异逐条记入 Findings。
- 旧版 `design-qa/` 截图对应 2026-08-12 三页面版本，本轮未再引用。

## Primary Interaction Checks（本轮已执行）

- 创建项目（含软键盘输入称呼/项目名、创建按钮禁用→可用态）✓
- 会话持久化：杀进程重启跳过 onboarding 直接进首页 ✓
- 四个底部 tab 切换与选中态底座 ✓
- 首页滚动、管理房间弹窗、日期弹窗开合 ✓（保存失败见 P1）
- 未执行：搜索输入与结果态、添加/编辑物品与箱子、任务导入与勾选、收纳照片拍摄与标注、权限拒绝路径。

## Comparison History

- 2026-08-22：因无 Simulator 截图阻塞。
- 2026-08-31：本轮完成截图采集与对照，形成 P0×1、P1×5、P2×6、P3×4。

## Implementation Checklist

1. 修 P0 SafeAreaProvider（`App.tsx`），清理两处嵌套 SafeAreaView。
2. 修日期弹窗保存逻辑，复核首页双大蓝模块（P1 连锁项）。
3. 收敛房间颜色到色板；Switch 改主蓝。
4. 物品页边距改 20pt；统一勾选图标；重定义 warning 色。
5. 清理 P3 死样式与文案。
6. 补采：任务时间线页、收纳照片页、搜索结果态、Dynamic Type 大字号，替换本文件截图引用。

## final result: passed-with-findings

本轮已解除截图阻塞并完成对照；遗留 P0×1、P1×5、P2×6、P3×4，修复后建议按 Implementation Checklist 复查。
