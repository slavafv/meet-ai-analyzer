import streamlit as st
from speechmatics.models import ConnectionSettings
from speechmatics.batch_client import BatchClient
from httpx import HTTPStatusError
from streamlit_webrtc import webrtc_streamer, AudioProcessorBase, WebRtcMode, WebRtcStreamerContext
import numpy as np
import av
import tempfile
import wave
import requests
import os
import logging
from typing import Dict, List
from dataclasses import dataclass, field
from threading import Lock
from pydub import AudioSegment
import io
import time

# === Настройки ===
SPEECHMATICS_API_KEY = st.secrets.get("SPEECHMATICS_API_KEY")
SPEECHMATICS_ENDPOINT = st.secrets.get("SPEECHMATICS_ENDPOINT")
GROQ_API_KEY = st.secrets.get("GROQ_API_KEY")
GROQ_ENDPOINT = st.secrets.get("GROQ_ENDPOINT")

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class AudioState:
    """Thread-safe state for audio recording"""
    audio_frames: List[np.ndarray] = field(default_factory=list)
    is_recording: bool = False
    lock: Lock = field(default_factory=Lock)
    sample_rate: int = 48000  # Using original WebRTC sample rate

    def add_frame(self, frame: np.ndarray):
        with self.lock:
            if frame is not None and len(frame) > 0:
                self.audio_frames.append(frame.copy())  # Make a copy to ensure thread safety
                logger.info(f"Added frame of length {len(frame)}")

    def get_frames(self) -> List[np.ndarray]:
        with self.lock:
            return self.audio_frames.copy()

    def clear_frames(self):
        with self.lock:
            self.audio_frames.clear()
            logger.info("Cleared all frames")

def save_as_wav(audio_data: np.ndarray, sample_rate: int) -> str:
    if len(audio_data.shape) > 1:
        audio_data = audio_data.reshape(-1)
    audio_segment = AudioSegment(
        audio_data.tobytes(),
        frame_rate=sample_rate,
        sample_width=2,
        channels=1
    )
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_file:
        audio_segment.export(wav_file.name, format="wav")
        return wav_file.name

def save_as_mp3(audio_data: np.ndarray, sample_rate: int) -> str:
    try:
        if len(audio_data.shape) > 1:
            audio_data = audio_data.reshape(-1)
        audio_segment = AudioSegment(
            audio_data.tobytes(),
            frame_rate=sample_rate,
            sample_width=2,
            channels=1
        )
        # Сначала экспортируем во временный WAV
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_file:
            audio_segment.export(wav_file.name, format="wav")
            wav_path = wav_file.name

        # Теперь конвертируем WAV в MP3
        audio_segment = AudioSegment.from_wav(wav_path)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as mp3_file:
            audio_segment.export(
                mp3_file.name,
                format="mp3",
                parameters=["-ar", str(sample_rate), "-ac", "1", "-b:a", "192k"]
            )
            mp3_path = mp3_file.name

        # Удаляем временный WAV
        os.remove(wav_path)
        return mp3_path
    except Exception as e:
        logger.error(f"Error saving MP3: {e}")
        raise

def resample_audio(audio_data: np.ndarray, from_rate: int, to_rate: int) -> np.ndarray:
    if from_rate == to_rate:
        return audio_data
    if len(audio_data.shape) > 1:
        audio_data = audio_data.reshape(-1)
    audio_data = audio_data.astype(np.int16)
    audio_segment = AudioSegment(
        audio_data.tobytes(),
        frame_rate=from_rate,
        sample_width=2,
        channels=1
    )
    audio_segment = audio_segment.set_frame_rate(to_rate)
    return np.array(audio_segment.get_array_of_samples())

