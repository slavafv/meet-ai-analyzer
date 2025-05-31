import React from "react";
import { Button, Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

export default function TranscribeButton({ 
  onClick, 
  onSummaryOnly, 
  disabled, 
  hasTranscript,
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  
  if (!hasTranscript) {
    return (
      <Button
        variant="contained"
        fullWidth
        disabled={disabled}
        onClick={onClick}
        sx={{ 
          mt: 4,
          bgcolor: theme.palette.primary.main,
          borderRadius: 1,
          p: 1.5,
          textTransform: 'none',
          fontSize: '1rem',
          '&:hover': {
            bgcolor: theme.palette.mode === 'dark' ? '#6d76f7' : '#4f46e5'
          }
        }}
      >
        {t('buttons.transcribe')}
      </Button>
    );
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      gap: 2, 
      mt: 4 
    }}>
      <Button
        variant="contained"
        disabled={disabled}
        onClick={onClick}
        sx={{ 
          flex: 1,
          bgcolor: theme.palette.primary.main,
          borderRadius: 1,
          p: 1.5,
          textTransform: 'none',
          fontSize: '1rem',
          '&:hover': {
            bgcolor: theme.palette.mode === 'dark' ? '#6d76f7' : '#4f46e5'
          }
        }}
      >
        {t('buttons.redoAll')}
      </Button>
      <Button
        variant="outlined"
        disabled={disabled}
        onClick={onSummaryOnly}
        sx={{ 
          flex: 1,
          borderColor: theme.palette.primary.main,
          color: theme.palette.primary.main,
          borderRadius: 1,
          p: 1.5,
          textTransform: 'none',
          fontSize: '1rem',
          '&:hover': {
            borderColor: theme.palette.mode === 'dark' ? '#6d76f7' : '#4f46e5',
            bgcolor: 'rgba(99, 102, 241, 0.04)'
          }
        }}
      >
        {t('buttons.updateSummary')}
      </Button>
    </Box>
  );
} 