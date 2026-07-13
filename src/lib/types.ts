// 数据模型定义（与 Rust 端 JSON 结构保持一致）

export interface Tag {
  id: string;
  name: string;
  color: string; // 十六进制颜色，如 #FFC107
}

export interface TodoList {
  id: string;
  name: string;
  filterTags: string[]; // 只显示带这些标签的待办；为空表示显示全部
  showCompleted24h: boolean; // 是否显示在 24 小时内完成的待办
}

export interface Todo {
  id: string;
  listId: string;
  title: string;
  note: string;
  done: boolean;
  createdAt: string; // ISO 时间
  completedAt: string | null; // 完成时间 ISO，未完成则为 null
  pinned: boolean; // 是否置顶
  order: number; // 排序权重，越小越靠前
  tags: string[]; // 关联标签 id
  targetDate: string | null; // 日期倒数目标日（ISO date，如 2026-12-25），为空表示非倒数事项
  reminder: string | null; // 提醒时间 ISO，为空表示无提醒
}

export interface AppData {
  version: number;
  lists: TodoList[];
  tags: Tag[];
  todos: Todo[];
}
