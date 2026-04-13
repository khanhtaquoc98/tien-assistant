/**
 * Cron Job: Daily Anniversary Notification
 *
 * GET /api/cron/anniversary
 * Vercel Cron triggers this at 00:00 UTC+7 (17:00 UTC) daily.
 * Sends the anniversary summary to TELEGRAM_CHAT_ID.
 */

import { type NextRequest } from 'next/server';
import { getAnniversaryDate, formatAnniversaryForTelegram } from '@/lib/anniversary';
import { sendMessage } from '@/lib/telegram';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sets this header automatically)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const chatId = process.env.TELEGRAM_CHAT_ID || '8429266599';

    const data = getAnniversaryDate();
    if (!data) {
      return Response.json({
        success: true,
        message: 'No anniversary date saved, skipping notification.',
      });
    }

    const msg = formatAnniversaryForTelegram(data);

    // Add morning greeting header
    const now = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
    );
    const hours = now.getHours();
    let greeting = '🌅 Chào buổi sáng!';
    if (hours >= 12 && hours < 18) greeting = '☀️ Chào buổi chiều!';
    else if (hours >= 18 || hours < 5) greeting = '🌙 Chào buổi tối!';

    const fullMsg = `${greeting}\n\n${msg}`;

    const result = await sendMessage(chatId, fullMsg, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    return Response.json({
      success: true,
      message: 'Anniversary notification sent',
      telegramResult: result,
    });
  } catch (error) {
    console.error('Cron anniversary error:', error);
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
