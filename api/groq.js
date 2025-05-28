export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  const endpoint = process.env.GROQ_ENDPOINT;

  const { transcript, prompt } = req.body || {};

  const fetch = (await import("node-fetch")).default;
  const groqResp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { role: "user", content: `${prompt}\n\n${transcript}` }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  });
  if (!groqResp.ok) {
    const err = await groqResp.text();
    res.status(500).json({ error: err });
    return;
  }
  const data = await groqResp.json();
  res.status(200).json({ summary: data.choices[0].message.content });
}
