import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

function App() {
  const recorderRef = useRef(null);
  const lastFinalRef = useRef(""); 
  const [live, setLive] = useState("");
  const [finalText, setFinalText] = useState("");

  useEffect(() => {
    let unlisten;

    (async () => {
      unlisten = await listen("deepgram-transcript", (event) => {
        const { text, is_final } = event.payload;
        if (!text?.trim()) return;

        if (is_final) {
          // Append ONLY new text (delta)
          const newPart = text.replace(lastFinalRef.current, "").trim();

          if (newPart) {
            setFinalText((prev) => prev + " " + newPart);
          }

          lastFinalRef.current = text;
          setLive("");
        } else {
          setLive(text);
        }
      });
    })();

    return () => {
      unlisten && unlisten();
    };
  }, []);

  const start = async () => {
    lastFinalRef.current = "";
    setFinalText("");
    setLive("");

    await invoke("start_deepgram");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    recorderRef.current = recorder;

    recorder.ondataavailable = async (e) => {
      const buf = await e.data.arrayBuffer();
      await invoke("send_audio", {
        chunk: Array.from(new Uint8Array(buf)),
      });
    };

    recorder.start(250);
  };

  const stop = async () => {
    recorderRef.current?.stop();
    setLive("");
    await invoke("stop_deepgram"); // backend CloseStream
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Voice-to-Text Desktop App</h2>

      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>

      <h4>Live</h4>
      <p>{live}</p>

      <h4>Final</h4>
      <p>{finalText}</p>
    </div>
  );
}

export default App;
