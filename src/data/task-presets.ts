export type TaskPreset = { title: string; dueOffsetDays: number };

export const TASK_PRESETS: TaskPreset[] = [
  { title: '断舍离：清理不再需要的物品（丢弃/赠送/出售）', dueOffsetDays: -21 },
  { title: '联系搬家公司，比价并预约', dueOffsetDays: -14 },
  { title: '准备打包材料：纸箱、胶带、气泡膜、记号笔', dueOffsetDays: -10 },
  { title: '开始打包非必需品（反季衣物、装饰、藏书）', dueOffsetDays: -7 },
  { title: '通知物业/房东退租，确认交接时间', dueOffsetDays: -5 },
  { title: '预约旧家和新家的搬家电梯/车位', dueOffsetDays: -3 },
  { title: '打包厨房非日用的锅碗餐具', dueOffsetDays: -2 },
  { title: '打包「搬家当天必需包」（换洗衣物、洗漱、充电器、证件）', dueOffsetDays: -1 },
  { title: '搬家当天：逐箱清点数量，确认到达', dueOffsetDays: 0 },
  { title: '入住后：检查贵重物品、家电是否完好', dueOffsetDays: 1 },
  { title: '拆必需品箱子，恢复日常起居', dueOffsetDays: 2 },
  { title: '更新收件地址、快递、银行卡、订阅', dueOffsetDays: 7 },
];
