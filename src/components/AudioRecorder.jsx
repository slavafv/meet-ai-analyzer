import React, { useRef, useState, useEffect } from "react";
import { Button, Box, Typography } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import lamejs from "lamejs";

export default function AudioRecorder({ onAudioReady }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamsRef = useRef({});
  const [webmUrl, setWebmUrl] = useState(null);

  // Очистка objectURL при размонтировании компонента
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (webmUrl) {
        URL.revokeObjectURL(webmUrl);
      }
    };
  }, [audioUrl, webmUrl]);

  const startRecording = async () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }
    setError("");
    setRecording(true);
    try {
      // Всегда режим both: микрофон + вкладка
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tabStream = await navigator.mediaDevices.getDisplayMedia({ audio: true });
      streamsRef.current = { mic: micStream, tab: tabStream };

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const tabSource = audioCtx.createMediaStreamSource(tabStream);

      micSource.connect(dest);
      tabSource.connect(dest);

      const finalStream = dest.stream;

      recordedChunksRef.current = [];
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "";
      }
      if (finalStream.getAudioTracks().length === 0) {
        setError("В объединённом потоке нет аудиотреков!");
        setRecording(false);
        return;
      }
      const mediaRecorder = new MediaRecorder(finalStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const tempWebmUrl = URL.createObjectURL(blob);
        setWebmUrl(tempWebmUrl);
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // Получаем PCM-данные
        const samples = audioBuffer.getChannelData(0); // моно
        const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 64);
        const mp3Data = [];
        const sampleBlockSize = 1152;
        for (let i = 0; i < samples.length; i += sampleBlockSize) {
          const sampleChunk = samples.subarray(i, i + sampleBlockSize);
          // Преобразуем float32 в int16
          const int16 = new Int16Array(sampleChunk.length);
          for (let j = 0; j < sampleChunk.length; j++) {
            int16[j] = Math.max(-32768, Math.min(32767, sampleChunk[j] * 32767));
          }
          const mp3buf = mp3encoder.encodeBuffer(int16);
          if (mp3buf.length > 0) mp3Data.push(mp3buf);
        }
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) mp3Data.push(mp3buf);

        const mp3Blob = new Blob(mp3Data, { type: "audio/mp3" });
        const mp3Url = URL.createObjectURL(mp3Blob);

        setAudioUrl(mp3Url);
        const file = new File([mp3Blob], "recording.mp3", { type: "audio/mp3" });
        onAudioReady(file, mp3Url);
        setRecording(false);

        // Чистим webmUrl
        if (webmUrl) {
          URL.revokeObjectURL(webmUrl);
          setWebmUrl(null);
        }
      };

      mediaRecorder.start();
    } catch (e) {
      setError("Ошибка доступа к аудио: " + e.message);
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    // Остановить все потоки
    Object.values(streamsRef.current).forEach((stream) =>
      stream.getTracks().forEach((track) => track.stop())
    );
  };

  return (
    <Box textAlign="center">
      {!recording ? (
        <Button variant="contained" startIcon={<MicIcon />} onClick={startRecording}>
          Записать аудио
        </Button>
      ) : (
        <>
          <Button variant="contained" color="error" startIcon={<StopIcon />} onClick={stopRecording}>
            Остановить запись
          </Button>
          <Typography color="error" sx={{ mt: 1 }}>
            ● Идёт запись...
          </Typography>
        </>
      )}
      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
