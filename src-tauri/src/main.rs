#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use futures_util::{SinkExt, StreamExt};
use serde::{Serialize};
use serde_json::Value;
use tokio::sync::mpsc;
use std::env;

struct DeepgramState {
    audio_tx: mpsc::Sender<Vec<u8>>,
}

#[derive(Serialize, Clone)]
struct TranscriptEvent {
    text: String,
    is_final: bool,
}

#[tauri::command]
async fn start_deepgram(app: tauri::AppHandle) -> Result<(), String> {
    let key = env::var("DEEPGRAM_API_KEY")
        .map_err(|_| "Missing DEEPGRAM_API_KEY")?;

    let url =
        "wss://api.deepgram.com/v1/listen?punctuate=true&interim_results=true";

    // Build authenticated WebSocket request
    let mut request = url.into_client_request().unwrap();
    request.headers_mut().insert(
        "Authorization",
        format!("Token {}", key).parse().unwrap(),
    );

    let (ws, _) = connect_async(request)
        .await
        .map_err(|e| e.to_string())?;

    let (mut write, mut read) = ws.split();

    // Channel for audio chunks
    let (tx, mut rx) = mpsc::channel::<Vec<u8>>(32);

    // Store sender in app state
    app.manage(DeepgramState { audio_tx: tx });

    // ---- AUDIO → DEEPGRAM (writer task) ----
    tauri::async_runtime::spawn(async move {
        while let Some(chunk) = rx.recv().await {
            if write.send(Message::Binary(chunk)).await.is_err() {
                break;
            }
        }
    });

    // ---- DEEPGRAM → REACT (reader task) ----
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(msg) = read.next().await {
            if let Ok(Message::Text(txt)) = msg {
                if let Ok(json) = serde_json::from_str::<Value>(&txt) {
                    if let Some(alt) = json["channel"]["alternatives"].get(0) {
                        let text = alt["transcript"]
                            .as_str()
                            .unwrap_or("")
                            .to_string();

                        let is_final = json["is_final"]
                            .as_bool()
                            .unwrap_or(false);

                        if !text.is_empty() {
                            app_handle
                                .emit(
                                    "deepgram-transcript",
                                    TranscriptEvent { text, is_final },
                                )
                                .ok();
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn send_audio(chunk: Vec<u8>, app: tauri::AppHandle) {
    let _ = app
        .state::<DeepgramState>()
        .audio_tx
        .send(chunk)
        .await;
}

#[tauri::command]
async fn stop_deepgram(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(tx) = app.state::<DeepgramState>().audio_tx.clone().try_send(Vec::new()).ok() {
        // Dropping sender closes the channel
    }
    Ok(())
}

fn main() {
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            start_deepgram,
            send_audio,
            stop_deepgram
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
