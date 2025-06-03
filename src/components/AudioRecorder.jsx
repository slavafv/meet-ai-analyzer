import React, { useRef, useState, useEffect, forwardRef } from "react";
import lamejs from "lamejs";

// Функция для тестирования мобильного режима
// Раскомментируйте эту строку, чтобы имитировать отсутствие getDisplayMedia
// window.TEST_MOBILE_MODE = true;

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
  // Проверка, поддерживается ли getDisplayMedia
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  // Состояние для отслеживания прогресса конвертации
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  
  // Аудио контекст и узлы для управления звуком
  const audioContextRef = useRef(null);
  const micGainNodeRef = useRef(null);

  // Проверяем поддержку getDisplayMedia при монтировании
  useEffect(() => {
    const checkDisplayMediaSupport = () => {
      // Проверяем тестовый режим
      if (window.TEST_MOBILE_MODE) {
        setIsMobileDevice(true);
        return false;
      }
      
      const isSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
      setIsMobileDevice(!isSupported);
      return isSupported;
    };
    
    checkDisplayMediaSupport();
  }, []);

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
        isMicMuted: () => micMuted,
        isMobileDevice: () => isMobileDevice,
        isConverting: () => isConverting,
        getConversionProgress: () => conversionProgress
      };
    }
  }, [ref, recordingTime, preparing, paused, micMuted, isMobileDevice, isConverting, conversionProgress]);

  // Notify parent when recording state changes
  useEffect(() => {
    if (onRecordingChange) {
      onRecordingChange(recording, paused, micMuted, isConverting, conversionProgress);
    }
  }, [recording, paused, micMuted, onRecordingChange, isConverting, conversionProgress]);

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
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
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
      // Всегда запрашиваем доступ к микрофону с пониженным качеством для снижения нагрузки
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 22050, // Пониженная частота дискретизации (вместо 44100/48000)
        } 
      });
      let finalStream;
      
      // Создаем аудио контекст
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 22050, // Пониженная частота дискретизации
        latencyHint: 'playback' // Оптимизация для снижения нагрузки
      });
      audioContextRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      
      // Создаем источник для микрофона
      const micSource = audioCtx.createMediaStreamSource(micStream);
      
      // Создаем узел усиления для микрофона
      const micGainNode = audioCtx.createGain();
      micGainNodeRef.current = micGainNode;
      micGainNode.gain.value = 1; // Начальное значение (микрофон включен)
      
      // Подключаем микрофон через узел усиления
      micSource.connect(micGainNode);
      micGainNode.connect(dest);

      // Проверяем, поддерживается ли getDisplayMedia
      if (!isMobileDevice && !window.TEST_MOBILE_MODE) {
        try {
          // Запрашиваем доступ к звуку вкладки
          const tabStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: true, // Должно быть true для показа диалога выбора
            audio: true
          });
          streamsRef.current = { mic: micStream, tab: tabStream };
          
          // Создаем источник для звука вкладки
          const tabSource = audioCtx.createMediaStreamSource(tabStream);
          
          // Подключаем вкладку напрямую
          tabSource.connect(dest);
          
          finalStream = dest.stream;
        } catch (displayError) {
          console.warn("Couldn't access display media, falling back to microphone only:", displayError);
          streamsRef.current = { mic: micStream };
          finalStream = dest.stream;
        }
      } else {
        // На мобильных устройствах используем только микрофон
        streamsRef.current = { mic: micStream };
        finalStream = dest.stream;
      }

      recordedChunksRef.current = [];
      
      // Выбираем оптимальные параметры кодирования для снижения нагрузки
      const options = {
        mimeType: 'audio/webm;codecs=opus', // Opus кодек более эффективен
        audioBitsPerSecond: 64000, // Пониженный битрейт для меньшей нагрузки (64 кбит/с)
      };
      
      // Проверяем поддержку кодека
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        // Если Opus не поддерживается, пробуем другие форматы
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          options.mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options.mimeType = 'audio/mp4';
        } else {
          options.mimeType = '';
        }
      }
      
      if (finalStream.getAudioTracks().length === 0) {
        setError("No audio tracks found in the stream!");
        setPreparing(false);
        return;
      }
      
      const mediaRecorder = new MediaRecorder(finalStream, options);
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
        // Начинаем процесс конвертации
        setIsConverting(true);
        setConversionProgress(0);
        
        const blob = new Blob(recordedChunksRef.current, { type: options.mimeType || "audio/webm" });
        const tempWebmUrl = URL.createObjectURL(blob);
        setWebmUrl(tempWebmUrl);
        
        try {
          // Используем Web Workers для конвертации в фоновом режиме
          const convertToMp3 = () => {
            return new Promise((resolve, reject) => {
              const arrayBuffer = blob.arrayBuffer();
              arrayBuffer.then(buffer => {
                // Создаем новый аудио контекст с пониженной частотой
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
                  sampleRate: 22050
                });
                
                // Декодируем аудио
                audioCtx.decodeAudioData(buffer).then(audioBuffer => {
                  // Получаем PCM-данные
                  const samples = audioBuffer.getChannelData(0); // моно
                  
                  // Создаем MP3 энкодер с низким битрейтом
                  const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 64);
                  const mp3Data = [];
                  
                  // Увеличиваем размер блока для ускорения обработки
                  const sampleBlockSize = 4608; // в 4 раза больше стандартного
                  const totalBlocks = Math.ceil(samples.length / sampleBlockSize);
                  let processedBlocks = 0;
                  
                  // Обработка по частям с обновлением прогресса
                  const processNextChunk = (startIndex) => {
                    const endIndex = Math.min(startIndex + sampleBlockSize * 50, samples.length);
                    
                    for (let i = startIndex; i < endIndex; i += sampleBlockSize) {
                      const sampleChunk = samples.subarray(i, i + sampleBlockSize);
                      // Преобразуем float32 в int16
                      const int16 = new Int16Array(sampleChunk.length);
                      for (let j = 0; j < sampleChunk.length; j++) {
                        int16[j] = Math.max(-32768, Math.min(32767, sampleChunk[j] * 32767));
                      }
                      const mp3buf = mp3encoder.encodeBuffer(int16);
                      if (mp3buf.length > 0) mp3Data.push(mp3buf);
                      
                      processedBlocks++;
                    }
                    
                    // Обновляем прогресс
                    const progress = Math.min(95, Math.round((processedBlocks / totalBlocks) * 100));
                    setConversionProgress(progress);
                    
                    if (endIndex < samples.length) {
                      // Продолжаем обработку следующей части через setTimeout
                      // Это позволяет UI обновляться между чанками
                      setTimeout(() => processNextChunk(endIndex), 0);
                    } else {
                      // Завершаем кодирование
                      const mp3buf = mp3encoder.flush();
                      if (mp3buf.length > 0) mp3Data.push(mp3buf);
                      
                      setConversionProgress(98); // Почти готово
                      
                      const mp3Blob = new Blob(mp3Data, { type: "audio/mp3" });
                      const mp3Url = URL.createObjectURL(mp3Blob);
                      
                      const file = new File([mp3Blob], "recording.mp3", { type: "audio/mp3" });
                      
                      // Закрываем аудио контекст
                      if (audioCtx && audioCtx.state !== 'closed') {
                        audioCtx.close().catch(console.error);
                      }
                      
                      setConversionProgress(100);
                      
                      // Небольшая задержка перед завершением, чтобы пользователь увидел 100%
                      setTimeout(() => {
                        resolve({ file, url: mp3Url });
                      }, 300);
                    }
                  };
                  
                  // Начинаем обработку с первого чанка
                  processNextChunk(0);
                  
                }).catch(reject);
              }).catch(reject);
            });
          };
          
          // Запускаем конвертацию
          const { file, url } = await convertToMp3();
          onAudioReady(file, url);
        } catch (error) {
          console.error("Error converting to MP3:", error);
          setError("Error converting audio");
        } finally {
          // Завершаем конвертацию
          setIsConverting(false);
          setConversionProgress(0);
        }
        
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
          // Проверяем, не закрыт ли уже контекст
          if (audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(console.error);
          }
          audioContextRef.current = null;
          micGainNodeRef.current = null;
        }
      };

      // Запускаем запись после настройки всех обработчиков
      // Запрашиваем данные чаще для уменьшения размера чанков
      mediaRecorder.start(500);
    } catch (e) {
      setError("Error accessing audio: " + e.message);
      setRecording(false);
      setPaused(false);
      setMicMuted(false);
      setPreparing(false);
      
      // Закрываем аудио контекст в случае ошибки
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
        micGainNodeRef.current = null;
      }
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
      {!recording && !preparing && !isConverting ? (
        <button onClick={startRecording}>Record</button>
      ) : isConverting ? (
        <div className="conversion-progress">
          <div className="progress-bar" style={{ width: `${conversionProgress}%` }}></div>
          <div className="progress-text">Обработка аудио: {conversionProgress}%</div>
        </div>
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
