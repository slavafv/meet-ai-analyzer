import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Создаем контекст темы
const ThemeContext = createContext();

// Тип темы: light, dark или system
const getInitialThemeMode = () => {
  const savedTheme = localStorage.getItem('themeMode');
  if (savedTheme) {
    return savedTheme;
  }
  return 'system'; // По умолчанию используем системную тему
};

// Проверяем, предпочитает ли система темную тему
const prefersDarkMode = () => {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// Получаем актуальную тему (светлую или темную) с учетом типа темы
const getActiveTheme = (themeMode) => {
  if (themeMode === 'system') {
    return prefersDarkMode() ? 'dark' : 'light';
  }
  return themeMode;
};

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState(getInitialThemeMode());
  const [activeTheme, setActiveTheme] = useState(getActiveTheme(themeMode));

  // Создаем тему MUI
  const theme = createTheme({
    palette: {
      mode: activeTheme,
      ...(activeTheme === 'light'
        ? {
            // Светлая тема
            primary: {
              main: '#6366f1',
            },
            background: {
              default: '#fafafa',
              paper: '#ffffff',
            },
          }
        : {
            // Темная тема - более светлый и контрастный цвет для кнопок и интерактивных элементов
            primary: {
              main: '#a5b4fc', // Светлее, чем было (было #818cf8)
            },
            background: {
              default: '#121212',
              paper: '#1e1e1e',
            },
            text: {
              primary: '#f3f4f6', // Более яркий текст для темной темы
              secondary: '#d1d5db', // Более яркий вторичный текст
            },
          }),
    },
    components: {
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: activeTheme === 'dark' ? '#a5b4fc' : '#6366f1',
            },
          },
        },
      },
      // Убираем оставшийся outline после клика на кнопках
      MuiButtonBase: {
        styleOverrides: {
          root: {
            '&:focus': {
              outline: 'none',
            },
            '&:focus-visible': {
              outline: 'auto',
            },
          },
        },
      },
    },
  });

  // Отслеживаем изменения системной темы
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (themeMode === 'system') {
        setActiveTheme(prefersDarkMode() ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  // При изменении themeMode обновляем activeTheme и сохраняем в localStorage
  useEffect(() => {
    setActiveTheme(getActiveTheme(themeMode));
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  // Функция для изменения темы
  const toggleTheme = (newThemeMode) => {
    setThemeMode(newThemeMode);
  };

  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme, activeTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// Хук для использования темы
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 