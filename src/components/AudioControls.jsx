import React, { useState, useEffect } from "react";
import { Grid, Button, Box, keyframes, CircularProgress, IconButton } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useTranslation } from "react-i18next";

// Анимация пульсации для индикатора записи
const pulse = keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
  100% {
    opacity: 1;
  }
`;

export default function AudioControls({ 
  isRecording, 
  isPreparing = false,
  isPaused = false,
  isMicMuted = false,
  onRecordClick, 
  onUploadClick,
  onPauseClick,
  onResumeClick,
  onMicMuteClick,
  recordingTime = 0
}) {
  const { t } = useTranslation();
  const [formattedTime, setFormattedTime] = useState("00:00.00");

  useEffect(() => {
    if (isRecording) {
      // Время записи обновляется в родительском компоненте
      const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const milliseconds = Math.floor((ms % 1000) / 10);
    
        const pad = (n, length = 2) => String(n).padStart(length, '0');
        
        let formattedTime = '';
        if (hours > 0) formattedTime += `${pad(hours)}:`;
        formattedTime += `${pad(minutes)}:${pad(seconds)}.${pad(milliseconds)}`;
        
        return formattedTime;
      };

      setFormattedTime(formatTime(recordingTime));
    }
  }, [isRecording, recordingTime]);

  // Определяем, в каком состоянии находится кнопка записи
  const getButtonContent = () => {
    if (isPreparing) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
          <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
          <span>{t('controls.preparingRecord')}</span>
        </Box>
      );
    }
    
    if (isRecording) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
          <FiberManualRecordIcon 
            sx={{ 
              color: isPaused ? '#f44336' : '#fff', 
              mr: 1, 
              animation: isPaused ? 'none' : `${pulse} 1.5s infinite ease-in-out`,
              fontSize: '1rem'
            }} 
          />
          <span>{t('controls.stopRecording', { time: formattedTime })}</span>
        </Box>
      );
    }
    
    return t('controls.record');
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        mb: 3 
      }}
    >
      <Box 
        sx={{ 
          maxWidth: '700px', 
          width: '100%',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {/* Кнопка записи/остановки */}
        <Box 
          sx={{ 
            flex: isRecording || isPreparing ? { xs: 1, sm: '0 0 auto' } : '0 0 auto',
            width: isRecording || isPreparing ? { xs: '100%', sm: 'auto' } : { xs: '100%', sm: 'auto' },
            minWidth: { sm: '220px' },
            margin: (isRecording || isPreparing) ? '0 auto' : 'initial',
            display: 'flex',
            gap: 2,
            alignItems: 'stretch' // Выравнивание по высоте
          }}
        >
          <Button 
            fullWidth
            variant={isRecording && !isPaused ? "contained" : "outlined"}
            size="large"
            startIcon={isRecording || isPreparing ? null : <MicIcon />}
            color={isRecording ? "error" : isPreparing ? "warning" : "primary"}
            onClick={onRecordClick}
            sx={{ 
              p: 2, 
              borderRadius: 1,
              textTransform: 'none',
              fontSize: '1rem',
              color: isRecording ? (isPaused ? '#f44336' : '#fff') : isPreparing ? '#fff' : 'text.primary',
              borderColor: isRecording ? '#f44336' : isPreparing ? '#ed6c02' : 'divider',
              backgroundColor: isRecording && !isPaused ? '#f44336' : isPreparing ? '#ed6c02' : 'transparent',
              '&:hover': {
                backgroundColor: isRecording && !isPaused ? '#d32f2f' : isPreparing ? '#e65100' : 'rgba(99, 102, 241, 0.04)',
                borderColor: isRecording ? '#d32f2f' : isPreparing ? '#e65100' : 'primary.main',
              }
            }}
          >
            {getButtonContent()}
          </Button>
          
          {/* Кнопка паузы рядом с кнопкой остановки записи */}
          {isRecording && !isPreparing && (
            <Button 
              variant={isPaused ? "contained" : "outlined"}
              size="large"
              color={isPaused ? "error" : "primary"}
              onClick={isPaused ? onResumeClick : onPauseClick}
              sx={{ 
                px: 2, 
                borderRadius: 1,
                minWidth: '60px',
                color: isPaused ? '#fff' : 'text.primary',
                borderColor: isPaused ? '#f44336' : 'divider',
                backgroundColor: isPaused ? '#f44336' : 'transparent',
                '&:hover': {
                  backgroundColor: isPaused ? '#d32f2f' : 'rgba(99, 102, 241, 0.04)',
                  borderColor: isPaused ? '#d32f2f' : 'primary.main',
                }
              }}
              title={isPaused ? t('controls.resumeRecording') : t('controls.pauseRecording')}
            >
              {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
            </Button>
          )}
        </Box>
        
        {/* Круглая кнопка микрофона */}
        {isRecording && !isPreparing && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <IconButton 
              size="large"
              onClick={onMicMuteClick}
              sx={{ 
                p: 2,
                border: '1px solid',
                borderColor: isMicMuted ? '#f44336' : 'divider',
                color: isMicMuted ? '#f44336' : 'text.primary',
                '&:hover': {
                  backgroundColor: 'rgba(244, 67, 54, 0.04)',
                  borderColor: isMicMuted ? '#d32f2f' : 'primary.main',
                }
              }}
              title={isMicMuted ? t('controls.unmuteMic') : t('controls.muteMic')}
            >
              {isMicMuted ? <MicOffIcon /> : <MicIcon />}
            </IconButton>
          </Box>
        )}
        
        {!isRecording && !isPreparing && (
          <Box 
            sx={{ 
              flex: '0 0 auto',
              width: { xs: '100%', sm: 'auto' },
              minWidth: { sm: '220px' }
            }}
          >
            <Button 
              fullWidth
              variant="outlined"
              size="large"
              startIcon={<UploadFileIcon />}
              onClick={onUploadClick}
              sx={{ 
                p: 2, 
                borderRadius: 1,
                textTransform: 'none',
                fontSize: '1rem',
                color: 'text.primary',
                borderColor: 'divider',
                '&:hover': {
                  backgroundColor: 'rgba(99, 102, 241, 0.04)',
                  borderColor: 'primary.main',
                }
              }}
            >
              {t('controls.upload')}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
} 