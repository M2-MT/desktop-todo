// 纯逻辑层：不依赖 Tauri / DOM，便于单元测试与后续替换存储。
import type { AppData, Tag, Todo, TodoList } from "./types";

/** 生成唯一 id（浏览器与 Node 18+ 均支持） */
export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 默认初始数据：一个「我的待办」清单 */
export function defaultData(): AppData {
  return {
    version: 1,
    lists: [{ id: "default", name: "我的待办", filterTags: [], showCompleted24h: true }],
    tags: [],
    todos: [],
  };
}

/** 数据兜底：确保字段存在，兼容旧版本/损坏文件 */
export function migrate(data: Partial<AppData> | null): AppData {
  const base = defaultData();
  if (!data) return base;
  return {
    version: data.version ?? 1,
    lists: Array.isArray(data.lists) && data.lists.length ? data.lists : base.lists,
    tags: Array.isArray(data.tags) ? data.tags : [],
    todos: Array.isArray(data.todos) ? data.todos : [],
  };
}

/** 新建一条待办，自动计算 order（当前清单最大 order + 1） */
export function newTodo(
  data: AppData,
  listId: string,
  title: string,
  extra: Partial<Todo> = {},
): Todo {
  const siblings = data.todos.filter((t) => t.listId === listId && !t.pinned);
  const maxOrder = siblings.reduce((m, t) => Math.max(m, t.order), 0);
  return {
    id: createId(),
    listId,
    title: title.trim(),
    note: "",
    done: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    pinned: false,
    order: maxOrder + 1,
    tags: [],
    targetDate: null,
    reminder: null,
    ...extra,
  };
}

export function addTodo(data: AppData, todo: Todo): AppData {
  return { ...data, todos: [...data.todos, todo] };
}

export function updateTodo(data: AppData, id: string, patch: Partial<Todo>): AppData {
  return {
    ...data,
    todos: data.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  };
}

/** 切换完成状态，并记录/清除完成时间 */
export function toggleDone(data: AppData, id: string): AppData {
  return {
    ...data,
    todos: data.todos.map((t) => {
      if (t.id !== id) return t;
      const done = !t.done;
      return { ...t, done, completedAt: done ? new Date().toISOString() : null };
    }),
  };
}

export function deleteTodo(data: AppData, id: string): AppData {
  return { ...data, todos: data.todos.filter((t) => t.id !== id) };
}

export function setPinned(data: AppData, id: string, pinned: boolean): AppData {
  return updateTodo(data, id, { pinned });
}

/**
 * 拖拽排序：把指定待办移动到同清单内的新位置（基于未置顶项的相对顺序）。
 * 置顶项不参与排序，始终排在最前。
 */
export function reorderTodos(data: AppData, id: string, newIndex: number): AppData {
  const target = data.todos.find((t) => t.id === id);
  if (!target) return data;
  const listId = target.listId;

  // 该清单内、未置顶的待办，按当前 order 排序
  const others = data.todos
    .filter((t) => t.listId === listId && !t.pinned && t.id !== id)
    .sort((a, b) => a.order - b.order);

  const moved = { ...target, pinned: false };
  const clamped = Math.max(0, Math.min(newIndex, others.length));
  others.splice(clamped, 0, moved);

  const orderMap = new Map<string, number>();
  others.forEach((t, i) => orderMap.set(t.id, i + 1));

  return {
    ...data,
    todos: data.todos.map((t) => {
      if (t.id === id) return { ...moved, order: (orderMap.get(id) ?? 1) };
      if (orderMap.has(t.id)) return { ...t, order: orderMap.get(t.id)! };
      return t;
    }),
  };
}

/** 按标签过滤待办 */
export function filterByTags(todos: Todo[], tags: string[]): Todo[] {
  if (!tags.length) return todos;
  return todos.filter((t) => t.tags.some((tag) => tags.includes(tag)));
}

/**
 * 取某清单下应显示的待办：
 * 1. 先按清单 filterTags 过滤（空=全部）
 * 2. 排序：置顶项最前，其余按 order 升序；未完成优先于已完成
 */
export function getTodosForList(data: AppData, listId: string): Todo[] {
  const list = data.lists.find((l) => l.id === listId);
  if (!list) return [];
  let items = data.todos.filter((t) => t.listId === listId);
  items = filterByTags(items, list.filterTags);

  const now = Date.now();
  const within24h = (t: Todo) =>
    t.completedAt != null && now - new Date(t.completedAt).getTime() <= 24 * 3600 * 1000;

  // 不显示「已完成且不在 24 小时内」的（除非清单允许显示 24h 内完成的）
  items = items.filter((t) => {
    if (!t.done) return true;
    return list.showCompleted24h && within24h(t);
  });

  return items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.order - b.order;
  });
}

export interface CountdownResult {
  days: number; // 距目标日的整天数（未来为正，过去为负）
  isPast: boolean;
  label: string; // 中文文案
}

/** 计算日期倒数。targetDate 为 ISO date（如 2026-12-25） */
export function computeCountdown(targetDate: string, from: Date = new Date()): CountdownResult {
  const target = new Date(targetDate + "T00:00:00");
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const msPerDay = 24 * 3600 * 1000;
  const days = Math.round((target.getTime() - today.getTime()) / msPerDay);
  const isPast = days < 0;
  const label = isPast ? `已经 ${-days} 天` : `还有 ${days} 天`;
  return { days, isPast, label };
}

// ---------- 标签 / 清单辅助 ----------

export function addTag(data: AppData, name: string, color: string): { data: AppData; tag: Tag } {
  const tag: Tag = { id: createId(), name, color };
  return { data: { ...data, tags: [...data.tags, tag] }, tag };
}

export function addList(data: AppData, name: string, filterTags: string[] = []): { data: AppData; list: TodoList } {
  const list: TodoList = { id: createId(), name, filterTags, showCompleted24h: true };
  return { ...{ data: { ...data, lists: [...data.lists, list] } }, list };
}
