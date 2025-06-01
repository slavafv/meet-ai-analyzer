import React, { useRef, useState, useEffect } from "react";
import { Box, Typography, IconButton, useTheme as useMuiTheme, Tooltip } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import DownloadIcon from "@mui/icons-material/Download";
import FileIcon from "@mui/icons-material/InsertDriveFile";
import { useTranslation } from "react-i18next";

function formatTime(sec) {
  if (isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CustomAudioPlayer({ audioUrl, fileName, onDownload, canDownload = true }) {
  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const theme = useMuiTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const { t } = useTranslation();

  // Сбрасываем состояние при изменении URL аудио
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [audioUrl]);

  // Обработчик воспроизведения/паузы
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(error => {
        console.error("Error playing audio:", error);
      });
    }
  };

  // Обработчик перемотки назад на 10 секунд
  const handleSkipBackward = () => {
    if (audioRef.current) {
      const newTime = Math.max(0, audioRef.current.currentTime - 10);
      audioRef.current.currentTime = newTime;
      if (!isDragging) {
        setCurrent(newTime);
        updateProgressBar(newTime);
      }
    }
  };

  // Обработчик перемотки вперед на 10 секунд
  const handleSkipForward = () => {
    if (audioRef.current) {
      const newTime = Math.min(duration, audioRef.current.currentTime + 10);
      audioRef.current.currentTime = newTime;
      if (!isDragging) {
        setCurrent(newTime);
        updateProgressBar(newTime);
      }
    }
  };

  // Обновление прогресс-бара
  const updateProgressBar = (currentTime) => {
    if (progressBarRef.current && !isNaN(duration) && duration > 0) {
      const percentage = (currentTime / duration) * 100;
      progressBarRef.current.style.background = `linear-gradient(to right, ${theme.palette.primary.main} 0%, ${theme.palette.primary.main} ${percentage}%, ${isDarkMode ? '#4b5563' : '#e0e0fa'} ${percentage}%, ${isDarkMode ? '#4b5563' : '#e0e0fa'} 100%)`;
      progressBarRef.current.value = currentTime;
    }
  };

  // Обработчик начала перетаскивания ползунка
  const handleSeekStart = () => {
    setIsDragging(true);
  };

  // Обработчик перетаскивания ползунка
  const handleSeek = (e) => {
    const seekPosition = parseFloat(e.target.value);
    setCurrent(seekPosition);
    updateProgressBar(seekPosition);
  };

  // Обработчик окончания перетаскивания ползунка
  const handleSeekEnd = () => {
    if (audioRef.current && isDragging) {
      audioRef.current.currentTime = current;
      setIsDragging(false);
    }
  };

  // Обработчик обновления времени воспроизведения
  const handleTimeUpdate = (e) => {
    if (!isDragging) {
      const currentTime = e.target.currentTime;
      setCurrent(currentTime);
      updateProgressBar(currentTime);
    }
  };

  // Кнопка скачивания
  const downloadButton = (
    <IconButton 
      onClick={onDownload} 
      size="small"
      disabled={!canDownload}
      sx={{ 
        color: !canDownload 
          ? theme.palette.action.disabled 
          : (isDarkMode ? '#ffffff' : theme.palette.primary.main)
      }}
    >
      <DownloadIcon fontSize="small" />
    </IconButton>
  );

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <FileIcon sx={{ color: theme.palette.primary.main, mr: 1 }} />
          <Typography>{fileName}</Typography>
        </Box>
        {canDownload ? (
          downloadButton
        ) : (
          <Tooltip title={t('player.downloadDisabled')} arrow placement="top">
            <span>{downloadButton}</span>
          </Tooltip>
        )}
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
        <Typography sx={{ minWidth: 40 }}>{formatTime(current)}</Typography>
        <Box sx={{ 
          flex: 1, 
          mx: 2, 
          height: 6, 
          position: 'relative',
        }}>
          <input
            ref={progressBarRef}
            type="range"
            min="0"
            max={duration || 1}
            value={current}
            step="0.01"
            onChange={handleSeek}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            style={{
              width: '100%',
              height: '6px',
              appearance: 'none',
              borderRadius: '3px',
              background: `linear-gradient(to right, ${theme.palette.primary.main} 0%, ${theme.palette.primary.main} ${(current / (duration || 1)) * 100}%, ${isDarkMode ? '#4b5563' : '#e0e0fa'} ${(current / (duration || 1)) * 100}%, ${isDarkMode ? '#4b5563' : '#e0e0fa'} 100%)`,
              cursor: 'pointer',
              outline: 'none',
            }}
          />
        </Box>
        <Typography sx={{ minWidth: 40 }}>{formatTime(duration)}</Typography>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <IconButton 
          onClick={handleSkipBackward}
          sx={{ 
            color: isDarkMode ? '#ffffff' : theme.palette.primary.main
          }}
        >
          <Replay10Icon />
        </IconButton>
        <IconButton 
          sx={{ 
            mx: 2, 
            bgcolor: theme.palette.primary.main, 
            color: 'white', 
            '&:hover': { 
              bgcolor: isDarkMode ? '#6d76f7' : '#4f46e5' 
            } 
          }}
          onClick={handlePlayPause}
        >
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <IconButton 
          onClick={handleSkipForward}
          sx={{ 
            color: isDarkMode ? '#ffffff' : theme.palette.primary.main
          }}
        >
          <Forward10Icon />
        </IconButton>
      </Box>
      
      <audio 
        ref={audioRef}
        src={audioUrl} 
        style={{ display: 'none' }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => {
          setDuration(e.target.duration);
          // Инициализация прогресс-бара
          updateProgressBar(0);
        }}
      />
    </>
  );
} 