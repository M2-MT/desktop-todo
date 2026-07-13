import "./style.css";
import { getCurrentWindow, type ResizeDirection } from "@tauri-apps/api/window";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { register } from "@tauri-apps/plugin-global-shortcut";
import { loadData, saveData } from "./store/db";
import {
  addList,
  addTag,
  addTodo,
  computeCountdown,
  deleteTodo,
  getTodosForList,
  newTodo,
  reorderTodos,
  setPinned,
  toggleDone,
  updateTodo,
} from "./lib/logic";
import type { AppData, Todo } from "./lib/types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const win = () => getCurrentWindow();

let data: AppData = {
  version: 1,
  lists: [{ id: "default", name: "我的待办", filterTags: [], showCompleted24h: true }],
  tags: [],
  todos: [],
};
let currentListId = "default";
let settingsOpen = false;
let detailId: string | null = null;
let hidden = false;
let dragId: string | null = null;

const appEl = document.querySelector<HTMLDivElement>("#app")!;

async function persist() {
  await saveData(data);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function tagName(id: string) {
  return data.tags.find((t) => t.id === id)?.name ?? "";
}
function tagColor(id: string) {
  return data.tags.find((t) => t.id === id)?.color ?? "#999";
}

// ---------------- 渲染 ----------------

function todoRow(t: Todo): string {
  const chips = t.tags
    .map((id) => `<span class="chip">${escapeHtml(tagName(id))}</span>`)
    .join("");
  const cd = t.targetDate ? `<div class="countdown">${computeCountdown(t.targetDate).label}</div>` : "";
  return `
    <div class="todo ${t.done ? "done" : ""} ${t.pinned ? "pinned" : ""}" data-id="${t.id}" draggable="true">
      <span class="handle">⋮⋮</span>
      <span class="check" data-act="check"></span>
      <div class="body">
        <div class="title" data-act="edit">${escapeHtml(t.title)}</div>
        ${chips ? `<div class="chips">${chips}</div>` : ""}
        ${cd}
      </div>
      <div class="actions">
        <button class="icon-btn" data-act="detail" title="详情">🔧</button>
        <button class="icon-btn pin" data-act="pin" title="置顶">${t.pinned ? "📍" : "📌"}</button>
        <button class="icon-btn del" data-act="del" title="删除">🗑</button>
      </div>
    </div>`;
}

function detailDrawer(): string {
  if (!detailId) return "";
  const t = data.todos.find((x) => x.id === detailId);
  if (!t) return "";
  const tagOptions = data.tags
    .map(
      (tag) => `
    <label class="checkbox-row">
      <input type="checkbox" name="detailTag" value="${tag.id}" ${t.tags.includes(tag.id) ? "checked" : ""} />
      <span class="dot" style="background:${tag.color}"></span>
      <span>${escapeHtml(tag.name)}</span>
    </label>`,
    )
    .join("");
  return `
    <div class="drawer-mask" id="detailMask">
      <div class="drawer">
        <div class="row"><strong>待办详情</strong><button data-act="closeDetail">关闭</button></div>
        <h3>标题</h3>
        <input id="detailTitle" type="text" value="${escapeHtml(t.title)}" />
        <h3>类型</h3>
        <select id="detailType">
          <option value="task" ${t.targetDate ? "" : "selected"}>普通待办</option>
          <option value="countdown" ${t.targetDate ? "selected" : ""}>日期倒数</option>
        </select>
        <h3>目标日期（仅日期倒数）</h3>
        <input id="detailTarget" type="date" value="${t.targetDate ?? ""}" />
        <h3>标签</h3>
        ${tagOptions || '<div class="hint">暂无标签，可在设置中添加</div>'}
        <h3>备注</h3>
        <textarea id="detailNote">${escapeHtml(t.note)}</textarea>
        <div class="row" style="margin-top:12px">
          <button class="danger" data-act="deleteDetail">删除</button>
          <button data-act="saveDetail">保存</button>
        </div>
      </div>
    </div>`;
}

function settingsDrawer(): string {
  const tagItems = data.tags
    .map((t) => `<div class="tag-item"><span class="dot" style="background:${t.color}"></span>${escapeHtml(t.name)}</div>`)
    .join("");
  const listItems = data.lists.map((l) => `<div class="list-item">• ${escapeHtml(l.name)}</div>`).join("");
  return `
    <div class="drawer-mask" id="settingsMask">
      <div class="drawer">
        <div class="row"><strong>设置</strong><button data-act="closeDrawer">关闭</button></div>
        <h3>外观</h3>
        <div class="row"><span>窗口透明度</span><input id="opacity" type="range" min="0.2" max="1" step="0.05" value="1" /></div>
        <h3>开机启动</h3>
        <div class="row"><span>开机自动启动</span><input id="autostart" type="checkbox" /></div>
        <h3>标签</h3>
        ${tagItems || '<div class="hint">暂无标签</div>'}
        <div class="row"><input id="tagName" type="text" placeholder="标签名" /><input id="tagColor" type="color" value="#FFC107" style="width:38px;padding:0;border:none;background:none" /></div>
        <button data-act="addTag">添加标签</button>
        <h3>清单</h3>
        ${listItems || '<div class="hint">暂无其他清单</div>'}
        <div class="row"><input id="listName" type="text" placeholder="新清单名" /></div>
        <button data-act="addList">添加清单</button>
        <h3>提示</h3>
        <div class="hint">· 点击列表空白处直接添加待办<br/>· 快捷键 Ctrl+\` 隐藏/显示窗口<br/>· 拖拽左侧 ⋮⋮ 排序，点 📌 置顶<br/>· 点标题可编辑文字，点 🔧 编辑详情</div>
      </div>
    </div>`;
}

function render() {
  const lists = data.lists;
  const todos = getTodosForList(data, currentListId);
  const options = lists
    .map((l) => `<option value="${l.id}" ${l.id === currentListId ? "selected" : ""}>${escapeHtml(l.name)}</option>`)
    .join("");
  const rows = todos.map((t) => todoRow(t)).join("");
  const drawer = settingsOpen ? settingsDrawer() : "";
  const detail = detailId ? detailDrawer() : "";

  appEl.innerHTML = `
    <div class="topbar" id="topbar">
      <select id="listSelect">${options}</select>
      <button class="icon-btn hide-btn" title="隐藏 (Ctrl+\`)">👁</button>
      <button class="icon-btn settings-btn" title="设置">⚙</button>
    </div>
    <div class="list" id="todoList">${rows}</div>
    <div class="resize-grip" id="resizeGrip" title="拖拽调整窗口大小"></div>
    ${drawer}
    ${detail}
  `;
  bind();
}

// ---------------- 事件绑定 ----------------

function bind() {
  const sel = appEl.querySelector<HTMLSelectElement>("#listSelect");
  sel?.addEventListener("change", () => {
    currentListId = sel.value;
    render();
  });

  // 顶部栏拖拽移动窗口（避开 select/按钮）
  const topbar = appEl.querySelector<HTMLElement>("#topbar")!;
  topbar.addEventListener("mousedown", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("select") || t.closest("button") || t.closest(".icon-btn")) return;
    if (!isTauri) return;
    e.preventDefault();
    win().startDragging();
  });

  // 右下角调整窗口大小
  appEl.querySelector("#resizeGrip")?.addEventListener("mousedown", (e) => {
    if (!isTauri) return;
    e.preventDefault();
    win().startResizeDragging("se" as ResizeDirection);
  });

  appEl.querySelector(".hide-btn")?.addEventListener("click", async () => {
    if (isTauri) {
      await win().hide();
      hidden = true;
    }
  });
  appEl.querySelector(".settings-btn")?.addEventListener("click", () => {
    settingsOpen = true;
    detailId = null;
    render();
  });

  // 待办列表：事件委托
  const listEl = appEl.querySelector<HTMLElement>("#todoList")!;
  listEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const actEl = target.closest("[data-act]") as HTMLElement | null;
    const row = target.closest(".todo") as HTMLElement | null;
    const act = actEl?.dataset.act;

    if (act) {
      const id = row?.dataset.id ?? "";
      if (act === "check") {
        data = toggleDone(data, id);
        persist();
        render();
      } else if (act === "edit") {
        editTodo(id);
      } else if (act === "pin") {
        const t = data.todos.find((x) => x.id === id)!;
        data = setPinned(data, id, !t.pinned);
        persist();
        render();
      } else if (act === "del") {
        data = deleteTodo(data, id);
        persist();
        render();
      } else if (act === "detail") {
        detailId = id;
        settingsOpen = false;
        render();
      } else if (act === "closeDrawer") {
        settingsOpen = false;
        render();
      } else if (act === "closeDetail") {
        detailId = null;
        render();
      } else if (act === "saveDetail") {
        saveDetail();
      } else if (act === "deleteDetail") {
        data = deleteTodo(data, detailId!);
        detailId = null;
        persist();
        render();
      } else if (act === "addTag") {
        const n = appEl.querySelector<HTMLInputElement>("#tagName")!.value.trim();
        const c = appEl.querySelector<HTMLInputElement>("#tagColor")!.value;
        if (!n) return;
        data = addTag(data, n, c).data;
        persist();
        render();
      } else if (act === "addList") {
        const n = appEl.querySelector<HTMLInputElement>("#listName")!.value.trim();
        if (!n) return;
        const r = addList(data, n);
        data = r.data;
        currentListId = r.list.id;
        persist();
        render();
      }
      return;
    }

    // 点击列表空白处 → 新建临时输入框
    if (!row && (target === listEl || target.closest(".list") === listEl)) {
      createNewInput(listEl);
    }
  });

  // 拖拽排序
  listEl.addEventListener("dragstart", (e) => {
    const row = (e.target as HTMLElement).closest(".todo") as HTMLElement;
    dragId = row?.dataset.id ?? null;
    row?.classList.add("dragging");
  });
  listEl.addEventListener("dragover", (e) => e.preventDefault());
  listEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const row = (e.target as HTMLElement).closest(".todo") as HTMLElement | null;
    if (!row || !dragId || row.dataset.id === dragId) {
      dragId = null;
      return;
    }
    const todos = getTodosForList(data, currentListId);
    const idx = todos.findIndex((t) => t.id === row.dataset.id);
    if (idx >= 0) {
      data = reorderTodos(data, dragId, idx);
      persist();
    }
    dragId = null;
    render();
  });

  if (settingsOpen) bindSettings();
  if (detailId) bindDetail();
}

