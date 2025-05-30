import axios from "axios";

// Определяем BACKEND_URL в зависимости от среды
let BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  BACKEND_URL = "http://localhost:3000";
}

// Отправка аудио на serverless backend для транскрипции
export async function sendAudioForTranscription(file, lang, prompt, onStatus = () => {}, onProgress = () => {}) {
  onStatus("Отправление аудио...");
  const formData = new FormData();
  formData.append("data_file", file, file.name);
  formData.append("lang", lang);
  formData.append("prompt", prompt);

  // Отправляем на свой endpoint
  const response = await axios.post(`${BACKEND_URL}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    }
  });
  // Ожидаем, что backend вернет { transcript }
  return response.data.transcript;
}

// Отправка текста на serverless backend для саммари
export async function sendTextForSummary(transcript, prompt, onStatus = () => {}) {
  onStatus("Ожидание саммари...");
  const response = await axios.post("/api/groq", {
    transcript,
    prompt
  });
  // Ожидаем, что backend вернет { summary }
  return response.data.summary;
}

