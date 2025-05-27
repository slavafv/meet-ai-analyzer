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
import lameenc
import datetime
from pydub.utils import which
# import psutil

# === Настройки ===
SPEECHMATICS_API_KEY = st.secrets.get("SPEECHMATICS_API_KEY")
SPEECHMATICS_ENDPOINT = st.secrets.get("SPEECHMATICS_ENDPOINT")
GROQ_API_KEY = st.secrets.get("GROQ_API_KEY")
GROQ_ENDPOINT = st.secrets.get("GROQ_ENDPOINT")

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

AudioSegment.converter = "/usr/bin/ffmpeg"
AudioSegment.ffprobe = "/usr/bin/ffprobe"

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
                # logger.info(f"Added frame of length {len(frame)}")

    def get_frames(self) -> List[np.ndarray]:
        with self.lock:
            return self.audio_frames.copy()

    def clear_frames(self):
        with self.lock:
            self.audio_frames.clear()
            logger.info("Cleared all frames")

# def save_as_wav(audio_data: np.ndarray, sample_rate: int) -> str:
#     if len(audio_data.shape) > 1:
#         audio_data = audio_data.reshape(-1)
#     audio_segment = AudioSegment(
#         audio_data.tobytes(),
#         frame_rate=sample_rate,
#         sample_width=2,
#         channels=1
#     )
#     with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_file:
#         audio_segment.export(wav_file.name, format="wav")
#         return wav_file.name

def save_as_mp3(audio_data: np.ndarray, sample_rate: int, bitrate="64k") -> str:
    if len(audio_data.shape) > 1:
        audio_data = audio_data.reshape(-1)
    audio_segment = AudioSegment(
        audio_data.tobytes(),
        frame_rate=sample_rate,
        sample_width=2,
        channels=1
    )
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as mp3_file:
        audio_segment.export(mp3_file.name, format="mp3", bitrate=bitrate)
        return mp3_file.name

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
        }
    }

    with BatchClient(settings) as client:
        try:
            job_id = client.submit_job(
                audio=path_to_audio,
                transcription_config=conf,
            )
            st.info("Задача транскрибации отправлена. Ждём завершения...")

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

mode = st.radio("Выберите способ ввода", ["Записать звук", "Загрузить файл"])

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
        st.session_state['file_time'] = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M")
        st.success("Файл загружен!")