function bindSettings() {
  appEl.querySelector("#settingsMask")?.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.classList.contains("drawer-mask") || t.dataset.act === "closeDrawer") {
      settingsOpen = false;
      render();
    }
  });

  appEl.querySelector("#opacity")?.addEventListener("input", (e) => {
    if (isTauri) win().setOpacity(Number((e.target as HTMLInputElement).value));
  });

  const auto = appEl.querySelector<HTMLInputElement>("#autostart");
  if (auto && isTauri) isEnabled().then((on) => (auto.checked = on));
  auto?.addEventListener("change", async () => {
    if (!isTauri) return;
    if (auto.checked) await enable();
    else await disable();
  });
}

function bindDetail() {
  appEl.querySelector("#detailMask")?.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.classList.contains("drawer-mask") || t.dataset.act === "closeDetail") {
      detailId = null;
      render();
    }
  });
}

// ---------------- 新建输入框（点击空白处） ----------------

function createNewInput(listEl: HTMLElement) {
  // 避免重复创建
  if (listEl.querySelector(".new-todo-input")) return;
  const row = document.createElement("div");
  row.className = "todo new";
  row.innerHTML = `
    <span class="handle"></span>
    <span class="check"></span>
    <div class="body">
      <input class="title-input new-todo-input" type="text" placeholder="输入待办，回车添加" />
    </div>
    <div class="actions"></div>
  `;
  listEl.appendChild(row);
  const input = row.querySelector<HTMLInputElement>(".new-todo-input")!;
  input.focus();

  const commit = () => {
    const v = input.value.trim();
    if (v) {
      data = addTodo(data, newTodo(data, currentListId, v));
      persist();
    }
    render();
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      render();
    }
  });
}

