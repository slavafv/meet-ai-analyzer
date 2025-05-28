import React, { useRef, useState } from "react";
import { Button, Box, Typography } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import DownloadIcon from "@mui/icons-material/Download";
import lamejs from "lamejs";

export default function AudioRecorder({ onAudioReady }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const mp3EncoderRef = useRef(null);
  const mp3DataRef = useRef([]);

  const startRecording = async () => {
    setError("");
    setAudioUrl("");
    setRecording(true); // Сразу показываем кнопку "Остановить"
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);

      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const mp3Encoder = new lamejs.Mp3Encoder(1, 16000, 64);
      mp3EncoderRef.current = mp3Encoder;
      mp3DataRef.current = [];

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const samples = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          let s = Math.max(-1, Math.min(1, input[i]));
          samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const mp3buf = mp3Encoder.encodeBuffer(samples);
        if (mp3buf.length > 0) mp3DataRef.current.push(mp3buf);
      };

      sourceRef.current.connect(processor);
      processor.connect(audioContextRef.current.destination);
    } catch (e) {
      setError("Ошибка доступа к микрофону: " + e.message);
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (sourceRef.current) sourceRef.current.disconnect();
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    const mp3buf = mp3EncoderRef.current.flush();
    if (mp3buf.length > 0) mp3DataRef.current.push(mp3buf);
    const blob = new Blob(mp3DataRef.current, { type: "audio/mp3" });
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    const file = new File([blob], "recording.mp3", { type: "audio/mp3" });
    onAudioReady(file, url);
    setRecording(false);
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = "recording.mp3";
      a.click();
    }
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
      {audioUrl && (
        <>
          <audio controls src={audioUrl} style={{ width: "100%", marginTop: 16 }} />
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            sx={{ ml: 2, mt: 1 }}
            onClick={downloadAudio}
          >
            Скачать аудио
          </Button>
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
