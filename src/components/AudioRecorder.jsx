import React, { useRef, useState, useEffect, forwardRef } from "react";
import lamejs from "lamejs";

export default forwardRef(function AudioRecorder({ onAudioReady, id, onRecordingChange }, ref) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [micMuted, setMicMuted] = useState(false); // Состояние мьюта микрофона
  const [error, setError] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamsRef = useRef({});
  const [webmUrl, setWebmUrl] = useState(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedTimeRef = useRef(0); // Общее время на паузе
  const pauseStartTimeRef = useRef(null); // Время начала паузы
  // Состояние подготовки к записи - когда кнопка нажата, но запись еще не началась
  const [preparing, setPreparing] = useState(false);
  
  // Аудио контекст и узлы для управления звуком
  const audioContextRef = useRef(null);
  const micGainNodeRef = useRef(null);

  // Expose methods to parent component via ref
  useEffect(() => {
    if (ref) {
      ref.current = {
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        toggleMicMute,
        getRecordingTime: () => recordingTime,
        isPreparing: () => preparing,
        isPaused: () => paused,
        isMicMuted: () => micMuted
      };
    }
  }, [ref, recordingTime, preparing, paused, micMuted]);

  // Notify parent when recording state changes
  useEffect(() => {
    if (onRecordingChange) {
      onRecordingChange(recording, paused, micMuted);
    }
  }, [recording, paused, micMuted, onRecordingChange]);

  // Очистка objectURL при размонтировании компонента
  useEffect(() => {
    return () => {
      if (webmUrl) {
        URL.revokeObjectURL(webmUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Закрываем аудио контекст при размонтировании
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, [webmUrl]);

  // Обновление таймера только во время активной записи
  useEffect(() => {
    if (recording && !paused && startTimeRef.current) {
      timerRef.current = setInterval(() => {
        const elapsedTime = Date.now() - startTimeRef.current - pausedTimeRef.current;
        setRecordingTime(elapsedTime);
      }, 10); // Обновляем каждые 10мс для плавности
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (!recording) {
        setRecordingTime(0);
        pausedTimeRef.current = 0;
        pauseStartTimeRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recording, paused]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);

    const pad = (n, length = 2) => String(n).padStart(length, '0');
    
    let formattedTime = '';
    if (hours > 0) formattedTime += `${pad(hours)}:`;
    formattedTime += `${pad(minutes)}:${pad(seconds)}.${pad(milliseconds)}`;
    
    return formattedTime;
  };

  // Функция для приостановки записи
  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      // Сохраняем время начала паузы
      pauseStartTimeRef.current = Date.now();
      
      // Приостанавливаем запись
      mediaRecorderRef.current.pause();
      
      // Обновляем состояние
      setPaused(true);
    }
  };

  // Функция для возобновления записи
  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      // Вычисляем время, проведенное на паузе
      if (pauseStartTimeRef.current) {
        pausedTimeRef.current += Date.now() - pauseStartTimeRef.current;
        pauseStartTimeRef.current = null;
      }
      
      // Возобновляем запись
      mediaRecorderRef.current.resume();
      
      // Обновляем состояние
      setPaused(false);
    }
  };

  // Функция для включения/отключения микрофона
  const toggleMicMute = () => {
    if (!micGainNodeRef.current) return;
    
    if (micMuted) {
      // Включаем микрофон (устанавливаем коэффициент усиления 1)
      micGainNodeRef.current.gain.value = 1;
      setMicMuted(false);
    } else {
      // Отключаем микрофон (устанавливаем коэффициент усиления 0)
      micGainNodeRef.current.gain.value = 0;
      setMicMuted(true);
    }
  };

  const startRecording = async () => {
    setError("");
    setPreparing(true); // Устанавливаем состояние подготовки
    setRecordingTime(0);
    setPaused(false);
    setMicMuted(false);
    pausedTimeRef.current = 0;
    pauseStartTimeRef.current = null;
    
    try {
      // Всегда режим both: микрофон + вкладка
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Здесь пользователь выбирает, с какой вкладкой поделиться
      const tabStream = await navigator.mediaDevices.getDisplayMedia({ audio: true });
      
      streamsRef.current = { mic: micStream, tab: tabStream };

      // Создаем аудио контекст и сохраняем его в ref
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      
      const dest = audioCtx.createMediaStreamDestination();

      // Создаем источники для микрофона и вкладки
      const micSource = audioCtx.createMediaStreamSource(micStream);
      const tabSource = audioCtx.createMediaStreamSource(tabStream);

      // Создаем узел усиления для микрофона
      const micGainNode = audioCtx.createGain();
      micGainNodeRef.current = micGainNode;
      micGainNode.gain.value = 1; // Начальное значение (микрофон включен)

      // Подключаем микрофон через узел усиления
      micSource.connect(micGainNode);
      micGainNode.connect(dest);
      
      // Подключаем вкладку напрямую
      tabSource.connect(dest);

      const finalStream = dest.stream;

      recordedChunksRef.current = [];
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "";
      }
      if (finalStream.getAudioTracks().length === 0) {
        setError("No audio tracks found in the stream!");
        setPreparing(false);
        return;
      }
      const mediaRecorder = new MediaRecorder(finalStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      
      // Обработчик начала записи
      mediaRecorder.onstart = () => {
        // Устанавливаем время начала записи ТОЛЬКО в момент старта медиарекордера
        startTimeRef.current = Date.now();
        setRecording(true);
        setPreparing(false); // Подготовка завершена
      };
      
      // Обработчики паузы и возобновления
      mediaRecorder.onpause = () => {
        setPaused(true);
      };
      
      mediaRecorder.onresume = () => {
        setPaused(false);
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const tempWebmUrl = URL.createObjectURL(blob);
        setWebmUrl(tempWebmUrl);
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // Получаем PCM-данные
        const samples = audioBuffer.getChannelData(0); // моно
        const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 64);
        const mp3Data = [];
        const sampleBlockSize = 1152;
        for (let i = 0; i < samples.length; i += sampleBlockSize) {
          const sampleChunk = samples.subarray(i, i + sampleBlockSize);
          // Преобразуем float32 в int16
          const int16 = new Int16Array(sampleChunk.length);
          for (let j = 0; j < sampleChunk.length; j++) {
            int16[j] = Math.max(-32768, Math.min(32767, sampleChunk[j] * 32767));
          }
          const mp3buf = mp3encoder.encodeBuffer(int16);
          if (mp3buf.length > 0) mp3Data.push(mp3buf);
        }
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) mp3Data.push(mp3buf);

        const mp3Blob = new Blob(mp3Data, { type: "audio/mp3" });
        const mp3Url = URL.createObjectURL(mp3Blob);

        const file = new File([mp3Blob], "recording.mp3", { type: "audio/mp3" });
        onAudioReady(file, mp3Url);
        setRecording(false);
        setPaused(false);
        setMicMuted(false);
        setPreparing(false);

        // Чистим webmUrl
        if (webmUrl) {
          URL.revokeObjectURL(webmUrl);
          setWebmUrl(null);
        }
        
        // Закрываем аудио контекст
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(console.error);
          audioContextRef.current = null;
          micGainNodeRef.current = null;
        }
      };

      // Запускаем запись после настройки всех обработчиков
      mediaRecorder.start();
    } catch (e) {
      setError("Error accessing audio: " + e.message);
      setRecording(false);
      setPaused(false);
      setMicMuted(false);
      setPreparing(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    // Остановить все потоки
    Object.values(streamsRef.current).forEach((stream) =>
      stream.getTracks().forEach((track) => track.stop())
    );
  };

  return (
    <div id={id}>
      {!recording && !preparing ? (
        <button onClick={startRecording}>Record</button>
      ) : (
        <button onClick={stopRecording}>Stop</button>
      )}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {recording && (
        <div className="recording-time">
          {formatTime(recordingTime)}
        </div>
      )}
    </div>
  );
});
