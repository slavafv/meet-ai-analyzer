import React from 'react';
import { Box, Switch, styled, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Стилизованный переключатель
const LanguageSwitch = styled(Switch)(({ theme }) => ({
  width: 62,
  height: 34,
  padding: 7,
  '& .MuiSwitch-switchBase': {
    margin: 1,
    padding: 0,
    transform: 'translateX(6px)',
    '&.Mui-checked': {
      color: '#fff',
      transform: 'translateX(22px)',
      '& .MuiSwitch-thumb:before': {
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><text x="4" y="14" fill="${encodeURIComponent(
          '#fff',
        )}" font-family="Arial" font-size="12">RU</text></svg>')`,
      },
      '& + .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be',
      },
    },
  },
  '& .MuiSwitch-thumb': {
    backgroundColor: theme.palette.mode === 'dark' ? '#003892' : '#001e3c',
    width: 32,
    height: 32,
    '&:before': {
      content: "''",
      position: 'absolute',
      width: '100%',
      height: '100%',
      left: -2,
      top: 0,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><text x="4" y="14" fill="${encodeURIComponent(
        '#fff',
      )}" font-family="Arial" font-size="12">EN</text></svg>')`,
    },
  },
  '& .MuiSwitch-track': {
    opacity: 1,
    backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be',
    borderRadius: 20 / 2,
  },
}));

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const theme = useTheme();
  
  const handleLanguageChange = (event) => {
    const newLanguage = event.target.checked ? 'ru' : 'en';
    i18n.changeLanguage(newLanguage);
    localStorage.setItem('preferredLanguage', newLanguage);
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        color: theme.palette.text.primary
      }}
    >
      <span>EN</span>
      <LanguageSwitch 
        checked={i18n.language === 'ru'} 
        onChange={handleLanguageChange}
        inputProps={{ 'aria-label': 'toggle language' }}
      />
      <span>RU</span>
    </Box>
  );
} 