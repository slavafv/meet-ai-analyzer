import React, { useState } from "react";
import { Container, Typography, Box, Button, Paper } from "@mui/material";
import AudioRecorder from "./components/AudioRecorder";
import FileUploader from "./components/FileUploader";
import SummaryOptions from "./components/SummaryOptions";
import TranscriptSummaryResult from "./components/TranscriptSummaryResult";
import ProgressStatus from "./components/ProgressStatus";
import { sendAudioForTranscription, sendTextForSummary } from "./api";

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
          onAudioReady={(file, url) => { setAudioFile(file); setAudioUrl(url); }}
        />
        <Box my={2} textAlign="center">или</Box>
        <FileUploader
          onFileSelected={(file, url) => { setAudioFile(file); setAudioUrl(url); }}
        />
      </Paper>
      {audioFile && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <audio controls src={audioUrl} style={{ width: "100%" }} />
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
        />
      )}
    </Container>
  );
}
