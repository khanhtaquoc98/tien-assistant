/**
 * Telegram Webhook Setup Route Handler
 * Set/Delete/Check webhook for the Telegram bot
 *
 * POST /api/telegram/setup - Set webhook
 * DELETE /api/telegram/setup - Delete webhook
 * GET /api/telegram/setup - Get webhook info
 */

import { type NextRequest } from 'next/server';
import { setWebhook, deleteWebhook, getWebhookInfo, getMe } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const appUrl = body.url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const webhookUrl = `${appUrl}/api/telegram/webhook`;

    const result = await setWebhook(webhookUrl);

    return Response.json({
      success: result.ok,
      webhookUrl,
      result,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const result = await deleteWebhook();
    return Response.json({
      success: result.ok,
      result,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const [webhookInfo, botInfo] = await Promise.all([
      getWebhookInfo(),
      getMe(),
    ]);

    return Response.json({
      success: true,
      webhook: webhookInfo,
      bot: botInfo,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
