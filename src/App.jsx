import { connectDeepgram, sendAudioChunk } from "./services/deepgram";

useEffect(() => {
  connectDeepgram(({ text, isFinal }) => {
    console.log(isFinal ? "FINAL:" : "LIVE:", text);
  });
}, []);

function App() {
  let audioContext;
  let processor;
  let source;

  const startAudioProcessing = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioContext = new AudioContext({ sampleRate: 16000 });

    source = audioContext.createMediaStreamSource(stream);

    processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const pcm16 = float32ToPCM16(inputData);

      sendAudioChunk(pcm16);
    };
  };

  const float32ToPCM16 = (float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);

    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let sample = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return buffer;
  };

  return (
    <div>
      <h1>Audio Processing Test</h1>
      <button onClick={startAudioProcessing}>
        Start Audio Capture
      </button>
    </div>
  );
}

export default App;
