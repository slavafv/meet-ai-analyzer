import axios from "axios";

// Отправка аудио на serverless backend для транскрипции
export async function sendAudioForTranscription(file, lang, prompt, onStatus = () => {}, onProgress = () => {}) {
  console.log('===>> file:', file)
  onStatus("Отправление аудио...");
  const formData = new FormData();
  formData.append("data_file", file);
  formData.append("lang", lang);
  formData.append("prompt", prompt);

  // Отправляем на свой endpoint
  const response = await axios.post("/api/speechmatics", formData, {
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

