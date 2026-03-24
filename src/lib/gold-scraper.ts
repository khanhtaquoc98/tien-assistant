import { readJsonFile, writeJsonFile } from './data-store';

const GOLD_API_URL = 'https://api.mihong.vn/v1/gold-prices?market=domestic';
const DATA_FILENAME = 'gold_prices.json';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 phút

export interface GoldPrice {
  buyingPrice: number;
  sellingPrice: number;
  code: string;
  sellChange: number;
  sellChangePercent: number;
  buyChange: number;
  buyChangePercent: number;
  dateTime: string;
}

export interface GoldData {
  prices: GoldPrice[];
  crawledAt: string;
  crawledAtMs: number;
  source: string;
}

export function readGoldData(): GoldData | null {
  return readJsonFile<GoldData>(DATA_FILENAME);
}

export function writeGoldData(data: GoldData): void {
  writeJsonFile(DATA_FILENAME, data);
}

/**
 * Kiểm tra xem data có cần crawl lại không
 * Trả về true nếu: chưa có data HOẶC data cũ > 5 phút
 */
export function isDataStale(data: GoldData | null): boolean {
  if (!data) return true;
  const now = Date.now();
  return now - data.crawledAtMs > CACHE_DURATION_MS;
}

/**
 * Crawl giá vàng từ API mihong.vn
 */
export async function crawlGoldPrices(): Promise<GoldData> {
  const response = await fetch(GOLD_API_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    // Không cache
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch gold prices: ${response.status} ${response.statusText}`);
  }

  const prices: GoldPrice[] = await response.json();
  const now = new Date();

  const goldData: GoldData = {
    prices,
    crawledAt: now.toISOString(),
    crawledAtMs: now.getTime(),
    source: GOLD_API_URL,
  };

  // Lưu vào file
  writeGoldData(goldData);

  return goldData;
}

/**
 * Lấy giá vàng - nếu cache còn mới thì trả về, ngược lại crawl lại
 * Đây là function chính để dùng cho Telegram command /giavang
 */
export async function getGoldPrices(forceCrawl = false): Promise<{ data: GoldData; fromCache: boolean }> {
  const existing = readGoldData();

  if (!forceCrawl && !isDataStale(existing)) {
    return { data: existing!, fromCache: true };
  }

  // Crawl mới
  const freshData = await crawlGoldPrices();
  return { data: freshData, fromCache: false };
}

/**
 * Cập nhật (edit) giá vàng trong file JSON
 */
export function updateGoldPrice(code: string, updates: Partial<GoldPrice>): GoldData | null {
  const data = readGoldData();
  if (!data) return null;

  const idx = data.prices.findIndex((p) => p.code === code);
  if (idx === -1) return null;

  data.prices[idx] = { ...data.prices[idx], ...updates };
  writeGoldData(data);

  return data;
}

/**
 * Format giá vàng cho Telegram message
 */
export function formatGoldForTelegram(data: GoldData): string {
  const crawlTime = new Date(data.crawledAt).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  let msg = `💰 <b>GIÁ VÀNG HIỆN TẠI</b>\n`;
  msg += `🕐 Cập nhật: <code>${crawlTime}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n\n`;

  for (const p of data.prices) {
    const buy = p.buyingPrice.toLocaleString('vi-VN');
    const sell = p.sellingPrice > 0 ? p.sellingPrice.toLocaleString('vi-VN') : '—';
    const changeIcon = p.buyChange > 0 ? '🔺' : p.buyChange < 0 ? '🔻' : '➖';
    const changeText = p.buyChange !== 0
      ? ` ${changeIcon} ${Math.abs(p.buyChange).toLocaleString('vi-VN')} (${p.buyChangePercent}%)`
      : '';

    msg += `🥇 <b>${p.code}</b>${changeText}\n`;
    msg += `   Mua: <code>${buy}</code> | Bán: <code>${sell}</code>\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Nguồn: Mi Hồng`;

  return msg;
}