elif mode == "Записать звук":
    st.info("Нажмите 'Start' для начала записи, 'Stop' — для окончания.")
    # input_type = st.radio(
    #     "Выберите источник звука",
    #     ["Микрофон", "Линейный вход"],
    #     help="Выберите устройство для записи звука"
    # )
    input_type = "Микрофон"

    class AudioRecorder(AudioProcessorBase):
        def __init__(self) -> None:
            self.state = AudioState()
            self._first_frame_time = None
            self._frame_count = 0
            # --- Инициализация MP3-энкодера ---
            self.encoder = lameenc.Encoder()
            self.encoder.set_bit_rate(64)
            self.encoder.set_in_sample_rate(48000*2)  # для совместимости с вашей логикой
            self.encoder.set_channels(1)
            self.encoder.set_quality(2)
            self.mp3_bytes = b""

        def recv(self, frame: av.AudioFrame) -> av.AudioFrame:
            try:
                pcm = frame.to_ndarray()
                if self.state.is_recording:
                    if self._first_frame_time is None:
                        self._first_frame_time = time.time()
                    self._frame_count += 1
                    if pcm.dtype == np.float32 or pcm.dtype == np.float64:
                        pcm = (pcm * 32767).clip(-32768, 32767).astype(np.int16)
                    else:
                        pcm = pcm.astype(np.int16)
                    audio_data = pcm.reshape(-1)
                    self.state.sample_rate = frame.sample_rate
                    self.mp3_bytes += self.encoder.encode(audio_data.tobytes())
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
                "echoCancellation": True,
                "noiseSuppression": True,
                "autoGainControl": True
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
                hours, remainder = divmod(int(recording_time), 3600)
                minutes, seconds = divmod(remainder, 60)
                if hours > 0:
                    recording_placeholder.warning(f"Идёт запись... {hours} ч {minutes} мин {seconds} сек")
                elif minutes > 0:
                    recording_placeholder.warning(f"Идёт запись... {minutes} мин {seconds} сек")
                else:
                    recording_placeholder.warning(f"Идёт запись... {seconds} сек")
                time.sleep(0.1)
                recording_time += 0.1
        else:
            st.session_state.audio_recorder.state.is_recording = False
            audio_recorder = st.session_state.audio_recorder
            if audio_recorder and hasattr(audio_recorder, 'mp3_bytes') and audio_recorder.mp3_bytes:
                try:
                    mp3_data = audio_recorder.mp3_bytes + audio_recorder.encoder.flush()
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as mp3_file:
                        mp3_file.write(mp3_data)
                        audio_path = mp3_file.name
                    st.session_state['file_time'] = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M")
                    audio_segment = AudioSegment.from_file(audio_path)
                    duration = len(audio_segment) / 1000.0
                    hours, remainder = divmod(int(duration), 3600)
                    minutes, seconds = divmod(remainder, 60)
                    if hours > 0:
                        duration_str = f"{hours} ч {minutes} мин {seconds} сек"
                    elif minutes > 0:
                        duration_str = f"{minutes} мин {seconds} сек"
                    else:
                        duration_str = f"{seconds} сек"
                    st.success(f"Аудио записано! Длительность: {duration_str}")
                    with open(audio_path, 'rb') as f:
                        audio_bytes = f.read()
                        st.download_button(
                            label="Скачать MP3",
                            data=audio_bytes,
                            file_name="recording.mp3",
                            mime="audio/mp3"
                        )
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_file:
                        audio_segment.export(wav_file.name, format="wav")
                        st.audio(wav_file.name, format="audio/wav")
                    st.session_state.last_recording_path = audio_path
                    audio_recorder.mp3_bytes = b""  # очищаем буфер
                    # mem_mb = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
                    # st.info(f"Текущее потребление памяти: {mem_mb:.2f} MB")
                except Exception as e:
                    st.error(f"Ошибка при сохранении аудио: {str(e)}")
                    logger.error(f"Error saving audio: {e}")
            elif getattr(st.session_state, 'last_recording_path', None):
                audio_path = st.session_state.last_recording_path
                audio_segment = AudioSegment.from_file(audio_path)
                duration = len(audio_segment) / 1000.0
                hours, remainder = divmod(int(duration), 3600)
                minutes, seconds = divmod(remainder, 60)
                if hours > 0:
                    duration_str = f"{hours} ч {minutes} мин {seconds} сек"
                elif minutes > 0:
                    duration_str = f"{minutes} мин {seconds} сек"
                else:
                    duration_str = f"{seconds} сек"
                st.success(f"Аудио записано! Длительность: {duration_str}")
                st.session_state['file_time'] = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M")
                with open(audio_path, 'rb') as f:
                    audio_bytes = f.read()
                    st.download_button(
                        label="Скачать MP3",
                        data=audio_bytes,
                        file_name=f"{st.session_state['file_time']}-recording.mp3",
                        mime="audio/mp3"
                    )
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_file:
                    audio_segment.export(wav_file.name, format="wav")
                    st.audio(wav_file.name, format="audio/wav")
                # mem_mb = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
                # st.info(f"Текущее потребление памяти: {mem_mb:.2f} MB")
            else:
                st.warning("Нет записанных данных. Попробуйте записать снова.")

