import axios from "axios";
import { tempSummary, tempTranscript } from './constants.js'

// Определяем BACKEND_URL в зависимости от среды
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BACKEND_URL = isLocalhost ? "http://localhost:3000" : import.meta.env.VITE_BACKEND_URL;

// Отправка аудио на serverless backend для транскрипции
export async function sendAudioForTranscription(file, lang, onStatus = () => {}, onProgress = () => {}) {
  onStatus("Отправление аудио...");
  const formData = new FormData();
  formData.append("data_file", file, file.name);
  formData.append("lang", lang);
  
  // Отправляем на свой endpoint
  const response = !isLocalhost ? await axios.post(`${BACKEND_URL}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    }
  }) : { data: { transcript: tempTranscript } };
  // Ожидаем, что backend вернет { transcript }
  return response.data.transcript;
}

// Отправка текста на serverless backend для саммари
export async function sendTextForSummary(transcript, prompt, onStatus = () => {}) {
  onStatus("Ожидание саммари...");
  const response = !isLocalhost ? await axios.post("/api/groq", {
    transcript,
    prompt
  }) : { data: { summary: tempSummary } };
  // Ожидаем, что backend вернет { summary }
  return response.data.summary;
}

