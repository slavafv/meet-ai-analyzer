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
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const theme = useMuiTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const { t } = useTranslation();

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [audioUrl]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSeek = (e) => {
    const seekPosition = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = seekPosition;
      setCurrent(seekPosition);
    }
  };

  const handleSkipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const handleSkipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
    }
  };

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
            type="range"
            min="0"
            max={duration || 1}
            value={current}
            onChange={handleSeek}
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
        onTimeUpdate={(e) => setCurrent(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
      />
    </>
  );
} 