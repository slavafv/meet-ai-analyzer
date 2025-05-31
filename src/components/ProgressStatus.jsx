import React from "react";
import { LinearProgress, Typography, Box, CircularProgress, useTheme } from "@mui/material";

export default function ProgressStatus({ status, progress, loading }) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {loading && <CircularProgress size={20} sx={{ mr: 2, color: theme.palette.primary.main }} />}
        <Typography variant="body2">{status}</Typography>
      </Box>
      {loading && (
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ 
            mt: 1, 
            height: 6, 
            borderRadius: 3,
            bgcolor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#e0e0fa',
            '.MuiLinearProgress-bar': {
              bgcolor: theme.palette.primary.main,
              borderRadius: 3
            }
          }} 
        />
      )}
    </Box>
  );
}
