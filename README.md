# 搬家条理

一个在 Expo Go 中运行的本地优先搬家整理 App。它用“房间 → 箱子 → 物品 → 到达清点”的方式，帮助用户在搬家过程中追踪重要物品的去向。

## 当前功能

- 搬家整体进度与待办提醒
- 自定义旧家和新家的房间
- 创建连续编号的箱子并设置来源、目标房间
- 添加物品、数量、原位置、新家位置、处理方式、所属箱子和备注
- 编辑和删除箱子、物品，并将状态调整到任意阶段
- 删除非空箱子时保留物品并自动恢复为未分配状态
- 按物品名称、原位置、新家位置、房间、箱号和备注搜索
- 自动把 V1 本地数据迁移到 V2 数据结构
- 使用 SQLite 将数据保存在设备本地

## 项目结构

- `src/app/`：四个主要页面和底部导航
- `src/context/`：搬家状态与本地持久化
- `src/components/`：共用界面组件
- `src/data/`：首次启动时使用的示例数据
- `src/types/`：房间、箱子和物品的数据类型

## 本地启动

1. 安装依赖：`npm install`
2. 启动 Expo：`npx expo start`
3. 使用同一网络下的 iPhone 打开 Expo Go 并扫描二维码

本项目当前定位为个人原型，不需要 Apple Developer Program。

---

## Expo starter reference

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
