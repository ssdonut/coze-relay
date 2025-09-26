export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, user_id = "123456789" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Missing message in request body" });
    }

    // 固定写死的 Key 和 Bot ID（你提供的值）
    const COZE_API_KEY =
      "cztei_hqwB62td9lhIT3tOaqaOgTEdKa3092iKhZcR56OOXU285whjBa3gaZr4xNPFXVuAZ";
    const COZE_BOT_ID = "7554033269068267570";

    // 请求 Coze API
    const response = await fetch("https://api.coze.cn/v3/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${COZE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bot_id: COZE_BOT_ID,
        user_id,
        stream: false, // 简化处理，先不做 SSE
        additional_messages: [
          {
            role: "user",
            type: "question",
            content: message,
            content_type: "text",
          },
        ],
        parameters: {},
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Relay error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
