import React, { useState } from "react";
import { Box, Typography, IconButton, Grid, Paper, Snackbar, Alert } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import { useTranslation } from "react-i18next";

function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TranscriptSummaryResult({ transcript, summary, recordTimestamp }) {
  const { t } = useTranslation();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarKey, setSnackbarKey] = useState(0);
  
  const getTimestampedName = (suffix, ext) => {
    const now = recordTimestamp ? new Date(recordTimestamp) : new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    return `${yyyy}-${mm}-${dd}-${hh}-${min}-${suffix}.${ext}`;
  };

  const showCopyNotification = (message) => {
    setSnackbarKey(prev => prev + 1);
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  const handleCopyTranscript = () => {
    navigator.clipboard.writeText(transcript);
    showCopyNotification(t('copy.transcript'));
  };

  const handleDownloadTranscript = () => {
    downloadText(transcript, getTimestampedName("transcript", "txt"));
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summary);
    showCopyNotification(t('copy.summary'));
  };

  const handleDownloadSummary = () => {
    downloadText(summary, getTimestampedName("summary", "txt"));
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  return (
    <>
      <Grid container spacing={3} sx={{ mb: 4 }} flexDirection={'column'}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ 
            p: 3, 
            borderRadius: 2, 
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)', 
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {t('transcription.title')}
              </Typography>
              <Box>
                <IconButton onClick={handleCopyTranscript} size="small" sx={{ mr: 1 }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
                <IconButton onClick={handleDownloadTranscript} size="small">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ 
              p: 2, 
              bgcolor: 'action.hover', 
              borderRadius: 1, 
              minHeight: '200px',
              overflow: 'auto',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              flex: 1,
              width: '100%'
            }}>
              {transcript || '\u00A0'}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ 
            p: 3, 
            borderRadius: 2, 
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)', 
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {t('transcription.summary')}
              </Typography>
              <Box>
                <IconButton onClick={handleCopySummary} size="small" sx={{ mr: 1 }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
                <IconButton onClick={handleDownloadSummary} size="small">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ 
              p: 2, 
              bgcolor: 'action.hover', 
              borderRadius: 1,
              minHeight: '200px',
              overflow: 'auto',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              flex: 1,
              width: '100%'
            }}>
              {summary || '\u00A0'}
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      <Snackbar
        key={snackbarKey}
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity="success" 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
