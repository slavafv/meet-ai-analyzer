import React from "react";
import { FormControl, InputLabel, Select, MenuItem, TextField, Box } from "@mui/material";
import { SUMMARY_KEYS } from "../constants";
import { useTranslation } from "react-i18next";

export default function SummaryOptions({ lang, setLang, summaryType, setSummaryType, customPrompt, setCustomPrompt }) {
  const { t } = useTranslation();
  
  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl sx={{ flex: 1 }}>
          <InputLabel id="language-label">{t('summaryOptions.language')}</InputLabel>
          <Select
            labelId="language-label"
            value={lang}
            label={t('summaryOptions.language')}
            onChange={(e) => setLang(e.target.value)}
          >
            <MenuItem value="en">{t('summaryOptions.english')}</MenuItem>
            <MenuItem value="ru">{t('summaryOptions.russian')}</MenuItem>
          </Select>
        </FormControl>
        
        <FormControl sx={{ flex: 1 }}>
          <InputLabel id="summary-type-label">{t('summaryOptions.summaryType')}</InputLabel>
          <Select
            labelId="summary-type-label"
            value={summaryType}
            label={t('summaryOptions.summaryType')}
            onChange={(e) => setSummaryType(e.target.value)}
          >
            <MenuItem value={SUMMARY_KEYS.SHORT}>{t('summaryOptions.types.short')}</MenuItem>
            <MenuItem value={SUMMARY_KEYS.REGULAR}>{t('summaryOptions.types.regular')}</MenuItem>
            <MenuItem value={SUMMARY_KEYS.CUSTOM}>{t('summaryOptions.types.custom')}</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      {summaryType === SUMMARY_KEYS.CUSTOM && (
        <TextField
          fullWidth
          label={t('summaryOptions.customPrompt')}
          multiline
          minRows={2}
          maxRows={100}
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          InputProps={{ sx: { alignItems: 'flex-start' } }}
          sx={{ mt: 2 }}
        />
      )}
    </Box>
  );
}
