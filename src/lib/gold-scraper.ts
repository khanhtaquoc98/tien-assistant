import { readJsonFile, writeJsonFile } from './data-store';
import axios from 'axios';
import https from 'https';

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

export interface BTMHGoldPrice {
  code: string;
  name: string;
  vendor_name: string;
  buy_price: number;
  sell_price: number;
  unit: string;
  weight: string;
  trend: string;
  trend_value: string;
  last_updated: string;
  rate_image: string | null;
}

export interface BTMHGoldData {
  prices: BTMHGoldPrice[];
  crawledAt: string;
  crawledAtMs: number;
  source: string;
}


export interface BTMCGoldPrice {
  type: string;
  buy: string;
  sell: string;
}

export interface BTMCGoldData {
  prices: BTMCGoldPrice[];
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

export function readBTMHGoldData(): BTMHGoldData | null {
  return readJsonFile<BTMHGoldData>('btmh_prices.json');
}

export function writeBTMHGoldData(data: BTMHGoldData): void {
  writeJsonFile('btmh_prices.json', data);
}

export function readBTMCGoldData(): BTMCGoldData | null {
  return readJsonFile<BTMCGoldData>('btmc_prices.json');
}

export function writeBTMCGoldData(data: BTMCGoldData): void {
  writeJsonFile('btmc_prices.json', data);
}

/**
 * Kiểm tra xem data có cần crawl lại không
 * Trả về true nếu: chưa có data HOẶC data cũ > 5 phút
 */
export function isDataStale(data: { crawledAtMs: number } | null): boolean {
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
 * Crawl giá vàng từ API baotinmanhhai
 */
export async function crawlBTMHPrices(): Promise<BTMHGoldData> {
  const query = `
  query GetGoldRates {
    goldRates {
      items {
        code
        name
        vendor_name
        buy_price
        sell_price
        unit
        weight
        trend
        trend_value
        last_updated
        rate_image
      }
      total_count
    }
  }
  `;

  try {
    const response = await axios.post('https://baotinmanhhai.vn/api/graphql', 
      { query, variables: {} },
      {
        headers: {
          'content-type': 'application/json',
          'origin': 'https://baotinmanhhai.vn',
          'referer': 'https://baotinmanhhai.vn/vi/bang-gia-vang',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      }
    );

    const json = response.data;
    const prices: BTMHGoldPrice[] = json.data?.goldRates?.items || [];
    const now = new Date();

    const goldData: BTMHGoldData = {
      prices,
      crawledAt: now.toISOString(),
      crawledAtMs: now.getTime(),
      source: 'https://baotinmanhhai.vn',
    };

    writeBTMHGoldData(goldData);

    return goldData;
  } catch (error: any) {
    throw new Error(`Failed to fetch BTMH gold prices: ${error.message}`);
  }
}

export async function getBTMHPrices(forceCrawl = false): Promise<{ data: BTMHGoldData; fromCache: boolean }> {
  const existing = readBTMHGoldData();

  if (!forceCrawl && !isDataStale(existing)) {
    return { data: existing!, fromCache: true };
  }

  const freshData = await crawlBTMHPrices();
  return { data: freshData, fromCache: false };
}

/**
 * Crawl giá vàng từ webgia (Bảo Tín Minh Châu)
 */
export async function crawlBTMCPrices(): Promise<BTMCGoldData> {
  const url = 'https://webgia.com/gia-vang/bao-tin-minh-chau/';
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const html = response.data;
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);
    
    const prices: BTMCGoldPrice[] = [];
    
    $('table.table').each((i, table) => {
      const thead = $(table).find('thead').text();
      if (thead.includes('Mua') && thead.includes('Bán')) {
        $(table).find('tbody tr').each((j, tr) => {
          const tds = $(tr).find('td');
          if (tds.length >= 3) {
            const type = $(tds[0]).text().trim();
            const buy = $(tds[1]).text().trim();
            const sell = $(tds[2]).text().trim();
            
            // Lọc các dòng fake chứa text webgia.com
            if (!buy.includes('webgia.com') && !sell.includes('webgia.com')) {
              prices.push({ type, buy, sell });
            }
          }
        });
      }
    });

    const now = new Date();
    const goldData: BTMCGoldData = {
      prices,
      crawledAt: now.toISOString(),
      crawledAtMs: now.getTime(),
      source: url,
    };

    writeBTMCGoldData(goldData);
    return goldData;
  } catch (error: any) {
    throw new Error(`Failed to fetch BTMC gold prices: ${error.message}`);
  }
}

export async function getBTMCPrices(forceCrawl = false): Promise<{ data: BTMCGoldData; fromCache: boolean }> {
  const existing = readBTMCGoldData();

  if (!forceCrawl && !isDataStale(existing)) {
    return { data: existing!, fromCache: true };
  }

  const freshData = await crawlBTMCPrices();
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

export function formatBTMHForTelegram(data: BTMHGoldData): string {
  const crawlTime = new Date(data.crawledAt).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  let msg = `💰 <b>GIÁ VÀNG HIỆN TẠI (Bảo Tín Mạnh Hải)</b>\n`;
  msg += `🕐 Cập nhật: <code>${crawlTime}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n\n`;

  for (const p of data.prices) {
    const buy = p.buy_price > 1 ? p.buy_price.toLocaleString('vi-VN') : '—';
    const sell = p.sell_price > 1 ? p.sell_price.toLocaleString('vi-VN') : '—';
    
    // Parse trend_value (e.g., "+20.000", "-10.000")
    let changeText = '';
    if (p.trend_value && p.trend_value !== "0" && p.trend_value !== "0.000") {
      const isUp = p.trend === 'up';
      const changeIcon = isUp ? '🔺' : '🔻';
      changeText = ` ${changeIcon} ${p.trend_value}`;
    }

    msg += `🥇 <b>${p.name || p.code}</b>${changeText}\n`;
    msg += `   Mua: <code>${buy}</code> | Bán: <code>${sell}</code>\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Nguồn: Bảo Tín Mạnh Hải`;

  return msg;
}

export function formatBTMCForTelegram(data: BTMCGoldData): string {
  const crawlTime = new Date(data.crawledAt).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  let msg = `💰 <b>GIÁ VÀNG HIỆN TẠI (Bảo Tín Minh Châu)</b>\n`;
  msg += `🕐 Cập nhật: <code>${crawlTime}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n\n`;

  for (const p of data.prices) {
    msg += `🥇 <b>${p.type}</b>\n`;
    msg += `   Mua: <code>${p.buy}</code> | Bán: <code>${p.sell}</code>\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Nguồn: WebGiá (BTMC)`;

  return msg;
}
