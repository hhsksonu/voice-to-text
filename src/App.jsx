import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import "./app.css";

function App() {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const isRecordingRef = useRef(false);
  const timerRef = useRef(null);

  const [interimText, setInterimText] = useState("");
  const [liveText, setLiveText] = useState("");
  const [editableText, setEditableText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState("idle");
  const [language, setLanguage] = useState("English");
  const [darkMode, setDarkMode] = useState(true);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");

  const languages = ["English", "Hindi", "Spanish"];

  // apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [darkMode]);

  // Timer 
  useEffect(() => {
    if (status === "recording") {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // listen to transcripts
  useEffect(() => {
    let unlistenTranscript;
    let unlistenConnection;
    let previousFinalTexts = new Set();

    (async () => {
      unlistenTranscript = await listen("deepgram-transcript", (event) => {
        const { text, is_final } = event.payload;
        if (!text || !text.trim()) return;

        if (isRecordingRef.current) {
          if (is_final) {
            const trimmedText = text.trim();

            if (!previousFinalTexts.has(trimmedText)) {
              setLiveText((prev) => {
                const currentText = prev.trim();
                if (!currentText.endsWith(trimmedText)) {
                  previousFinalTexts.add(trimmedText);
                  return prev + trimmedText + " ";
                }
                return prev;
              });
            }
            setInterimText("");
          } else {
            setInterimText(text);
          }
        }
      });

      unlistenConnection = await listen("connection-status", (event) => {
        const { status: connStatus, message } = event.payload;
        setConnectionStatus(message);

        if (connStatus === "error") {
          setError(message);
          setStatus("error");
        }
      });
    })();

    return () => {
      if (unlistenTranscript) unlistenTranscript();
      if (unlistenConnection) unlistenConnection();
    };
  }, []);

  // start recording
  const startRecording = async () => {
    if (isRecordingRef.current) return;

    setError("");
    setConnectionStatus("");

    try {
      setStatus("connecting");
      isRecordingRef.current = true;
      setIsEditing(false);
      setInterimText("");

      await invoke("start_deepgram", { params: { language } });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      setStatus("recording");

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      recorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (!isRecordingRef.current) return;
        const buf = await e.data.arrayBuffer();
        try {
          await invoke("send_audio", {
            chunk: Array.from(new Uint8Array(buf)),
          });
        } catch (err) {
          console.error("Audio send error:", err);
        }
      };

      recorder.start(150);
    } catch (err) {
      console.error(err);
      setError("❌ Microphone access denied. Please allow permissions.");
      setStatus("error");
      isRecordingRef.current = false;
    }
  };

  // stop recording
  const stopRecording = async () => {
    if (!isRecordingRef.current) return;

    isRecordingRef.current = false;
    setStatus("editing");

    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    recorderRef.current = null;
    streamRef.current = null;

    await invoke("stop_deepgram");

    // Move current text to editable text
    setEditableText(liveText + interimText);
    setIsEditing(true);
  };

  const finalizeText = () => {
    if (!editableText.trim()) {
      setError("ℹ️ No speech detected. Try speaking louder.");
      return;
    }

    const fullText = editableText.trim();
    setFinalText((prev) => (prev ? prev + "\n\n" + fullText : fullText));
    setLiveText("");
    setInterimText("");
    setEditableText("");
    setIsEditing(false);
    setStatus("idle");
    setTimer(0);
    setError("");
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(finalText);
      setConnectionStatus("✅ Copied to clipboard!");
      setTimeout(() => setConnectionStatus(""), 2000);
    } catch (err) {
      setError("Failed to copy to clipboard");
    }
  };

  // download as text
  const downloadText = async () => {
    try {
      const fileName = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;

      const filePath = await save({
        defaultPath: fileName,
        filters: [
          {
            name: "Text File",
            extensions: ["txt"],
          },
        ],
        title: "Save Transcript As",
      });

      if (filePath) {
        await writeTextFile(filePath, finalText);

        const savedPath = filePath.replace(/\\/g, '/');
        setConnectionStatus(`✅ File saved to: ${savedPath}`);
        setTimeout(() => setConnectionStatus(""), 5000);
      } else {
        setConnectionStatus("❌ Save cancelled");
        setTimeout(() => setConnectionStatus(""), 2000);
      }
    } catch (err) {
      console.error("Download error:", err);

      try {
        const blob = new Blob([finalText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setConnectionStatus("✅ File downloaded to your Downloads folder!");
        setTimeout(() => setConnectionStatus(""), 3000);
      } catch (fallbackErr) {
        setError("Failed to save file: " + err.message);
      }
    }
  };

  const clearAll = () => {
    setFinalText("");
    setLiveText("");
    setInterimText("");
    setEditableText("");
    setTimer(0);
    setStatus("idle");
    setError("");
    setConnectionStatus("");
  };

  const getStatusText = () => {
    switch (status) {
      case "idle":
        return "⚪ Idle";
      case "connecting":
        return "🟡 Connecting...";
      case "recording":
        return "🟢 Recording";
      case "editing":
        return "✏️ Editing";
      case "error":
        return "❌ Error";
      default:
        return "⚪ Idle";
    }
  };

  const getConnectionText = () => {
    if (!connectionStatus) return "⚪ Not Connected";
    return connectionStatus;
  };

  return (
    <div className="app-container">
      <div className="header">
        <div style={{ width: "60px" }}></div>
        <div className="header-content">
          <h1 className="app-title">Speech to Text</h1>
          <p className="app-subtitle">
            Real-time speech-to-text powered by Deepgram
          </p>
        </div>
        <button
          className="theme-toggle"
          onClick={() => setDarkMode(!darkMode)}
          aria-label="Toggle theme"
        >
          {darkMode ? "☀️" : "🌙"}
        </button>
      </div>

      <div className="main-content">
        <div className="row">
          <div className="row-item">
            <label className="label">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={status === "recording"}
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div className="row-item">
            <label className="label">Status</label>
            <div
              className={`status-display ${status === "recording"
                  ? "status-recording"
                  : status === "error"
                    ? "status-error"
                    : status === "connecting"
                      ? "status-connecting"
                      : "status-idle"
                }`}
            >
              {getStatusText()}
            </div>
          </div>
        </div>

        <div className="row">
          <div className="row-item">
            <button
              className={`btn btn-primary ${status === "recording" ? "recording" : ""
                }`}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              disabled={status === "connecting" || status === "error"}
            >
              {status === "connecting"
                ? "🔄 Connecting..."
                : status === "recording"
                  ? "🎙 Recording... (Release to stop)"
                  : "🎤 Hold to Speak"}
            </button>
          </div>

          <div className="row-item">
            <label className="label">Connection</label>
            <div className="status-display">{getConnectionText()}</div>
          </div>
        </div>

        {/* error/Status */}
        {error && <div className="message message-error">{error}</div>}
        {connectionStatus && !error && (
          <div className="message message-success">{connectionStatus}</div>
        )}

        {/* live transcript */}
        <div className="transcript-section">
          <div className="transcript-header">
            <span className="transcript-label">🟡 Live Transcript</span>
            <div
              className={`transcript-timer ${status === "recording" ? "active" : ""
                }`}
            >
              ⏱ {formatTime(timer)}
            </div>
            {isEditing && (
              <button className="btn btn-primary" onClick={finalizeText}>
                ✓ Done
              </button>
            )}
          </div>

          {isEditing ? (
            <textarea
              className="transcript-box"
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              placeholder="Your transcription will appear here..."
            />
          ) : (
            <div
              className={`transcript-display ${!liveText && !interimText ? "empty" : ""
                }`}
            >
              {liveText || interimText ? (
                <>
                  <span>{liveText}</span>
                  <span className="interim-text">{interimText}</span>
                </>
              ) : (
                "Start speaking to see live transcription..."
              )}
            </div>
          )}
        </div>

        {/* final transcript  */}
        <div className="transcript-section">
          <div className="transcript-header">
            <span className="transcript-label">🟢 Final Transcript</span>
            {finalText && (
              <div className="transcript-actions">
                <button
                  className="btn btn-secondary"
                  onClick={copyToClipboard}
                >
                  📋 Copy
                </button>
                <button className="btn btn-secondary" onClick={downloadText}>
                  💾 Download
                </button>
                <button className="btn btn-danger" onClick={clearAll}>
                  🗑 Clear
                </button>
              </div>
            )}
          </div>

          <div className={`transcript-display ${!finalText ? "empty" : ""}`}>
            {finalText || "Finalized transcripts will appear here..."}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;