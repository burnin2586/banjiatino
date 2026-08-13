# 搬家条理

本地优先的 iOS 搬家整理 App，使用 React Native Community CLI 和原生 Xcode 工程，不依赖 Expo。

## 当前功能

- 搬家整体进度与作战台
- 搬家日倒计时与任务时间线（预设任务、建议完成日）
- 自定义旧家和新家的房间
- 创建连续编号的箱子并设置来源、目标房间
- 添加、编辑、搜索和清点物品；支持从房间模板一键导入
- 拍照记录储物位置和房间布局
- 数据与照片保存在设备本地

## 环境要求

- Node.js 20.19.4 或更高版本
- Xcode 16.1 或更高版本
- CocoaPods
- 真机运行和发布需要 Apple Developer Program、有效 Team 与签名配置

## 用 Xcode 运行

首次拉取或原生依赖变化后：

```bash
npm install
cd ios
pod install
cd ..
```

启动 Metro：

```bash
npm start
```

然后打开 `ios/BanjiaTiaoli.xcworkspace`（不要打开 `.xcodeproj`），选择 `BanjiaTiaoli` scheme 和模拟器或真机，点击 Run。

真机首次运行还需要在 Xcode 的 `Signing & Capabilities` 中选择 Team，并把占位 Bundle Identifier `com.banjiatino.app` 改成自己的唯一标识。

也可从命令行启动模拟器：

```bash
npm run ios
```

## 质量检查

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

## 发布前清单

- 在 `ios/BanjiaTiaoli/Images.xcassets/AppIcon.appiconset` 放入正式 App Icon
- 确认 Bundle Identifier、Team、证书和 provisioning profile
- 递增 `MARKETING_VERSION` 与 `CURRENT_PROJECT_VERSION`
- 在真机验证相机、相册的允许/拒绝/受限状态以及 App 重启后的数据和照片
- 按最终依赖和实际数据行为复核 `PrivacyInfo.xcprivacy` 与 App Store Connect 隐私问卷
- 准备隐私政策 URL、支持 URL、截图、描述、年龄分级和审核说明
- 用 Xcode 的 Product > Archive，在 Organizer 中 Validate 后上传 TestFlight/App Store Connect

## 项目结构

- `App.tsx`：导航和全局 Provider 入口
- `src/app/`：页面
- `src/navigation/`：React Navigation 类型
- `src/context/`：本地状态与持久化
- `src/components/`：共用组件
- `src/logic/`：领域逻辑和照片文件操作
- `ios/`：可直接由 Xcode 打开的原生工程
