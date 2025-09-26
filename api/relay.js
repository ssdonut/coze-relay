const API_BASE = process.env.COZE_API_BASE || "https://api.coze.cn";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default async function handler(req, res) {
  // CORS（必要时把 * 换成你的站点域名）
  const ORIGIN = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 兼容字符串 body
    const bodyIn = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { role = "student", message = "", user_id } = bodyIn;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing or invalid `message`" });
    }

    const KEY = process.env.COZE_API_KEY;
    const BOT = process.env.COZE_BOT_ID;
    if (!KEY || !BOT) return res.status(500).json({ error: "Server not configured" });

    // 1) 启动对话（非流式）
    const start = await fetch(`${API_BASE}/v3/chat`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bot_id: BOT,
        user_id: user_id || `web_${role}_${Date.now()}`,
        stream: false,
        additional_messages: [
          { content: message, content_type: "text", role: "user", type: "question" }
        ],
      }),
    });

    const startData = await start.json().catch(() => ({}));

    // 兼容不同返回
    const chat = startData?.data || startData;
    const chatId = chat?.id;
    const convId = chat?.conversation_id;

    if (!start.ok) {
      return res.status(start.status).json({ error: startData });
    }

    // 如果已经有完整回复（有 reply 或 messages），直接返回
    if (startData?.reply || startData?.data?.reply) {
      const reply = startData.reply || startData.data.reply;
      return res.status(200).json({ reply });
    }

    // 2) 轮询 status，直到 completed
    let status = chat?.status || "in_progress";
    let tries = 0, MAX_TRIES = 30, replyText = null;

    while (status === "in_progress" && tries < MAX_TRIES) {
      await sleep(1000 + tries * 150); // 轻微退避
      tries++;

      // 2.1 尝试 retrieve
      if (chatId) {
        const r1 = await fetch(`${API_BASE}/v3/chat/retrieve?chat_id=${encodeURIComponent(chatId)}`, {
          headers: { "Authorization": `Bearer ${KEY}` }
        }).then(r => r.json()).catch(() => ({}));

        status = r1?.data?.status || r1?.status || status;
        // 有些实现会在 retrieve 直接给出 reply
        if (!replyText) {
          replyText = r1?.data?.reply || r1?.reply || null;
          if (replyText) break;
        }
        if (status === "completed") break;
      }

      // 2.2 尝试 message/list（根据会话 id 拉取最后一条助手消息）
      if (convId) {
        const r2 = await fetch(
          `${API_BASE}/v3/chat/message/list?conversation_id=${encodeURIComponent(convId)}`,
          { headers: { "Authorization": `Bearer ${KEY}` } }
        ).then(r => r.json()).catch(() => ({}));

        // 在返回的 messages 里找最后一条 assistant/answer 文本
        const msgs = r2?.data?.messages || r2?.messages || [];
        const last = [...msgs].reverse().find(
          m => (m.role === "assistant" || m.type === "answer") && m.content_type === "text" && m.content
        );
        if (last?.content) {
          replyText = last.content;
          status = "completed";
          break;
        }
      }
    }

    if (replyText) return res.status(200).json({ reply: replyText });
    if (status !== "completed") {
      return res.status(202).json({ status: status || "in_progress", tip: "Still generating, try again shortly." });
    }

    // 兜底：返回原始体，便于排查
    return res.status(200).json(startData);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
