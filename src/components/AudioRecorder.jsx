import React, { useRef, useState } from "react";
import { Button, Box } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import DownloadIcon from "@mui/icons-material/Download";

export default function AudioRecorder({ onAudioReady }) {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const chunks = useRef([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunks.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      const file = new File([blob], "recording.webm", { type: "audio/webm" });
      setAudioFile(file);
      onAudioReady(file, url);
      chunks.current = [];
    };
    recorder.start();
    setMediaRecorder(recorder);
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.stop();
    setRecording(false);
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = "recording.webm";
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
        <Button variant="contained" color="error" startIcon={<StopIcon />} onClick={stopRecording}>
          Остановить запись
        </Button>
      )}
      {audioUrl && (
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          sx={{ ml: 2, mt: 1 }}
          onClick={downloadAudio}
        >
          Скачать аудио
        </Button>
      )}
    </Box>
  );
}
