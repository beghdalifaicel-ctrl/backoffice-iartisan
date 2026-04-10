#!/bin/bash
# Script pour enregistrer le webhook Telegram
# Usage: TELEGRAM_BOT_TOKEN=xxx ./scripts/setup-telegram-webhook.sh

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "❌ Variable TELEGRAM_BOT_TOKEN manquante"
  echo "Usage: TELEGRAM_BOT_TOKEN=votre_token ./scripts/setup-telegram-webhook.sh"
  exit 1
fi

WEBHOOK_URL="https://backoffice-iartisan.vercel.app/api/webhooks/telegram"

echo "🔗 Enregistrement du webhook Telegram..."
echo "   URL: $WEBHOOK_URL"

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\", \"allowed_updates\": [\"message\"]}" | python3 -m json.tool

echo ""
echo "📋 Vérification..."
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool
