# 搬家条理

一个本地优先的 iOS App，用来记录住过的房子、整理家中物品，并在搬家时追踪“房间 → 箱子 → 物品 → 到达清点”的全过程。

项目基于 Expo SDK 54 和 React Native 0.81，但不再依赖 Expo Go。日常开发使用项目自己的 development build，并通过 Xcode 或 Expo CLI 编译原生 iOS 工程。

## 当前功能

- 记录住过的家、房间平面图和照片
- 创建连续编号的箱子并设置来源、目标房间
- 记录物品数量、原位置、新位置、处理方式、箱子和备注
- 拍摄收纳照片并在照片上标记箱子位置
- 按物品名称、位置、房间、箱号和备注搜索
- 使用 SQLite 将数据保存在设备本地

## 环境要求

- Node.js 20.19+（推荐 Node 20 或 22 LTS）
- Xcode 16.1+
- CocoaPods
- iOS 15.1+
- 真机调试需要在 iPhone 上开启 Developer Mode

## 首次运行

```bash
npm install
npm run ios
```

`npm run ios` 会使用 `ios/` 原生工程构建 App、安装到 iOS Simulator，并启动 Metro。

真机运行：

```bash
npm run ios:device
```

首次安装 CocoaPods 依赖后，也可以运行 `npm run ios:xcode` 打开 `ios/app.xcworkspace`，在 Xcode 的 Signing & Capabilities 中选择自己的 Team，然后选择模拟器或已开启 Developer Mode 的 iPhone 运行。请打开 `.xcworkspace`，不要打开 `.xcodeproj`。

当前 Bundle Identifier 是 `com.boninglyu.banjiatino`。如果它不属于你的 Apple Developer 账号，请同时修改 `app.json` 和 Xcode target 中的 Bundle Identifier。

## 日常开发

只修改 TypeScript/JavaScript 时，不需要重新编译原生 App：

```bash
npm start
```

安装或升级原生依赖、修改 `app.json`、升级 Expo SDK 后，需要同步原生工程并重新构建：

```bash
npm run ios:prebuild
npm run ios
```

`ios/` 已纳入版本控制。执行 `expo prebuild --clean` 会重建该目录，并可能覆盖直接在 Xcode 中做的原生修改，使用前请先检查 Git diff。

## 验证

```bash
npm run lint
npm test
npx tsc --noEmit
npx expo-doctor
```

## 项目结构

- `ios/`：Xcode 原生工程和 CocoaPods 配置
- `src/app/`：Expo Router 页面与导航
- `src/context/`：本地状态与持久化
- `src/components/`：共用界面组件
- `src/logic/`：迁移、业务规则与文件存储逻辑
- `src/types/`：数据类型