# --- Транскрибация через Speechmatics ---
def transcribe_speechmatics(path_to_audio, language="ru"):
    if not SPEECHMATICS_ENDPOINT or not SPEECHMATICS_API_KEY:
        raise ValueError("Missing Speechmatics API credentials")
        
    settings = ConnectionSettings(
        url=str(SPEECHMATICS_ENDPOINT),  # Convert to string to satisfy type checker
        auth_token=str(SPEECHMATICS_API_KEY),  # Convert to string to satisfy type checker
    )

    conf = {
        "type": "transcription",
        "transcription_config": {
            "language": language,
            "diarization": "speaker",
            "enable_entities": True,
            # "diarization_config": {
            #     "speaker_labels": True,
            #     "speaker_labels_timeout": 10,
            # }
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

# --- Саммари через Groq API ---
def summarize_groq(text):
    if not GROQ_ENDPOINT or not GROQ_API_KEY:
        raise ValueError("Missing Groq API credentials")
        
    url = str(GROQ_ENDPOINT)  # Convert to string to satisfy type checker
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
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
st.title("Транскрибация + Саммари митинга")

language = st.selectbox("Выберите язык", options=["ru", "en"], index=0)
mode = st.radio("Выберите способ ввода", ["Загрузить файл", "Записать звук"])

audio_path = None

if mode == "Загрузить файл":
    uploaded_file = st.file_uploader("Загрузите аудиофайл", type=["wav", "mp3", "m4a", "ogg"])
    if uploaded_file:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
            # Если загружен не MP3, конвертируем его
            if uploaded_file.type != "audio/mp3":
                audio = AudioSegment.from_file(io.BytesIO(uploaded_file.getvalue()), format=uploaded_file.type.split('/')[-1])
                audio.export(f.name, format="mp3", bitrate="128k")
            else:
                f.write(uploaded_file.getbuffer())
            audio_path = f.name
        st.success("Файл загружен!")

elif mode == "Записать звук":
    st.info("Нажмите 'Start' для начала записи, 'Stop' — для окончания.")
    
    input_type = st.radio(
        "Выберите источник звука",
        ["Микрофон", "Линейный вход"],
        help="Выберите устройство для записи звука"
    )

    class AudioRecorder(AudioProcessorBase):
        def __init__(self) -> None:
            self.state = AudioState()
            self._first_frame_time = None
            self._frame_count = 0

        def recv(self, frame: av.AudioFrame) -> av.AudioFrame:
            try:
                pcm = frame.to_ndarray()
                logger.info(f"PCM shape: {pcm.shape}, dtype: {pcm.dtype}, min: {pcm.min()}, max: {pcm.max()}, frame.sample_rate: {frame.sample_rate}")
                if self.state.is_recording:
                    if self._first_frame_time is None:
                        self._first_frame_time = time.time()
                    self._frame_count += 1
                    if self._frame_count % 50 == 0:
                        elapsed = time.time() - self._first_frame_time
                        logger.info(f"Frames: {self._frame_count}, Elapsed: {elapsed:.2f}s, FPS: {self._frame_count/elapsed:.2f}")
                    if pcm.dtype == np.float32 or pcm.dtype == np.float64:
                        pcm = (pcm * 32767).clip(-32768, 32767).astype(np.int16)
                    else:
                        pcm = pcm.astype(np.int16)
                    audio_data = pcm.reshape(-1)
                    self.state.sample_rate = frame.sample_rate
                    self.state.add_frame(audio_data)
                return frame
            except Exception as e:
                logger.error(f"Error processing audio frame: {e}")
                return frame

    ctx = webrtc_streamer(
        key=f"audio_{input_type}",
        mode=WebRtcMode.SENDONLY,
        audio_processor_factory=AudioRecorder,
        media_stream_constraints={
            "audio": {
                "echoCancellation": input_type == "Микрофон",
                "noiseSuppression": input_type == "Микрофон",
                "autoGainControl": input_type == "Микрофон"
            },
            "video": False
        },
        rtc_configuration={
            "iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]
        },
        async_processing=True,
    )

    if "audio_recorder" not in st.session_state:
        st.session_state.audio_recorder = None

    if ctx.audio_processor:
        st.session_state.audio_recorder = ctx.audio_processor

    # Управление состоянием записи
    if st.session_state.audio_recorder:
        if ctx.state.playing:
            st.session_state.audio_recorder.state.is_recording = True
            st.warning(f"Идёт запись с устройства: {input_type}")
            
            # Add recording indicator
            recording_placeholder = st.empty()
            recording_time = 0
            while ctx.state.playing:
                recording_placeholder.warning(f"Идёт запись... {recording_time:.1f} сек")
                time.sleep(0.1)
                recording_time += 0.1
            
        else:
            st.session_state.audio_recorder.state.is_recording = False
            frames = st.session_state.audio_recorder.state.get_frames()
            
            if len(frames) > 0:
                try:
                    logger.info(f"Number of frames to save: {len(frames)}")
                    audio_data = np.concatenate(frames).astype(np.int16)
                    logger.info(f"Total audio_data shape: {audio_data.shape}, dtype: {audio_data.dtype}")
                    logger.info(f"Sample rate: {st.session_state.audio_recorder.state.sample_rate}")
                    
                    # Получаем реальный sample_rate из фреймов
                    real_sample_rate = st.session_state.audio_recorder.state.sample_rate
                    logger.info(f"Using real sample rate: {real_sample_rate}")

                    # Важно! WebRTC отдаёт аудиоданные, которые нужно сохранять с sample_rate в 2 раза больше,
                    # иначе звук будет медленнее и ниже. Это особенность работы streamlit-webrtc.
                    audio_path = save_as_wav(audio_data, real_sample_rate * 2)
                    
                    # Calculate duration based on the final MP3 file
                    audio_segment = AudioSegment.from_wav(audio_path)
                    duration = len(audio_segment) / 1000.0  # Convert from ms to seconds
                    
                    st.success(f"Аудио записано! Длительность: {duration:.1f} сек")
                    
                    # Add download button with proper extension
                    with open(audio_path, 'rb') as f:
                        audio_bytes = f.read()
                        st.download_button(
                            label="Скачать WAV",
                            data=audio_bytes,
                            file_name="recording.wav",
                            mime="audio/wav"
                        )
                    
                    # Display audio player
                    # st.audio(audio_path, format="audio/mp3")
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_file:
                        audio_segment.export(wav_file.name, format="wav")
                        st.audio(wav_file.name, format="audio/wav")
                    
                    # Store the path for transcription
                    st.session_state.last_recording_path = audio_path
                    
                    # Clear the recorded frames
                    # st.session_state.audio_recorder.state.clear_frames()
                except Exception as e:
                    st.error(f"Ошибка при сохранении аудио: {str(e)}")
                    logger.error(f"Error saving audio: {e}")
            else:
                st.warning("Нет записанных данных. Попробуйте записать снова.")

# --- Запуск транскрибации ---
if (audio_path or getattr(st.session_state, 'last_recording_path', None)) and st.button("Транскрибировать и сделать саммари"):
    try:
        # Use the last recording path if audio_path is not set
        final_audio_path = audio_path or st.session_state.last_recording_path
        
        with st.spinner("Транскрибация..."):
            if SPEECHMATICS_API_KEY is None or SPEECHMATICS_ENDPOINT is None:
                st.error("Отсутствует API ключ или эндпоинт Speechmatics!")
            else:
                transcript = transcribe_speechmatics(final_audio_path, language=language)
                if transcript:
                    st.subheader("Транскрипт")
                    st.text_area("Текст транскрипции", transcript, height=300)
                    
                    if GROQ_API_KEY is None or GROQ_ENDPOINT is None:
                        st.error("Отсутствует API ключ или эндпоинт Groq!")
                    else:
                        with st.spinner("Генерируем саммари..."):
                            summary = summarize_groq(transcript)
                            
                            if summary:
                                st.subheader("Саммари")
                                st.text_area("Краткое содержание", summary, height=200)
                                
                                # Convert to string if needed
                                transcript_str = str(transcript) if not isinstance(transcript, str) else transcript
                                summary_str = str(summary) if not isinstance(summary, str) else summary
                                
                                st.download_button("Скачать транскрипт", transcript_str, file_name="transcript.txt")
                                st.download_button("Скачать саммари", summary_str, file_name="summary.txt")

        # Удаляем временный файл только если это не последняя запись
        if os.path.exists(final_audio_path) and final_audio_path != getattr(st.session_state, 'last_recording_path', None):
            os.remove(final_audio_path)
    except Exception as e:
        st.error(f"Ошибка при транскрибации: {str(e)}")
        logger.error(f"Transcription error: {e}")
