let socket = null;

export function connectDeepgram(onTranscript) {
    socket = new WebSocket(
        "wss://api.deepgram.com/v1/listen?language=en&encoding=linear16&sample_rate=16000",
        ["token", import.meta.env.VITE_DEEPGRAM_API_KEY]
    );

    socket.onopen = () => {
        console.log("Deepgram WebSocket connected");
    };

    socket.onmessage = (message) => {
        const data = JSON.parse(message.data);

        const transcript =
            data.channel?.alternatives?.[0]?.transcript;

        if (!transcript) return;

        onTranscript({
            text: transcript,
            isFinal: data.is_final,
        });
    };

    socket.onerror = (err) => {
        console.error("Deepgram error", err);
    };

    socket.onclose = () => {
        console.log("Deepgram connection closed");
    };
}

export function sendAudioChunk(chunk) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(chunk);
    }
}

export function closeDeepgram() {
    if (socket) socket.close();
}
