/**
 * Telegram Bot Utility
 * Handles sending messages, editing messages, setting webhooks, and processing updates
 */

import { getGoldPrices, formatGoldForTelegram } from './gold-scraper';
import { getFuelPrices, formatFuelForTelegram } from './fuel-scraper';
import { getExchangeRates, formatExchangeForTelegram } from './exchange-scraper';
import { getFootballSchedule, formatFootballForTelegram } from './football-scraper';
import { getGospel, formatGospelForTelegram } from './gospel-scraper';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    date: number;
    text?: string;
  };
}

export interface TelegramResponse {
  ok: boolean;
  result?: { message_id?: number } & Record<string, unknown>;
  description?: string;
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'your_telegram_bot_token_here') {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured in .env.local');
  }
  return token;
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  options?: {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disable_web_page_preview?: boolean;
    reply_to_message_id?: number;
  }
): Promise<TelegramResponse> {
  const token = getBotToken();
  const response = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...options }),
  });
  return response.json();
}

/**
 * Edit an existing message
 */
export async function editMessage(
  chatId: number | string,
  messageId: number,
  text: string,
  options?: {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disable_web_page_preview?: boolean;
  }
): Promise<TelegramResponse> {
  const token = getBotToken();
  const response = await fetch(`${TELEGRAM_API}${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, ...options }),
  });
  return response.json();
}

export async function setWebhook(url: string): Promise<TelegramResponse> {
  const token = getBotToken();
  const response = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, allowed_updates: ['message', 'callback_query'] }),
  });
  return response.json();
}

export async function deleteWebhook(): Promise<TelegramResponse> {
  const token = getBotToken();
  const response = await fetch(`${TELEGRAM_API}${token}/deleteWebhook`, { method: 'POST' });
  return response.json();
}

export async function getWebhookInfo(): Promise<TelegramResponse> {
  const token = getBotToken();
  const response = await fetch(`${TELEGRAM_API}${token}/getWebhookInfo`);
  return response.json();
}

export async function getMe(): Promise<TelegramResponse> {
  const token = getBotToken();
  const response = await fetch(`${TELEGRAM_API}${token}/getMe`);
  return response.json();
}

/**
 * Helper: Send "đang thu thập" → crawl → edit message with result or error
 */
async function crawlAndReply(
  chatId: number,
  label: string,
  crawlFn: () => Promise<{ msg: string; fromCache: boolean; crawledAtMs: number }>
): Promise<void> {
  // 1. Gửi message "đang thu thập..."
  const pendingRes = await sendMessage(chatId, `⏳ Hệ thống đang thu thập dữ liệu <b>${label}</b>...`, {
    parse_mode: 'HTML',
  });
  const pendingMsgId = pendingRes.result?.message_id;

  try {
    // 2. Crawl data
    const { msg, fromCache, crawledAtMs } = await crawlFn();

    // 3. Thêm info cache
    const age = Math.round((Date.now() - crawledAtMs) / 1000);
    const footer = fromCache ? `\n\n💾 <i>Từ cache (${age}s trước)</i>` : `\n\n🔄 <i>Vừa thu thập mới</i>`;
    const fullMsg = msg + footer;

    // 4. Edit message thành kết quả
    if (pendingMsgId) {
      await editMessage(chatId, pendingMsgId, fullMsg, { parse_mode: 'HTML' });
    } else {
      await sendMessage(chatId, fullMsg, { parse_mode: 'HTML' });
    }
  } catch (error) {
    // 5. Edit message thành lỗi
    const errMsg = `❌ Thu thập ${label} thất bại!\n\n<code>${(error as Error).message}</code>`;
    if (pendingMsgId) {
      await editMessage(chatId, pendingMsgId, errMsg, { parse_mode: 'HTML' });
    } else {
      await sendMessage(chatId, errMsg, { parse_mode: 'HTML' });
    }
  }
}

/**
 * Process incoming webhook update
 */
export async function processUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text;
  const username = message.from.first_name || 'User';

  if (text.startsWith('/')) {
    const command = text.split(' ')[0].split('@')[0].toLowerCase();
    const args = text.slice(text.split(' ')[0].length).trim();

    switch (command) {
      case '/start':
      case '/help':
        await sendMessage(chatId,
          `👋 Xin chào <b>${username}</b>!\n\n` +
          `Tôi là bot thông tin. Các lệnh:\n\n` +
          `💰 /giavang - Giá vàng trong nước\n` +
          `⛽ /giaxang - Giá xăng dầu PVOIL\n` +
          `💱 /ngoaite - Tỷ giá Vietcombank\n` +
          `⚽ /lichbongda - Lịch thi đấu bóng đá\n` +
          `📖 /loichuahomnay - Lời Chúa ngày hôm nay\n` +
          `❓ /help - Trợ giúp`,
          { parse_mode: 'HTML' }
        );
        break;

      case '/giavang':
        await crawlAndReply(chatId, 'Giá Vàng', async () => {
          const { data, fromCache } = await getGoldPrices();
          return { msg: formatGoldForTelegram(data), fromCache, crawledAtMs: data.crawledAtMs };
        });
        break;

      case '/giaxang':
        await crawlAndReply(chatId, 'Giá Xăng Dầu', async () => {
          const { data, fromCache } = await getFuelPrices();
          return { msg: formatFuelForTelegram(data), fromCache, crawledAtMs: data.crawledAtMs };
        });
        break;

      case '/ngoaite':
        await crawlAndReply(chatId, 'Tỷ Giá Ngoại Tệ', async () => {
          const { data, fromCache } = await getExchangeRates();
          return { msg: formatExchangeForTelegram(data), fromCache, crawledAtMs: data.crawledAtMs };
        });
        break;

      case '/lichbongda':
        await crawlAndReply(chatId, 'Lịch Thi Đấu Bóng Đá', async () => {
          const { data, fromCache } = await getFootballSchedule();
          return { msg: formatFootballForTelegram(data), fromCache, crawledAtMs: data.crawledAtMs };
        });
        break;

      case '/loichuahomnay':
        await crawlAndReply(chatId, 'Lời Chúa Hôm Nay', async () => {
          const { data, fromCache } = await getGospel();
          return { msg: formatGospelForTelegram(data), fromCache, crawledAtMs: data.crawledAtMs };
        });
        break;


      default:
        await sendMessage(chatId, `❓ Lệnh không hỗ trợ. Gõ /help để xem danh sách lệnh.`);
    }
  } else {
    await sendMessage(chatId, `📨 Bạn đã gửi: "${text}"\n\nGõ /help để xem các lệnh.`);
  }
}
