import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import ruTranslation from './locales/ru.json';

// Загружаем сохраненный язык из localStorage или используем системный язык
const getSavedLanguage = () => {
  const savedLanguage = localStorage.getItem('preferredLanguage');
  
  if (savedLanguage) {
    return savedLanguage;
  }
  
  // Определяем системный язык
  const systemLanguage = navigator.language || navigator.userLanguage;
  return systemLanguage.startsWith('ru') ? 'ru' : 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation
      },
      ru: {
        translation: ruTranslation
      }
    },
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React уже делает это
    }
  });

export default i18n; 