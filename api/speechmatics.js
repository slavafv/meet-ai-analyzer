import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

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
  const endpoint = process.env.SPEECHMATICS_ENDPOINT;

  console.log("API KEY:", apiKey ? "OK" : "MISSING");

  // Парсим form-data
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).json({ error: "Form parse error" });
      return;
    }
    try {
      const audioFile = files.audio;
      const config = fields.config || JSON.stringify({
        type: "transcription",
        transcription_config: {
          language: fields.lang || "ru",
          diarization: "speaker",
          enable_entities: true
        }
      });

      console.log(audioFile);
      console.log("CONFIG:", config);

      const formData = new FormData();
      formData.append("data_file", fs.createReadStream(audioFile.filepath), {
        filename: audioFile.originalFilename,
        contentType: audioFile.mimetype || "audio/webm"
      });
      formData.append("config", config);

      console.log("Sending to Speechmatics:", {
        filename: audioFile.originalFilename,
        mimetype: audioFile.mimetype,
        config
      });

      const speechResp = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      const data = await speechResp.json();
      console.log("Speechmatics response:", data);

      // Теперь нужно опрашивать статус job и получить транскрипт
      if (!data.id) {
        res.status(500).json({ error: "Speechmatics job creation failed", details: data });
        return;
      }

      // Polling for job completion
      let status = "running";
      let transcript = "";
      while (status === "running" || status === "queued") {
        await new Promise(r => setTimeout(r, 2000));
        const statusResp = await fetch(`${endpoint}${data.id}/`, {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        const statusData = await statusResp.json();
        status = statusData.job.status;
        if (status === "done") {
          const transcriptResp = await fetch(`${endpoint}${data.id}/transcript?format=txt`, {
            headers: { Authorization: `Bearer ${apiKey}` }
          });
          transcript = await transcriptResp.text();
          break;
        }
        if (status === "failed") {
          res.status(500).json({ error: "Speechmatics job failed" });
          return;
        }
      }
      res.status(200).json({ transcript });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
