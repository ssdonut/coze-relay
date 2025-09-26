// /api/relay.js — Vercel Serverless Function (Node 18+)

export default async function handler(req, res) {
  // --- CORS ---
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 兼容 body 可能是字符串或对象
    const bodyIn = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { role = "student", message = "" } = bodyIn;
    if (!message) return res.status(400).json({ error: "Missing message" });

    const COZE_API_TOKEN = process.env.COZE_API_KEY; // ← 在 Vercel 环境变量中设置
    const COZE_BOT_ID   = process.env.COZE_BOT_ID;   // ← 在 Vercel 环境变量中设置
    const COZE_API      = process.env.COZE_API_BASE || "https://api.coze.cn/v3/chat";
    if (!COZE_API_TOKEN || !COZE_BOT_ID) {
      return res.status(500).json({ error: "Server not configured: COZE_API_KEY / COZE_BOT_ID" });
    }

    // 组装 Coze v3/chat 请求体（非流式）
    const payload = {
      bot_id: COZE_BOT_ID,
      user_id: `web_${role}_${Date.now()}`,
      stream: false,
      additional_messages: [
        { content: message, content_type: "text", role: "user", type: "question" }
      ]
    };

    const r = await fetch(COZE_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${COZE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({}));
    // 兼容不同返回结构
    const reply =
      data?.reply ||
      data?.data?.reply ||
      data?.messages?.[0]?.content ||
      JSON.stringify(data);

    // 上线可去掉 raw 以减少泄露面
    return res.status(200).json({ reply, raw: data });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}