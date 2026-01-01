#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, State};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use serde::{Serialize, Deserialize};
use serde_json::Value;
use tokio::sync::mpsc;
use std::env;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;

struct DeepgramState {
    sender: Arc<TokioMutex<Option<mpsc::Sender<Vec<u8>>>>>,
    connection_active: Arc<TokioMutex<bool>>,
}

#[derive(Serialize, Clone)]
struct TranscriptEvent {
    text: String,
    is_final: bool,
}

#[derive(Serialize, Clone)]
struct ConnectionEvent {
    status: String,
    message: String,
}

#[derive(Deserialize)]
struct StartDeepgramParams {
    language: String,
}

#[tauri::command]
async fn start_deepgram(
    app: tauri::AppHandle,
    state: State<'_, DeepgramState>,
    params: StartDeepgramParams,
) -> Result<(), String> {
    let key = env::var("DEEPGRAM_API_KEY").map_err(|_| "Missing DEEPGRAM_API_KEY")?;

    // map language
    let lang_code = match params.language.as_str() {
        "English" => "en",
        "Hindi" => "hi",
        "Spanish" => "es",
        _ => "en",
    };

    let url = format!(
        "wss://api.deepgram.com/v1/listen?punctuate=true&interim_results=true&model=nova-2&language={}",
        lang_code
    );

    // connect to webSocket with custom headers
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    
    let mut request = url.into_client_request()
        .map_err(|e| format!("Failed to build request: {}", e))?;
    
    request.headers_mut().insert(
        "Authorization",
        format!("Token {}", key).parse().unwrap()
    );

    let (ws_stream, _) = connect_async(request)
        .await
        .map_err(|e| {
            let error_msg = if e.to_string().contains("No such host") || 
                              e.to_string().contains("11001") {
                "No internet connection. Please check your network.".to_string()
            } else if e.to_string().contains("connect") {
                "Failed to connect to Deepgram. Check your internet connection.".to_string()
            } else {
                format!("Connection error: {}", e)
            };
            
            let _ = app.emit("connection-status", ConnectionEvent {
                status: "error".to_string(),
                message: error_msg.clone(),
            });
            error_msg
        })?;

    let (mut write, mut read) = ws_stream.split();

    let (tx, mut rx) = mpsc::channel::<Vec<u8>>(64);
    *state.sender.lock().await = Some(tx);
    *state.connection_active.lock().await = true;

    // emit connection
    let _ = app.emit("connection-status", ConnectionEvent {
        status: "connected".to_string(),
        message: "Connected to Deepgram".to_string(),
    });

    // audio sender 
    let connection_active = state.connection_active.clone();
    let app_handle_sender = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(chunk) = rx.recv().await {
            if write.send(Message::Binary(chunk)).await.is_err() {
                let _ = app_handle_sender.emit("connection-status", ConnectionEvent {
                    status: "error".to_string(),
                    message: "Connection lost. Please try again.".to_string(),
                });
                *connection_active.lock().await = false;
                break;
            }
        }
    });

    // transcript receiver
    let app_handle = app.clone();
    let connection_active = state.connection_active.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(message) = read.next().await {
            match message {
                Ok(Message::Text(msg)) => {
                    if let Ok(json) = serde_json::from_str::<Value>(&msg) {
                        let text = json["channel"]["alternatives"][0]["transcript"]
                            .as_str()
                            .unwrap_or("")
                            .to_string();

                        let is_final = json["is_final"].as_bool().unwrap_or(false);

                        if !text.is_empty() {
                            let _ = app_handle.emit(
                                "deepgram-transcript",
                                TranscriptEvent { text, is_final },
                            );
                        }
                    }
                }
                Ok(Message::Close(_)) => {
                    let _ = app_handle.emit("connection-status", ConnectionEvent {
                        status: "disconnected".to_string(),
                        message: "Connection closed".to_string(),
                    });
                    *connection_active.lock().await = false;
                    break;
                }
                Err(e) => {
                    let _ = app_handle.emit("connection-status", ConnectionEvent {
                        status: "error".to_string(),
                        message: format!("Error: {}", e),
                    });
                    *connection_active.lock().await = false;
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn send_audio(state: State<'_, DeepgramState>, chunk: Vec<u8>) -> Result<(), String> {
    let sender = state.sender.lock().await;
    if let Some(tx) = sender.as_ref() {
        tx.send(chunk).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn stop_deepgram(state: State<'_, DeepgramState>) -> Result<(), String> {
    *state.sender.lock().await = None;
    *state.connection_active.lock().await = false;
    Ok(())
}

#[tauri::command]
async fn check_connection(state: State<'_, DeepgramState>) -> Result<bool, String> {
    Ok(*state.connection_active.lock().await)
}

fn main() {
    dotenvy::dotenv().ok();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(DeepgramState {
            sender: Arc::new(TokioMutex::new(None)),
            connection_active: Arc::new(TokioMutex::new(false)),
        })
        .invoke_handler(tauri::generate_handler![
            start_deepgram,
            send_audio,
            stop_deepgram,
            check_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}