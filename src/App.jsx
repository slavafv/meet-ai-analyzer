import React, { useState } from "react";
import { Container, Typography, Box, Button, Paper } from "@mui/material";
import AudioRecorder from "./components/AudioRecorder";
import FileUploader from "./components/FileUploader";
import SummaryOptions from "./components/SummaryOptions";
import TranscriptSummaryResult from "./components/TranscriptSummaryResult";
import ProgressStatus from "./components/ProgressStatus";
import { sendAudioForTranscription, sendTextForSummary } from "./api";

// Функция для генерации имени файла по шаблону
function getTimestampedName(suffix, ext, timestamp) {
  const now = timestamp ? new Date(timestamp) : new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${yyyy}-${mm}-${dd}-${hh}-${min}-${suffix}.${ext}`;
}

export default function App() {
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [lang, setLang] = useState("ru");
  const [summaryType, setSummaryType] = useState("structured");
  const [customPrompt, setCustomPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState({ transcript: "", summary: "" });
  const [loading, setLoading] = useState(false);
  const [recordTimestamp, setRecordTimestamp] = useState(null);

  // Имя для скачивания аудио
  const getDownloadName = () => getTimestampedName("record", "mp3", recordTimestamp);

  const handleDownloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = getDownloadName();
      a.click();
    }
  };

  const handleTranscribe = async () => {
    setLoading(true);
    setStatus("Отправление аудио...");
    setProgress(0);
    try {
      // 1. Транскрипция
      const prompt = summaryType === "custom"
        ? customPrompt
        : summaryType === "short"
          ? "Сделай краткое саммари этого текста:"
          : "Этот созвон был регулярным для сотрудника, в котором с ним общаются его ТМ, LM и HR. ...";
      const transcript = await sendAudioForTranscription(
        audioFile,
        lang,
        prompt,
        setStatus,
        setProgress
      );
      setStatus("Ожидание саммари...");
      // 2. Саммари
      const summary = await sendTextForSummary(transcript, prompt, setStatus);
      setResult({ transcript, summary });
      setStatus("Готово!");
    } catch (e) {
      setStatus("Ошибка: " + e.message);
    }
    setLoading(false);
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Транскрибация и саммари митинга
      </Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <AudioRecorder
          onAudioReady={(file, url) => {
            setAudioFile(file);
            setAudioUrl(url);
            setRecordTimestamp(Date.now());
          }}
        />
        <Box my={2} textAlign="center">или</Box>
        <FileUploader
          onFileSelected={(file, url) => {
            setAudioFile(file);
            setAudioUrl(url);
            setRecordTimestamp(Date.now());
          }}
        />
      </Paper>
      {audioFile && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <audio controls src={audioUrl} style={{ width: "100%" }} />
          <Button
            variant="outlined"
            sx={{ mt: 1, mb: 2 }}
            onClick={handleDownloadAudio}
          >
            Скачать аудио
          </Button>
          <SummaryOptions
            lang={lang}
            setLang={setLang}
            summaryType={summaryType}
            setSummaryType={setSummaryType}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
          />
          <Button
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
            onClick={handleTranscribe}
            disabled={loading}
          >
            Транскрибировать и сделать саммари
          </Button>
          <ProgressStatus status={status} progress={progress} loading={loading} />
        </Paper>
      )}
      {result.transcript && (
        <TranscriptSummaryResult
          transcript={result.transcript}
          summary={result.summary}
          getTimestampedName={(suffix, ext) => getTimestampedName(suffix, ext, recordTimestamp)}
        />
      )}
    </Container>
  );
}
