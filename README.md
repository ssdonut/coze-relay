# Coze Relay (Minimal)

Vercel Serverless 中转：前端 `{ role, message }` → Coze `v3/chat`，解决 CORS 并隐藏 API Key。

## 环境变量
- COZE_API_KEY  = 你的 API Key（Bearer Token）
- COZE_BOT_ID   = 你的 Bot ID
- ALLOWED_ORIGIN (可选) = 允许的前端源，如 `https://jr.yourdomain.com`
- COZE_API_BASE (可选)  = 默认 `https://api.coze.cn/v3/chat`

## 本地/线上测试
curl -X POST "https://<your-vercel-domain>/api/relay" \
  -H "Content-Type: application/json" \
  -d '{"role":"student","message":"请生成2道线性代数练习题"}'