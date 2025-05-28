import React from "react";
import { LinearProgress, Typography, Box, CircularProgress } from "@mui/material";

export default function ProgressStatus({ status, progress, loading }) {
  return (
    <Box sx={{ mt: 2 }}>
      {loading && <CircularProgress size={24} sx={{ mr: 2 }} />}
      <Typography variant="body2">{status}</Typography>
      {loading && <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />}
    </Box>
  );
}
