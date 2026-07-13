import { describe, it, expect } from "vitest";
import {
  addList,
  addTag,
  addTodo,
  computeCountdown,
  createId,
  defaultData,
  deleteTodo,
  filterByTags,
  getTodosForList,
  migrate,
  newTodo,
  reorderTodos,
  toggleDone,
  updateTodo,
} from "./logic";
import type { AppData } from "./types";

function seed(): AppData {
  let data = defaultData();
  data = addTag(data, "工作", "#FF0000").data;
  const tag = data.tags[0].id;
  const t1 = newTodo(data, "default", "买菜", { tags: [tag] });
  data = addTodo(data, t1);
  const t2 = newTodo(data, "default", "写报告");
  data = addTodo(data, t2);
  return data;
}

describe("数据初始化", () => {
  it("defaultData 含默认清单且无待办", () => {
    const d = defaultData();
    expect(d.lists).toHaveLength(1);
    expect(d.lists[0].id).toBe("default");
    expect(d.todos).toHaveLength(0);
  });

  it("migrate 对 null/损坏数据兜底", () => {
    expect(migrate(null).lists).toHaveLength(1);
    expect(migrate({} as any).todos).toEqual([]);
  });

  it("createId 生成非空唯一值", () => {
    expect(createId()).not.toBe(createId());
  });
});

describe("待办增删改", () => {
  it("newTodo 自动递增 order", () => {
    const d = seed();
    const orders = d.todos.map((t) => t.order);
    expect(orders).toEqual([1, 2]);
  });

  it("addTodo 增加待办数量", () => {
    const d = seed();
    const t = newTodo(d, "default", "跑步");
    expect(addTodo(d, t).todos).toHaveLength(3);
  });

  it("toggleDone 切换完成状态并记录完成时间", () => {
    let d = seed();
    d = toggleDone(d, d.todos[0].id);
    expect(d.todos[0].done).toBe(true);
    expect(d.todos[0].completedAt).not.toBeNull();
    d = toggleDone(d, d.todos[0].id);
    expect(d.todos[0].done).toBe(false);
    expect(d.todos[0].completedAt).toBeNull();
  });

  it("updateTodo 合并补丁", () => {
    let d = seed();
    d = updateTodo(d, d.todos[0].id, { title: "买菜（晚市）", pinned: true });
    expect(d.todos[0].title).toBe("买菜（晚市）");
    expect(d.todos[0].pinned).toBe(true);
  });

  it("deleteTodo 删除指定项", () => {
    let d = seed();
    const id = d.todos[0].id;
    d = deleteTodo(d, id);
    expect(d.todos.find((t) => t.id === id)).toBeUndefined();
    expect(d.todos).toHaveLength(1);
  });
});

describe("排序与过滤", () => {
  it("reorderTodos 把待办移动到新位置", () => {
    let d = seed();
    // 把第 2 条(写报告)移到第 0 位
    const id = d.todos[1].id;
    d = reorderTodos(d, id, 0);
    const first = getTodosForList(d, "default")[0];
    expect(first.id).toBe(id);
  });

  it("getTodosForList 置顶项排最前、未完成优先", () => {
    let d = seed();
    d = updateTodo(d, d.todos[1].id, { pinned: true }); // 写报告置顶
    const list = getTodosForList(d, "default");
    expect(list[0].pinned).toBe(true);
  });

  it("getTodosForList 过滤已完成且超过24h的（默认隐藏）", () => {
    let d = seed();
    const old = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    d = updateTodo(d, d.todos[0].id, { done: true, completedAt: old });
    const list = getTodosForList(d, "default");
    expect(list.find((t) => t.id === d.todos[0].id)).toBeUndefined();
  });

  it("filterByTags 仅返回带指定标签的", () => {
    const d = seed();
    const workTag = d.tags[0].id;
    const filtered = filterByTags(d.todos, [workTag]);
    expect(filtered.every((t) => t.tags.includes(workTag))).toBe(true);
    expect(filtered).toHaveLength(1);
  });
});

describe("日期倒数", () => {
  it("未来日期显示「还有 N 天」", () => {
    const from = new Date("2026-01-01T12:00:00");
    const r = computeCountdown("2026-01-11", from);
    expect(r.days).toBe(10);
    expect(r.isPast).toBe(false);
    expect(r.label).toBe("还有 10 天");
  });

  it("过去日期显示「已经 N 天」", () => {
    const from = new Date("2026-01-11T12:00:00");
    const r = computeCountdown("2026-01-01", from);
    expect(r.days).toBe(-10);
    expect(r.isPast).toBe(true);
    expect(r.label).toBe("已经 10 天");
  });
});

describe("标签与清单", () => {
  it("addTag 追加标签", () => {
    let d = defaultData();
    d = addTag(d, "生活", "#00FF00").data;
    expect(d.tags).toHaveLength(1);
    expect(d.tags[0].name).toBe("生活");
  });

  it("addList 追加清单", () => {
    let d = defaultData();
    d = addList(d, "工作清单", []).data;
    expect(d.lists).toHaveLength(2);
  });
});
