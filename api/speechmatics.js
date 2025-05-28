import formidable from "formidable";
import { BatchClient } from "@speechmatics/batch-client";
import { openAsBlob } from "node:fs";
import { exec } from "child_process";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
// import ffmpegPath from "ffmpeg-static";

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static').path || path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'node_modules/ffmpeg-static/ffmpeg'
);


console.log("ffmpegPath:", ffmpegPath);
try {
  const exists = fs.existsSync(ffmpegPath);
  console.log("ffmpeg exists:", exists);
} catch (e) {
  console.log("ffmpeg exists check error:", e.message);
}


export const config = {
  api: {
    bodyParser: false, // Отключаем встроенный парсер, чтобы использовать formidable
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.SPEECHMATICS_API_KEY;

  const form = formidable();

  form.parse(req, async (err, fields, files) => {
    let audioFile = files.audio;

    if (Array.isArray(audioFile)) audioFile = audioFile[0];
    if (!audioFile) {
      res.status(400).json({ error: "No audio file uploaded" });
      return;
    }

    const filePath = audioFile.filepath || audioFile.path;

    if (!filePath) {
      res.status(400).json({ error: "No file path in uploaded file" });
      return;
    }

    try {
      const tempMp3Path = path.join(os.tmpdir(), `${audioFile.newFilename}.mp3`);
      
      await new Promise((resolve, reject) => {
        exec(`"${ffmpegPath}" -y -i "${filePath}" -ar 16000 -ac 1 -codec:a libmp3lame "${tempMp3Path}"`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const blob = await openAsBlob(tempMp3Path);
      const file = new File([blob], audioFile.originalFilename.replace(/\.webm$/, ".mp3"), { type: "audio/mp3" });

      const lang = Array.isArray(fields.lang) ? fields.lang[0] : (fields.lang || "ru");
      const transcription_config = {
        language: lang,
        diarization: "speaker",
        enable_entities: true
      };
      console.log("transcription_config:", transcription_config);

      const client = new BatchClient({ apiKey, appId: 'my-app' });

      // Отправляем на транскрипцию
      const response = await client.transcribe(
        file,
        {
          transcription_config: transcription_config
        }
      );

      const result = await client.getJobResult(response.job.id, 'text');
      console.log('===>> result:', result)
      
      // Удаляем временные файлы
      await fs.unlink(tempMp3Path);

      res.status(200).json({ transcript: result });
    } catch (e) {
      // (опционально) попытаться удалить файлы даже при ошибке
      try { await fs.unlink(tempMp3Path); } catch {}
      res.status(500).json({ error: e.message });
    }
  });
}
