// 存储层：通过 Tauri 命令读写 JSON 文件。
// 逻辑层（../lib/logic）不依赖本文件，便于单独测试。
import { invoke } from "@tauri-apps/api/core";
import type { AppData } from "../lib/types";
import { migrate } from "../lib/logic";

// 判断当前是否在 Tauri 运行时内（还是普通浏览器预览）
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * 读取数据：
 * - Tauri 环境：调用 Rust 命令读写本地 JSON 文件
 * - 浏览器预览：回退到 localStorage，方便 `pnpm dev` 直接看 UI
 */
export async function loadData(): Promise<AppData> {
  if (isTauri) {
    try {
      const raw = await invoke<string>("load_data");
      return migrate(JSON.parse(raw) as Partial<AppData>);
    } catch {
      return migrate(null);
    }
  }
  const raw = localStorage.getItem("desktop-todo");
  return migrate(raw ? (JSON.parse(raw) as Partial<AppData>) : null);
}

/** 持久化数据 */
export async function saveData(next: AppData): Promise<void> {
  if (isTauri) {
    try {
      await invoke("save_data", { data: JSON.stringify(next) });
    } catch (e) {
      // 即便保存失败（如权限未授权），也不阻断界面操作
      console.warn("保存数据失败（可能缺少权限）:", e);
    }
  }
  localStorage.setItem("desktop-todo", JSON.stringify(next));
}

