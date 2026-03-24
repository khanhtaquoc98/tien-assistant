/**
 * Telegram Webhook Route Handler
 * Receives updates from Telegram when messages are sent to the bot
 *
 * POST /api/telegram/webhook
 */

import { type NextRequest } from 'next/server';
import { processUpdate, type TelegramUpdate } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    // Process the update asynchronously
    await processUpdate(update);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 200 } // Always return 200 to Telegram to prevent retries
    );
  }
}

export async function GET() {
  return Response.json({
    status: 'active',
    message: 'Telegram webhook endpoint is running',
    timestamp: new Date().toISOString(),
  });
}
