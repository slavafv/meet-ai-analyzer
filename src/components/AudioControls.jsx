import React, { useState, useEffect } from "react";
import { Grid, Button, Box, keyframes, CircularProgress } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
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
  onRecordClick, 
  onUploadClick,
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
              color: '#fff', 
              mr: 1, 
              animation: `${pulse} 1.5s infinite ease-in-out`,
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
          justifyContent: 'center'
        }}
      >
        <Box 
          sx={{ 
            flex: isRecording || isPreparing ? { xs: 1, sm: '0 0 auto' } : '0 0 auto',
            width: isRecording || isPreparing ? { xs: '100%', sm: 'auto' } : { xs: '100%', sm: 'auto' },
            minWidth: { sm: '220px' },
            margin: (isRecording || isPreparing) ? '0 auto' : 'initial'
          }}
        >
          <Button 
            fullWidth
            variant={isRecording || isPreparing ? "contained" : "outlined"}
            size="large"
            startIcon={isRecording || isPreparing ? null : <MicIcon />}
            color={isRecording ? "error" : isPreparing ? "warning" : "primary"}
            onClick={onRecordClick}
            sx={{ 
              p: 2, 
              borderRadius: 1,
              textTransform: 'none',
              fontSize: '1rem',
              color: isRecording || isPreparing ? '#fff' : 'text.primary',
              borderColor: isRecording ? '#f44336' : isPreparing ? '#ed6c02' : 'divider',
              backgroundColor: isRecording ? '#f44336' : isPreparing ? '#ed6c02' : 'transparent',
              '&:hover': {
                backgroundColor: isRecording ? '#d32f2f' : isPreparing ? '#e65100' : 'rgba(99, 102, 241, 0.04)',
                borderColor: isRecording ? '#d32f2f' : isPreparing ? '#e65100' : 'primary.main',
              }
            }}
          >
            {getButtonContent()}
          </Button>
        </Box>
        
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