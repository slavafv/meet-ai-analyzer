import React, { useRef, useState, useEffect, forwardRef } from "react";
import lamejs from "lamejs";

export default forwardRef(function AudioRecorder({ onAudioReady, id, onRecordingChange }, ref) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamsRef = useRef({});
  const [webmUrl, setWebmUrl] = useState(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  // Состояние подготовки к записи - когда кнопка нажата, но запись еще не началась
  const [preparing, setPreparing] = useState(false);

  // Expose methods to parent component via ref
  useEffect(() => {
    if (ref) {
      ref.current = {
        startRecording,
        stopRecording,
        getRecordingTime: () => recordingTime,
        isPreparing: () => preparing
      };
    }
  }, [ref, recordingTime, preparing]);

  // Notify parent when recording state changes
  useEffect(() => {
    if (onRecordingChange) {
      onRecordingChange(recording);
    }
  }, [recording, onRecordingChange]);

  // Очистка objectURL при размонтировании компонента
  useEffect(() => {
    return () => {
      if (webmUrl) {
        URL.revokeObjectURL(webmUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [webmUrl]);

  // Обновление таймера только во время активной записи
  useEffect(() => {
    if (recording && startTimeRef.current) {
      timerRef.current = setInterval(() => {
        const elapsedTime = Date.now() - startTimeRef.current;
        setRecordingTime(elapsedTime);
      }, 10); // Обновляем каждые 10мс для плавности
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (!recording) {
        setRecordingTime(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recording]);

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

  const startRecording = async () => {
    setError("");
    setPreparing(true); // Устанавливаем состояние подготовки
    setRecordingTime(0);
    try {
      // Всегда режим both: микрофон + вкладка
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Здесь пользователь выбирает, с какой вкладкой поделиться
      const tabStream = await navigator.mediaDevices.getDisplayMedia({ audio: true });
      
      streamsRef.current = { mic: micStream, tab: tabStream };

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const tabSource = audioCtx.createMediaStreamSource(tabStream);

      micSource.connect(dest);
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
        setPreparing(false);

        // Чистим webmUrl
        if (webmUrl) {
          URL.revokeObjectURL(webmUrl);
          setWebmUrl(null);
        }
      };

      // Запускаем запись после настройки всех обработчиков
      mediaRecorder.start();
    } catch (e) {
      setError("Error accessing audio: " + e.message);
      setRecording(false);
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
