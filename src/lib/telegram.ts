/**
 * Telegram Bot Utility
 * Handles sending messages, editing messages, setting webhooks, and processing updates
 */

import { getGoldPrices, formatGoldForTelegram } from './gold-scraper';
import { getFuelPrices, formatFuelForTelegram } from './fuel-scraper';
import { getExchangeRates, formatExchangeForTelegram } from './exchange-scraper';
import { getFootballSchedule, formatFootballForTelegram } from './football-scraper';
import { getGospel, formatGospelForTelegram } from './gospel-scraper';
import { saveAnniversaryDate, getAnniversaryDate, formatAnniversaryForTelegram } from './anniversary';
import {
  registerTracking,
  getTrackingInfo,
  formatTrackingForTelegram,
  STATUS_MAP,
  translateEventDescriptionVi,
  translateSubStatusVi,
} from './tracking-service';
import {
  subscribeChatToOrder,
  getOrdersForChat,
  unsubscribeChatFromOrder,
} from './tracking-store';

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
          `📦 /don-hang [mã] - Quét & theo dõi đơn hàng (17TRACK)\n` +
          `📋 /ds-donhang - Danh sách đơn hàng đang theo dõi\n` +
          `💰 /giavang - Giá vàng Mi Hồng\n` +
          `⛽ /giaxang - Giá xăng dầu PVOIL\n` +
          `💱 /ngoaite - Tỷ giá Vietcombank\n` +
          `⚽ /lichbongda - Lịch thi đấu bóng đá\n` +
          `📖 /loichuahomnay - Lời Chúa ngày hôm nay\n` +
          `💕 /ngay - Xem/lưu ngày kỷ niệm tình yêu\n` +
          `❓ /help - Trợ giúp`,
          { parse_mode: 'HTML' }
        );
        break;

      case '/giavang':
        await crawlAndReply(chatId, 'Giá Vàng Mi Hồng', async () => {
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

      case '/ngay': {
        if (args) {
          // /ngay DD/MM/YYYY → lưu ngày
          const result = saveAnniversaryDate(args);
          if (result.success && result.data) {
            const d = new Date(result.data.date);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            await sendMessage(
              chatId,
              `💕 Đã lưu ngày kỷ niệm: <b>${dd}/${mm}/${yyyy}</b>\n\n` +
              `Gõ /ngay để xem thông tin chi tiết 💝`,
              { parse_mode: 'HTML' }
            );
          } else {
            await sendMessage(
              chatId,
              `❌ ${result.error}`,
              { parse_mode: 'HTML' }
            );
          }
        } else {
          // /ngay → xem thông tin
          const data = getAnniversaryDate();
          if (!data) {
            await sendMessage(
              chatId,
              `💕 Chưa có ngày kỷ niệm nào được lưu.\n\n` +
              `Hãy gõ: /ngay DD/MM/YYYY\n` +
              `Ví dụ: /ngay 14/02/2020`,
              { parse_mode: 'HTML' }
            );
          } else {
            const msg = formatAnniversaryForTelegram(data);
            await sendMessage(chatId, msg, { parse_mode: 'HTML' });
          }
        }
        break;
      }

      case '/don-hang':
      case '/donhang': {
        if (!args) {
          // No tracking number provided -> show list of tracked orders or help
          const userOrders = getOrdersForChat(chatId);
          if (userOrders.length > 0) {
            let msg = `📦 <b>DANH SÁCH ĐƠN HÀNG BẠN ĐANG THEO DÕI:</b>\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            for (const ord of userOrders) {
              const meta = ord.lastStatus ? STATUS_MAP[ord.lastStatus] : null;
              const statusLabel = meta?.label || ord.lastStatus || 'Đang cập nhật';
              const statusIcon = meta?.icon || '📍';
              msg += `🔖 Mã: <code>${ord.number}</code>\n`;
              if (ord.carrierName) msg += `🏢 Hãng: <b>${ord.carrierName}</b>\n`;
              msg += `${statusIcon} Trạng thái: <b>${statusLabel}</b>\n`;
              if (ord.lastSubStatus) msg += `ℹ️ Chi tiết: <i>${translateSubStatusVi(ord.lastSubStatus)}</i>\n`;
              if (ord.lastEventDesc) msg += `📝 Diễn biến: <i>${translateEventDescriptionVi(ord.lastEventDesc)}</i>\n`;
              msg += `\n`;
            }
            msg += `💡 Để thêm đơn mới: <code>/don-hang &lt;mã vận đơn&gt;</code>\n`;
            msg += `💡 Để hủy theo dõi: <code>/huy-donhang &lt;mã vận đơn&gt;</code>`;
            await sendMessage(chatId, msg, { parse_mode: 'HTML' });
          } else {
            await sendMessage(
              chatId,
              `📦 <b>Tra cứu & Tự động theo dõi đơn hàng</b>\n\n` +
              `Cú pháp:\n` +
              `<code>/don-hang &lt;mã vận đơn&gt;</code>\n\n` +
              `Ví dụ:\n` +
              `<code>/don-hang SPX123456789VN</code>\n` +
              `<code>/don-hang TEST123456789</code>\n\n` +
              `✨ <b>Cơ chế hoạt động:</b>\n` +
              `1. Hệ thống tự quét nhà vận chuyển (Carrier) qua 17TRACK\n` +
              `2. Đăng ký theo dõi và hiển thị thông tin tức thời\n` +
              `3. Tự động nhận Webhook khi bưu tá giao hàng hoặc có cập nhật mới!`,
              { parse_mode: 'HTML' }
            );
          }
          break;
        }

        // Tracking number is provided
        const trackingNumber = args.trim().split(/\s+/)[0];

        // 1. Send pending notification
        const pendingRes = await sendMessage(
          chatId,
          `⏳ Đang quét nhà vận chuyển & đăng ký theo dõi đơn hàng <b>${trackingNumber}</b>...`,
          { parse_mode: 'HTML' }
        );
        const pendingMsgId = pendingRes.result?.message_id;

        try {
          // 2. Register tracking number with 17TRACK (auto carrier detection)
          const regResult = await registerTracking(trackingNumber);

          if (!regResult.success && !regResult.alreadyRegistered) {
            const errorText = `❌ <b>Không thể đăng ký đơn hàng:</b> <code>${trackingNumber}</code>\n\n${regResult.error || 'Vui lòng kiểm tra lại mã vận đơn.'}`;
            if (pendingMsgId) {
              await editMessage(chatId, pendingMsgId, errorText, { parse_mode: 'HTML' });
            } else {
              await sendMessage(chatId, errorText, { parse_mode: 'HTML' });
            }
            break;
          }

          // 3. Query current tracking information (with auto-retry if 17TRACK is synchronizing first-time)
          let trackInfo = await getTrackingInfo(trackingNumber, regResult.carrier);

          if (!trackInfo.success || trackInfo.status === 'NotFound') {
            // Wait 2.5s and retry once as 17TRACK needs a few seconds to query external carrier API
            await new Promise((resolve) => setTimeout(resolve, 2500));
            const retryInfo = await getTrackingInfo(trackingNumber, regResult.carrier);
            if (retryInfo.success && retryInfo.status !== 'NotFound') {
              trackInfo = retryInfo;
            }
          }

          if (!trackInfo.success) {
            // Still subscribe chat so when carrier registers/updates via webhook, user is alerted
            subscribeChatToOrder(trackingNumber, chatId, {
              carrier: regResult.carrier,
              carrierName: regResult.carrierName,
            });

            const syncMsg =
              `📦 <b>ĐÃ ĐĂNG KÝ THEO DÕI:</b> <code>${trackingNumber}</code>\n\n` +
              `🏢 Hãng vận chuyển: <b>${regResult.carrierName || 'Tự động nhận diện'}</b>\n` +
              `⏳ <b>Trạng thái:</b> <i>17TRACK vừa tiếp nhận đơn và đang đồng bộ dữ liệu với hãng vận chuyển (thường mất 10-30 giây).</i>\n\n` +
              `👉 <b>Bạn có thể:</b>\n` +
              `• Gõ lại <code>/don-hang ${trackingNumber}</code> sau ít giây để xem hành trình\n` +
              `• Hoặc chờ Webhook tự động bắn tin nhắn khi hoàn tất!`;

            if (pendingMsgId) {
              await editMessage(chatId, pendingMsgId, syncMsg, { parse_mode: 'HTML' });
            } else {
              await sendMessage(chatId, syncMsg, { parse_mode: 'HTML' });
            }
            break;
          }

          // 4. Save subscriber and order state
          subscribeChatToOrder(trackingNumber, chatId, {
            carrier: trackInfo.carrier,
            carrierName: trackInfo.carrierName,
            lastStatus: trackInfo.status,
            lastSubStatus: trackInfo.subStatus,
            lastEventTime: trackInfo.latestEvent?.time,
            lastEventDesc: trackInfo.latestEvent?.description,
            lastEventLocation: trackInfo.latestEvent?.location,
          });

          // 5. Format and reply
          const formattedMsg = formatTrackingForTelegram(trackInfo);
          if (pendingMsgId) {
            await editMessage(chatId, pendingMsgId, formattedMsg, { parse_mode: 'HTML' });
          } else {
            await sendMessage(chatId, formattedMsg, { parse_mode: 'HTML' });
          }
        } catch (trackError) {
          const errText = `❌ <b>Lỗi xử lý đơn hàng:</b> <code>${(trackError as Error).message}</code>`;
          if (pendingMsgId) {
            await editMessage(chatId, pendingMsgId, errText, { parse_mode: 'HTML' });
          } else {
            await sendMessage(chatId, errText, { parse_mode: 'HTML' });
          }
        }
        break;
      }

      case '/ds-donhang':
      case '/dsdonhang': {
        const userOrders = getOrdersForChat(chatId);
        if (userOrders.length === 0) {
          await sendMessage(
            chatId,
            `📦 Bạn chưa theo dõi đơn hàng nào.\n\nHãy dùng lệnh: <code>/don-hang &lt;mã vận đơn&gt;</code>`,
            { parse_mode: 'HTML' }
          );
        } else {
          let msg = `📦 <b>DANH SÁCH ĐƠN HÀNG ĐANG THEO DÕI (${userOrders.length})</b>\n`;
          msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
          for (let i = 0; i < userOrders.length; i++) {
            const ord = userOrders[i];
            const meta = ord.lastStatus ? STATUS_MAP[ord.lastStatus] : null;
            const statusLabel = meta?.label || ord.lastStatus || 'Đang cập nhật';
            const statusIcon = meta?.icon || '📍';
            msg += `${i + 1}. 🔖 <code>${ord.number}</code>\n`;
            if (ord.carrierName) msg += `   🏢 Hãng: <b>${ord.carrierName}</b>\n`;
            msg += `   ${statusIcon} Trạng thái: <b>${statusLabel}</b>\n`;
            if (ord.lastSubStatus) msg += `   ℹ️ Chi tiết: <i>${translateSubStatusVi(ord.lastSubStatus)}</i>\n`;
            if (ord.lastEventDesc) msg += `   📝 Diễn biến: <i>${translateEventDescriptionVi(ord.lastEventDesc)}</i>\n`;
            msg += `\n`;
          }
          msg += `💡 Để kiểm tra lại một đơn: <code>/don-hang &lt;mã&gt;</code>\n`;
          msg += `💡 Để hủy theo dõi: <code>/huy-donhang &lt;mã&gt;</code>`;
          await sendMessage(chatId, msg, { parse_mode: 'HTML' });
        }
        break;
      }

      case '/huy-donhang':
      case '/huydonhang': {
        if (!args) {
          await sendMessage(
            chatId,
            `ℹ️ Vui lòng cung cấp mã đơn hàng cần hủy theo dõi.\n\nVí dụ: <code>/huy-donhang TEST123456789</code>`,
            { parse_mode: 'HTML' }
          );
        } else {
          const targetNumber = args.trim().split(/\s+/)[0];
          const removed = unsubscribeChatFromOrder(targetNumber, chatId);
          if (removed) {
            await sendMessage(
              chatId,
              `✅ Đã hủy theo dõi đơn hàng <code>${targetNumber}</code>. Bạn sẽ không nhận thêm thông báo về đơn này nữa.`,
              { parse_mode: 'HTML' }
            );
          } else {
            await sendMessage(
              chatId,
              `⚠️ Không tìm thấy đơn hàng <code>${targetNumber}</code> trong danh sách theo dõi của bạn.`,
              { parse_mode: 'HTML' }
            );
          }
        }
        break;
      }

      default:
        await sendMessage(chatId, `❓ Lệnh không hỗ trợ. Gõ /help để xem danh sách lệnh.`);
    }
  } else {
    await sendMessage(chatId, `📨 Bạn đã gửi: "${text}"\n\nGõ /help để xem các lệnh.`);
  }
}
