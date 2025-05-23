import streamlit as st
from speechmatics.models import ConnectionSettings
from speechmatics.batch_client import BatchClient
from httpx import HTTPStatusError
import requests

# === Настройки ===
SPEECHMATICS_API_KEY = st.secrets.get("SPEECHMATICS_API_KEY")
SPEECHMATICS_ENDPOINT = st.secrets.get("SPEECHMATICS_ENDPOINT")
GROQ_API_KEY = st.secrets.get("GROQ_API_KEY")
GROQ_ENDPOINT = st.secrets.get("GROQ_ENDPOINT")

# --- Функция транскрибации через Speechmatics ---
def transcribe_speechmatics(path_to_audio, language="ru"):
    settings = ConnectionSettings(
        url=SPEECHMATICS_ENDPOINT,
        auth_token=SPEECHMATICS_API_KEY,
    )

    conf = {
        "type": "transcription",
        "transcription_config": {
            "language": language
        }
    }

    with BatchClient(settings) as client:
        try:
            job_id = client.submit_job(
                audio=path_to_audio,
                transcription_config=conf,
            )
            st.info(f"Задача транскрибации отправлена, job_id: {job_id}. Ждём завершения...")

            transcript = client.wait_for_completion(job_id, transcription_format='txt')
            return transcript
        except HTTPStatusError as e:
            if e.response.status_code == 401:
                st.error('Неверный API ключ Speechmatics!')
            elif e.response.status_code == 400:
                st.error(f"Ошибка от Speechmatics: {e.response.json()['detail']}")
            else:
                st.error(f"Ошибка Speechmatics: {str(e)}")
            return None

# --- Функция саммари через Groq API ---
def summarize_groq(text):
    url = GROQ_ENDPOINT
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3b-chat",
        "messages": [
            {"role": "user", "content": f"Сделай краткое саммари этого текста:\n\n{text}"}
        ],
        "max_tokens": 500,
        "temperature": 0.7
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200:
        data = response.json()
        summary = data["choices"][0]["message"]["content"]
        return summary
    else:
        st.error(f"Ошибка Groq API: {response.status_code} {response.text}")
        return None

# --- UI Streamlit ---
st.title("Транскрибация + Саммари митинга с Speechmatics и Groq")

# Выбор языка
language = st.selectbox("Выберите язык для транскрибации", options=["ru", "en"], index=0)

uploaded_file = st.file_uploader("Загрузите аудиофайл для транскрибации", type=["wav", "mp3", "m4a", "ogg"])

if uploaded_file:
    with open("temp_audio_file", "wb") as f:
        f.write(uploaded_file.getbuffer())
    st.success("Файл загружен!")

    if st.button("Запустить транскрибацию и саммари"):
        with st.spinner("Идёт транскрибация..."):
            transcript = transcribe_speechmatics("temp_audio_file", language=language)
        
        if transcript:
            st.subheader("Транскрипт:")
            st.text_area("Текст транскрипции", transcript, height=300)

            with st.spinner("Генерируем саммари..."):
                summary = summarize_groq(transcript)
            
            if summary:
                st.subheader("Саммари:")
                st.text_area("Краткое содержание", summary, height=200)

                # Предложим скачать результаты
                st.download_button("Скачать транскрипт", transcript, file_name="transcript.txt")
                st.download_button("Скачать саммари", summary, file_name="summary.txt")
