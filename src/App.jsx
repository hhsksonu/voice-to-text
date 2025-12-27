import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

function App() {
  const recorderRef = useRef(null);
  const [live, setLive] = useState("");
  const [finalText, setFinalText] = useState("");
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    let unlisten;

    (async () => {
      unlisten = await listen("deepgram-transcript", (event) => {
        const { text, is_final } = event.payload;

        if (!text) return;

        if (is_final) {
          setFinalText((prev) => prev + " " + text);
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
    setRecording(true);
    await invoke("start_deepgram");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm",
    });

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
    setRecording(false);
    await invoke("stop_deepgram");
    setLive("");
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Voice-to-Text Desktop App</h2>

      <button onClick={start} disabled={recording}>Start</button>
      <button onClick={stop} disabled={!recording}>Stop</button>

      <h4>Live</h4>
      <p>{live}</p>

      <h4>Final</h4>
      <p>{finalText}</p>
    </div>
  );
}

export default App;
