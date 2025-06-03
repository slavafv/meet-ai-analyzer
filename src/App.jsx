import React, { useState, useRef, useEffect } from "react";
import { Container, Typography, Box, Paper, Dialog, DialogTitle, DialogContent, DialogActions, Button, useTheme } from "@mui/material";
import AudioRecorder from "./components/AudioRecorder";
import FileUploader from "./components/FileUploader";
import ProgressStatus from "./components/ProgressStatus";
import CustomAudioPlayer from "./components/CustomAudioPlayer";
import TranscriptSummaryResult from "./components/TranscriptSummaryResult";
import AudioControls from "./components/AudioControls";
import SummaryOptions from "./components/SummaryOptions";
import TranscribeButton from "./components/TranscribeButton";
import Settings from "./components/Settings";
import { sendAudioForTranscription, sendTextForSummary } from "./api";
import { SUMMARY_KEYS, SUMMARY_PRESETS } from "./constants";
import { useTranslation } from "react-i18next";


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
  const { t } = useTranslation();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioName, setAudioName] = useState("");
  const [lang, setLang] = useState("ru"); // ru | en
  const [summaryType, setSummaryType] = useState(SUMMARY_KEYS.REGULAR);
  const [customPrompt, setCustomPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState({ transcript: "", summary: "" });
  const [loading, setLoading] = useState(false);
  const [recordTimestamp, setRecordTimestamp] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isRecordedAudio, setIsRecordedAudio] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [scrollTarget, setScrollTarget] = useState(null);
  const [shouldScrollToTranscribe, setShouldScrollToTranscribe] = useState(false);
  const audioRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const transcribeButtonRef = useRef(null);

  // Загрузка сохраненных настроек
  useEffect(() => {
    // Язык уже загружается в i18n.js
    
    // Загрузка сохраненного языка транскрипции
    const savedTranscriptionLang = localStorage.getItem('transcriptionLanguage');
    if (savedTranscriptionLang) {
      setLang(savedTranscriptionLang);
    }
    
    // Загрузка сохраненного типа саммари
    const savedSummaryType = localStorage.getItem('summaryType');
    if (savedSummaryType && Object.values(SUMMARY_KEYS).includes(savedSummaryType)) {
      setSummaryType(savedSummaryType);
    }
    
    // Загрузка сохраненного кастомного промпта
    const savedCustomPrompt = localStorage.getItem('customPrompt');
    if (savedCustomPrompt) {
      setCustomPrompt(savedCustomPrompt);
    }
  }, []);

  // Обновление времени записи и проверка состояния подготовки
  useEffect(() => {
    if (isRecording && audioRecorderRef.current) {
      timerRef.current = setInterval(() => {
        setRecordingTime(audioRecorderRef.current.getRecordingTime());
      }, 50);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    // Регулярно проверяем состояние подготовки к записи
    const preparingCheckInterval = setInterval(() => {
      if (audioRecorderRef.current && audioRecorderRef.current.isPreparing) {
        setIsPreparing(audioRecorderRef.current.isPreparing());
      }
      
      // Проверяем, является ли устройство мобильным
      if (audioRecorderRef.current && audioRecorderRef.current.isMobileDevice) {
        setIsMobileDevice(audioRecorderRef.current.isMobileDevice());
      }
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      clearInterval(preparingCheckInterval);
    };
  }, [isRecording]);

  // Сохраняем выбранный язык транскрипции
  useEffect(() => {
    localStorage.setItem('transcriptionLanguage', lang);
  }, [lang]);

  // Сохраняем выбранный тип саммари
  useEffect(() => {
    localStorage.setItem('summaryType', summaryType);
  }, [summaryType]);

  // Сохраняем кастомный промпт
  useEffect(() => {
    localStorage.setItem('customPrompt', customPrompt);
  }, [customPrompt]);

  // Эффект для автоскролла к кнопке транскрибирования
  useEffect(() => {
    if (shouldScrollToTranscribe && !isRecording && !isConverting && audioFile && transcribeButtonRef.current) {
      setTimeout(() => {
        transcribeButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setShouldScrollToTranscribe(false); // Сбрасываем флаг после скролла
      }, 300);
    }
  }, [shouldScrollToTranscribe, isRecording, isConverting, audioFile]);

  // Имя для скачивания аудио
  const getDownloadName = () => getTimestampedName("record", "mp3", recordTimestamp);

  const handleDownloadAudio = () => {
    if (audioUrl && isRecordedAudio) {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = getDownloadName();
      a.click();
    }
  };

  // Сброс всех данных
  const resetData = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioFile(null);
    setAudioUrl("");
    setAudioName("");
    setResult({ transcript: "", summary: "" });
    setIsRecordedAudio(false);
  };

  const startRecording = () => {
    resetData();
    if (audioRecorderRef.current) {
      audioRecorderRef.current.startRecording();
      setIsPreparing(true);
    }
  };

  const handleRecordingChange = (recording, paused, micMuted, converting, progress) => {
    // Если запись была остановлена, устанавливаем флаг для скролла
    if (isRecording && !recording && !converting) {
      setShouldScrollToTranscribe(true);
    }
    
    setIsRecording(recording);
    setIsPaused(paused);
    setIsMicMuted(micMuted);
    setIsConverting(converting);
    setConversionProgress(progress);
  };

  const handleRecordClick = () => {
    if (isRecording || isPreparing) {
      // Stop recording напрямую через ref
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stopRecording();
        setIsPreparing(false);
      }
    } else {
      if (audioFile) {
        // Если уже есть аудио, спрашиваем подтверждение
        setConfirmDialogOpen(true);
      } else {
        // Если аудио нет, просто начинаем запись
        startRecording();
      }
    }
  };

  const handlePauseClick = () => {
    if (audioRecorderRef.current && isRecording && !isPaused) {
      audioRecorderRef.current.pauseRecording();
    }
  };

  const handleResumeClick = () => {
    if (audioRecorderRef.current && isRecording && isPaused) {
      audioRecorderRef.current.resumeRecording();
    }
  };

  const handleUploadClick = () => {
    const uploadInput = document.querySelector('#upload-button input');
    if (uploadInput) uploadInput.click();
  };

  const handleMicMuteClick = () => {
    if (audioRecorderRef.current && isRecording) {
      audioRecorderRef.current.toggleMicMute();
    }
  };

  const handleTranscribe = async () => {
    setLoading(true);
    setStatus(t('transcription.inProgress'));
    setProgress(0);
    setScrollTarget('transcript'); // Скролл к транскрипции после транскрибирования
    try {
      let prompt = SUMMARY_PRESETS[summaryType];

      if (summaryType === SUMMARY_KEYS.CUSTOM) {
        prompt = customPrompt;
      }
   
      const transcript = await sendAudioForTranscription(
        audioFile,
        lang,
        setStatus,
        setProgress
      );
      setStatus(t('transcription.creatingSum'));

      const summary = await sendTextForSummary(transcript, prompt, setStatus);

      setResult({ transcript, summary });
      setStatus(t('transcription.completed'));
    } catch (e) {
      setStatus(t('transcription.error', { message: e.message }));
    }
    setLoading(false);
  };

  const handleSummaryOnly = async () => {
    if (!result.transcript) return;
    
    setLoading(true);
    setStatus(t('transcription.updatingSum'));
    setProgress(100); // Сразу показываем полный прогресс, так как транскрипция уже есть
    setScrollTarget('summary'); // Скролл к саммари после обновления саммари
    
    try {
      let prompt = SUMMARY_PRESETS[summaryType];

      if (summaryType === SUMMARY_KEYS.CUSTOM) {
        prompt = customPrompt;
      }

      const summary = await sendTextForSummary(result.transcript, prompt, setStatus);
      setResult(prev => ({ ...prev, summary }));
      setStatus(t('transcription.sumUpdated'));
    } catch (e) {
      setStatus(t('transcription.error', { message: e.message }));
    }
    
    setLoading(false);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Настройки */}
      <Settings />
      
      <Paper sx={{ p: 4, mb: 3, borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
          {t('app.title')}
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          {t('app.description')}
        </Typography>
        
        {isMobileDevice && (
          <Box sx={{ 
            p: 2, 
            mb: 3, 
            bgcolor: isDarkMode ? 'rgba(246, 176, 0, 0.1)' : '#fff8e1', 
            borderRadius: 2, 
            border: `1px solid ${isDarkMode ? 'rgba(246, 176, 0, 0.2)' : '#ffe57f'}`
          }}>
            <Typography variant="body2" color={isDarkMode ? 'warning.light' : 'warning.dark'}>
              {t('app.mobileNotice')}
            </Typography>
          </Box>
        )}
        
        <AudioControls 
          isRecording={isRecording}
          isPreparing={isPreparing}
          isPaused={isPaused}
          isMicMuted={isMicMuted}
          isMobileDevice={isMobileDevice}
          isConverting={isConverting}
          conversionProgress={conversionProgress}
          onRecordClick={handleRecordClick}
          onPauseClick={handlePauseClick}
          onResumeClick={handleResumeClick}
          onMicMuteClick={handleMicMuteClick}
          onUploadClick={handleUploadClick}
          recordingTime={recordingTime}
        />

        <div style={{ display: 'none' }}>
          <AudioRecorder
            id="record-button"
            ref={audioRecorderRef}
            onRecordingChange={handleRecordingChange}
            onAudioReady={(file, url) => {
              const timestamp = Date.now();
              setAudioFile(file);
              setAudioUrl(url);
              setRecordTimestamp(timestamp);
              setIsRecordedAudio(true); // Mark as recorded audio
              setAudioName(getTimestampedName("record", "mp3", timestamp)); // Use actual filename with timestamp
            }}
          />
        </div>
        
        <div style={{ display: 'none' }}>
          <FileUploader
            id="upload-button"
            onFileSelected={(file, url) => {
              setAudioFile(file);
              setAudioUrl(url);
              setAudioName(file.name);
              setRecordTimestamp(Date.now());
              setIsRecordedAudio(false); // Mark as uploaded audio
              setShouldScrollToTranscribe(true); // Добавляем автоскролл при загрузке файла
            }}
          />
        </div>
      </Paper>

      {audioFile && !isRecording && !isPreparing && (
        <Paper sx={{ p: 4, mb: 3, borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <CustomAudioPlayer 
            audioUrl={audioUrl}
            fileName={audioName}
            onDownload={handleDownloadAudio}
            canDownload={isRecordedAudio}
          />
          
          <SummaryOptions
            lang={lang}
            setLang={setLang}
            summaryType={summaryType}
            setSummaryType={setSummaryType}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
          />

          {loading && (
            <Box sx={{ 
              p: 2, 
              mb: 3, 
              bgcolor: isDarkMode ? 'rgba(99, 102, 241, 0.1)' : '#fff8f8', 
              borderRadius: 2, 
              border: `1px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#f8e0e0'}`
            }}>
              <ProgressStatus status={status} progress={progress} loading={loading} />
            </Box>
          )}

          <Box ref={transcribeButtonRef}>
            <TranscribeButton 
              onClick={handleTranscribe}
              onSummaryOnly={handleSummaryOnly}
              disabled={loading}
              hasTranscript={!!result.transcript}
            />
          </Box>
        </Paper>
      )}

      {result.transcript && !isRecording && !isPreparing && (
        <TranscriptSummaryResult 
          transcript={result.transcript}
          summary={result.summary}
          recordTimestamp={recordTimestamp}
          scrollTarget={scrollTarget}
        />
      )}

      {/* Диалог подтверждения перезаписи */}
      <Dialog 
        open={confirmDialogOpen} 
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>{t('confirm.title')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('confirm.message')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setConfirmDialogOpen(false)} 
            variant="outlined"
          >
            {t('confirm.cancel')}
          </Button>
          <Button 
            onClick={() => {
              setConfirmDialogOpen(false);
              startRecording();
            }} 
            variant="contained"
            color="primary"
            autoFocus
          >
            {t('confirm.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
