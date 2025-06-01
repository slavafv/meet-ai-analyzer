import React from 'react';
import { Box, Paper, Divider } from '@mui/material';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';

export default function Settings() {
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2, 
        mb: 3, 
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 3,
        borderRadius: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center'
      }}>
        <LanguageToggle />
      </Box>
      
      <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
      <Divider sx={{ width: '100%', display: { xs: 'block', sm: 'none' } }} />
      
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center'
      }}>
        <ThemeToggle />
      </Box>
    </Paper>
  );
} 