export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.VITE_SPEECHMATICS_API_KEY || process.env.SPEECHMATICS_API_KEY;
  const endpoint = process.env.VITE_SPEECHMATICS_ENDPOINT || process.env.SPEECHMATICS_ENDPOINT;

  // Парсим form-data
  const busboy = require("busboy");
  const bb = busboy({ headers: req.headers });
  let fileBuffer = null;
  let config = null;

  bb.on("file", (name, file) => {
    const chunks = [];
    file.on("data", (data) => chunks.push(data));
    file.on("end", () => {
      fileBuffer = Buffer.concat(chunks);
    });
  });

  bb.on("field", (name, val) => {
    if (name === "config") config = val;
  });

  bb.on("finish", async () => {
    // Отправляем на Speechmatics
    const form = new FormData();
    form.append("data_file", fileBuffer, "audio.webm");
    form.append("config", config);

    const fetch = (await import("node-fetch")).default;
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  });

  req.pipe(bb);
}
