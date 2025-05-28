import formidable from "formidable";
import { BatchClient } from "@speechmatics/batch-client";
import fs from "fs";
import { openAsBlob } from "node:fs";

export const config = {
  api: {
    bodyParser: false,
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
    let audioFile = files.data_file;
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
      const lang = Array.isArray(fields.lang) ? fields.lang[0] : (fields.lang || "ru");
      const transcription_config = {
        language: lang,
        diarization: "speaker",
        enable_entities: true
      };

      const client = new BatchClient({ apiKey, appId: 'my-app' });
      const blob = await openAsBlob(filePath);
      const file = new File([blob], audioFile.originalFilename, { type: audioFile.mimetype });
      const response = await client.transcribe(
        file,
        { transcription_config }
      );
      const result = await client.getJobResult(response.job.id, 'text');
      res.status(200).json({ transcript: result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