# --- Показываем выбор языка и типа саммари только если есть аудиофайл ---
if audio_path or getattr(st.session_state, 'last_recording_path', None):
    language = st.selectbox("Выберите язык", options=["ru", "en"], index=0)

    # --- Блок выбора типа саммари и поля кастомного запроса (всегда показывается) ---
    summary_types = [
        "Краткое общее саммари",
        "Структурированное саммари для регулярного созвона",
        "Своя формулировка запроса"
    ]
    summarization_type = st.selectbox(
        "Выберите тип саммари",
        summary_types,
        index=summary_types.index(st.session_state.get("_summary_type_last", "Краткое общее саммари")),
        key="summary_type_select"
    )
    custom_summary_prompt = ""
    if summarization_type == "Своя формулировка запроса":
        custom_summary_prompt = st.text_area(
            "Введите свой запрос для саммари (например, уточните структуру или стиль)",
            value=st.session_state.get("_custom_prompt_last", ""),
            key="custom_summary_prompt_area"
        )

    # --- Шаблоны для саммари (перемещено выше) ---
    SUMMARY_PRESETS = {
        "Краткое общее саммари": "Сделай краткое саммари этого текста:",
        "Структурированное саммари для регулярного созвона": (
            "Этот созвон был регулярным для сотрудника, в котором с ним общаются его ТМ, LM и HR. "
            "Иногда кто-то может отсутствовать. Хочу получить саммари по следующей структуре:\n\n"
            "По проекту: [фидбек сотрудника по проекту]\n"
            "Роль ТМ: [фидбек сотрудника по его ТМу]\n"
            "По компании: [фидбек сотрудника по компании в целом]\n"
            "Развитие: [фидбек сотрудника касательно его развития]\n"
            "Отзывы:\n"
            "Фидбэк (ТМ) – [фидбек ТМа о сотруднике]\n"
            "Фидбэк (LM) –  [фидбек LMа о сотруднике]\n"
            "Фидбэк HR:  [фидбек HRа о сотруднике]\n"
            "Английский: [уровень английского сотрудника и комментарии относящиеся к этому]"
        )
    }

    # --- Кнопка "Переделать транскрипцию и саммари" при смене языка ---
    last_transcript_lang = st.session_state.get("_last_transcript_lang", None)
    show_retranscribe_btn = False
    if st.session_state.get("transcript") and language != last_transcript_lang:
        show_retranscribe_btn = True
        if st.button("Переделать транскрипцию и саммари"):
            try:
                final_audio_path = audio_path or st.session_state.last_recording_path
                with st.spinner("Транскрибация..."):
                    transcript = transcribe_speechmatics(final_audio_path, language=language)
                    if transcript:
                        st.session_state.transcript = transcript
                        st.session_state._last_transcript_lang = language
                        # Генерируем саммари с текущими параметрами
                        if summarization_type == "Своя формулировка запроса" and custom_summary_prompt.strip():
                            summary_prompt = custom_summary_prompt.strip()
                        else:
                            summary_prompt = SUMMARY_PRESETS.get(summarization_type, SUMMARY_PRESETS["Краткое общее саммари"])
                        with st.spinner("Генерируем саммари..."):
                            summary = summarize_groq(f"{summary_prompt}\n\n{transcript}")
                            if summary:
                                st.session_state.summary = summary
                                st.session_state._summary_type_last = summarization_type
                                st.session_state._custom_prompt_last = custom_summary_prompt
                                st.success("Транскрипция и саммари обновлены!")
                        st.rerun()
                if os.path.exists(final_audio_path) and final_audio_path != getattr(st.session_state, 'last_recording_path', None):
                    os.remove(final_audio_path)
            except Exception as e:
                st.error(f"Ошибка при повторной транскрибации: {str(e)}")
                logger.error(f"Retranscription error: {e}")

    # --- Логика "Переделать саммари" (кнопка сразу под выбором типа) ---
    show_rebuild_btn = False
    if st.session_state.get("transcript"):
        prev_summary_type = st.session_state.get("_summary_type_last", None)
        prev_custom_prompt = st.session_state.get("_custom_prompt_last", None)
        summary_type_changed = summarization_type != prev_summary_type
        custom_prompt_changed = False
        if summarization_type == "Своя формулировка запроса":
            custom_prompt_changed = custom_summary_prompt.strip() != (prev_custom_prompt or "").strip()
        show_rebuild_btn = st.session_state.get("summary") and (summary_type_changed or custom_prompt_changed)
        if show_rebuild_btn:
            if st.button("Переделать саммари"):
                if summarization_type == "Своя формулировка запроса" and custom_summary_prompt.strip():
                    summary_prompt = custom_summary_prompt.strip()
                else:
                    summary_prompt = SUMMARY_PRESETS.get(summarization_type, SUMMARY_PRESETS["Краткое общее саммари"])
                with st.spinner("Генерируем новое саммари..."):
                    summary = summarize_groq(f"{summary_prompt}\n\n{st.session_state.transcript}")
                    if summary:
                        st.session_state.summary = summary
                        st.session_state._summary_type_last = summarization_type
                        st.session_state._custom_prompt_last = custom_summary_prompt
                        st.success("Саммари обновлено!")
                        st.rerun()
        if st.session_state.get("summary") and not (summary_type_changed or custom_prompt_changed):
            st.session_state._summary_type_last = summarization_type
            st.session_state._custom_prompt_last = custom_summary_prompt
    if st.session_state.get("transcript") and not show_retranscribe_btn:
        st.session_state._last_transcript_lang = language

    # --- Показываем транскрипт, если он есть ---
    if st.session_state.get("transcript"):
        st.subheader("Транскрипт")
        st.text_area("Текст транскрипции", st.session_state.transcript, height=300, key="transcript_area")

    # --- Показываем саммари, если оно есть ---
    if st.session_state.get("summary"):
        st.subheader("Саммари")
        st.text_area("Краткое содержание", st.session_state.summary, height=200, key="summary_area")
        st.download_button(
            "Скачать транскрипт",
            st.session_state.transcript,
            file_name=f"{st.session_state['file_time']}-transcript.txt"
        )
        st.download_button(
            "Скачать саммари",
            st.session_state.summary,
            file_name=f"{st.session_state['file_time']}-summary.txt"
        )

    # --- Кнопка транскрибации ---
    if not (st.session_state.get("transcript") and st.session_state.get("summary")):
        if st.button("Транскрибировать и сделать саммари"):
            try:
                final_audio_path = audio_path or st.session_state.last_recording_path
                with st.spinner("Транскрибация..."):
                    if SPEECHMATICS_API_KEY is None or SPEECHMATICS_ENDPOINT is None:
                        st.error("Отсутствует API ключ или эндпоинт Speechmatics!")
                    else:
                        transcript = transcribe_speechmatics(final_audio_path, language=language)
                        if transcript:
                            st.session_state.transcript = transcript
                            if GROQ_API_KEY is None or GROQ_ENDPOINT is None:
                                st.error("Отсутствует API ключ или эндпоинт Groq!")
                            else:
                                with st.spinner("Генерируем саммари..."):
                                    if summarization_type == "Своя формулировка запроса" and custom_summary_prompt.strip():
                                        summary_prompt = custom_summary_prompt.strip()
                                    else:
                                        summary_prompt = SUMMARY_PRESETS.get(summarization_type, SUMMARY_PRESETS["Краткое общее саммари"])
                                    summary = summarize_groq(f"{summary_prompt}\n\n{transcript}")
                                    if summary:
                                        st.session_state.summary = summary
                                        st.session_state._summary_type_last = summarization_type
                                        st.session_state._custom_prompt_last = custom_summary_prompt
                                        st.rerun()
                if os.path.exists(final_audio_path) and final_audio_path != getattr(st.session_state, 'last_recording_path', None):
                    os.remove(final_audio_path)
            except Exception as e:
                st.error(f"Ошибка при транскрибации: {str(e)}")
                logger.error(f"Transcription error: {e}")
