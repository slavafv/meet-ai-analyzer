import React from 'react';
import { Box, Paper, Typography, Divider } from '@mui/material';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { t } = useTranslation();

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
        gap: 2,
        width: { xs: '100%', sm: '210px' }, // Fixed width to prevent jumping
        justifyContent: 'flex-end' 
      }}>
        <Typography variant="body2" sx={{ flexShrink: 0 }}>{t('settings.language')}:</Typography>
        <LanguageToggle />
      </Box>
      
      <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
      <Divider sx={{ width: '100%', display: { xs: 'block', sm: 'none' } }} />
      
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        width: { xs: '100%', sm: '210px' }, // Fixed width to prevent jumping
        justifyContent: 'flex-end'
      }}>
        <Typography variant="body2" sx={{ flexShrink: 0 }}>{t('settings.theme')}:</Typography>
        <ThemeToggle />
      </Box>
    </Paper>
  );
} 