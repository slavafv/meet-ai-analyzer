import React from "react";
import { Box, Typography, TextField, Button, Stack } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";

function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export default function TranscriptSummaryResult({ transcript, summary, getTimestampedName }) {
  return (
    <Box bgcolor="white" p={2} borderRadius={1} boxShadow={1}>
      <Typography variant="h6" sx={{ mt: 2 }}>Транскрипт</Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField value={transcript} multiline fullWidth minRows={4} />
        <Button onClick={() => navigator.clipboard.writeText(transcript)}><ContentCopyIcon /></Button>
        <Button onClick={() => downloadText(transcript, getTimestampedName ? getTimestampedName("transcript", "txt") : "transcript.txt")}><DownloadIcon /></Button>
      </Stack>
      <Typography variant="h6" sx={{ mt: 2 }}>Саммари</Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField value={summary} multiline fullWidth minRows={4} />
        <Button onClick={() => navigator.clipboard.writeText(summary)}><ContentCopyIcon /></Button>
        <Button onClick={() => downloadText(summary, getTimestampedName ? getTimestampedName("summary", "txt") : "summary.txt")}><DownloadIcon /></Button>
      </Stack>
    </Box>
  );
}