// ---------------- 行内编辑标题 ----------------

function editTodo(id: string) {
  const row = appEl.querySelector(`.todo[data-id="${id}"]`) as HTMLElement | null;
  if (!row) return;
  const titleEl = row.querySelector(".title") as HTMLElement;
  const cur = data.todos.find((t) => t.id === id)!.title;
  row.draggable = false;
  const input = document.createElement("input");
  input.className = "title-input";
  input.value = cur;
  titleEl.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => {
    const v = input.value.trim();
    data = updateTodo(data, id, { title: v || cur });
    persist();
    render();
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      render();
    }
  });
}

// ---------------- 保存详情 ----------------

function saveDetail() {
  if (!detailId) return;
  const titleInp = appEl.querySelector<HTMLInputElement>("#detailTitle")!;
  const typeInp = appEl.querySelector<HTMLSelectElement>("#detailType")!;
  const targetInp = appEl.querySelector<HTMLInputElement>("#detailTarget")!;
  const noteInp = appEl.querySelector<HTMLTextAreaElement>("#detailNote")!;
  const checkedTags = appEl.querySelectorAll<HTMLInputElement>("input[name='detailTag']:checked");
  const tags = Array.from(checkedTags).map((c) => c.value);
  const target = typeInp.value === "countdown" ? targetInp.value || null : null;
  data = updateTodo(data, detailId, {
    title: titleInp.value.trim() || data.todos.find((t) => t.id === detailId)!.title,
    tags,
    note: noteInp.value,
    targetDate: target,
  });
  persist();
  detailId = null;
  render();
}

// ---------------- 启动 ----------------

async function toggleVisible() {
  if (!isTauri) return;
  if (hidden) {
    await win().show();
    await win().setFocus();
    hidden = false;
  } else {
    await win().hide();
    hidden = true;
  }
}

async function init() {
  data = await loadData();
  if (!data.lists.find((l) => l.id === currentListId)) {
    currentListId = data.lists[0]?.id ?? "default";
  }
  render();
  if (isTauri) {
    try {
      await register("CommandOrControl+`", () => toggleVisible());
    } catch {
      /* 已注册则忽略 */
    }
  }
}

init();
