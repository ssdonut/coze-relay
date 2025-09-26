// /api/relay.js  — Secure Relay for Coze v3/chat (Node 18+ on Vercel)

export default async function handler(req, res) {
  // ---- CORS ----
  const ORIGIN = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 兼容某些平台把 JSON 当字符串转发的情况
    const inBody = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { role = "student", message = "", user_id } = inBody;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing or invalid `message`" });
    }

    // 从环境变量读取敏感信息（安全做法）
    const API_KEY = process.env.COZE_API_KEY;     // e.g. cztei_********
    const BOT_ID  = process.env.COZE_BOT_ID;      // e.g. 7554********
    const API_URL = process.env.COZE_API_BASE || "https://api.coze.cn/v3/chat";

    if (!API_KEY || !BOT_ID) {
      return res.status(500).json({ error: "Server not configured: COZE_API_KEY / COZE_BOT_ID" });
    }

    // 组装 v3/chat 的请求体（非流式，便于前端处理）
    const payload = {
      bot_id: BOT_ID,
      user_id: user_id || `web_${role}_${Date.now()}`,
      stream: false,
      additional_messages: [
        { content: message, content_type: "text", role: "user", type: "question" }
      ]
    };

    const r = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    // 将上游状态码透传，便于定位鉴权/参数问题
    const data = await r.json().catch(() => ({}));

    // 统一抽取回复文本（不同版本字段名可能不同）
    const reply =
      data?.reply ||
      data?.data?.reply ||
      data?.messages?.[0]?.content ||
      null;

    // 生产环境建议仅返回 { reply }，如需诊断可临时加上 raw
    return res.status(r.status).json(reply !== null ? { reply } : data);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
