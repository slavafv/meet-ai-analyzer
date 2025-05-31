import React from "react";
import { LinearProgress, Typography, Box, CircularProgress } from "@mui/material";

export default function ProgressStatus({ status, progress, loading }) {
  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {loading && <CircularProgress size={20} sx={{ mr: 2, color: '#6366f1' }} />}
        <Typography variant="body2" sx={{ color: '#666' }}>{status}</Typography>
      </Box>
      {loading && (
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ 
            mt: 1, 
            height: 6, 
            borderRadius: 3,
            bgcolor: '#e0e0fa',
            '.MuiLinearProgress-bar': {
              bgcolor: '#6366f1',
              borderRadius: 3
            }
          }} 
        />
      )}
    </Box>
  );
}
