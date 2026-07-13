#![cfg_attr(all(not(debug_assertions), windows), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;

use serde_json::Value;
use tauri::Manager;

/// 读取本地 JSON 数据；文件不存在时返回空对象
#[tauri::command]
fn load_data(app: tauri::AppHandle) -> Result<String, String> {
    let path = data_path(&app)?;
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// 校验并写入本地 JSON 数据
#[tauri::command]
fn save_data(app: tauri::AppHandle, data: String) -> Result<(), String> {
    // 先解析，确保写入的是合法 JSON
    let _: Value = serde_json::from_str(&data).map_err(|e| format!("JSON 解析失败: {e}"))?;
    let path = data_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, data).map_err(|e| e.to_string())
}

/// 数据文件路径：<应用数据目录>/data.json
fn data_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {e}"))?;
    Ok(dir.join("data.json"))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![load_data, save_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
