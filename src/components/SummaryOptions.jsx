import React from "react";
import { FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, TextField, Box } from "@mui/material";

export default function SummaryOptions({ lang, setLang, summaryType, setSummaryType, customPrompt, setCustomPrompt }) {
  return (
    <Box>
      <FormControl fullWidth sx={{ mt: 2 }}>
        <FormLabel>Язык</FormLabel>
        <RadioGroup row value={lang} onChange={e => setLang(e.target.value)}>
          <FormControlLabel value="ru" control={<Radio />} label="Русский" />
          <FormControlLabel value="en" control={<Radio />} label="English" />
        </RadioGroup>
      </FormControl>
      <FormControl fullWidth sx={{ mt: 2 }}>
        <FormLabel>Тип саммари</FormLabel>
        <RadioGroup
          value={summaryType}
          onChange={e => setSummaryType(e.target.value)}
        >
          <FormControlLabel value="short" control={<Radio />} label="Краткое общее саммари" />
          <FormControlLabel value="structured" control={<Radio />} label="Структурированное саммари для регулярного созвона" />
          <FormControlLabel value="custom" control={<Radio />} label="Своя формулировка запроса" />
        </RadioGroup>
      </FormControl>
      {summaryType === "custom" && (
        <TextField
          label="Ваш промпт"
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          fullWidth
          multiline
          sx={{ mt: 2 }}
        />
      )}
    </Box>
  );
}
