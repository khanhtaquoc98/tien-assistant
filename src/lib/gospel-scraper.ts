import axios from 'axios';
import * as cheerio from 'cheerio';
import { readJsonFile, writeJsonFile } from './data-store';

const DATA_FILENAME = 'gospel_data.json';

export interface GospelData {
  gospelText: string;
  crawledAtDay: string; // YYYY-MM-DD
  crawledAtMs: number;
  source: string;
}

export function readGospelData(): GospelData | null {
  return readJsonFile<GospelData>(DATA_FILENAME);
}

export function writeGospelData(data: GospelData): void {
  writeJsonFile(DATA_FILENAME, data);
}

/**
 * Lấy ngày hôm nay theo timezone Việt Nam (YYYY/MM/DD) cho URL và (YYYY-MM-DD) cho Cache
 */
function getTodayInfo(): { dateUrl: string; dateCache: string; displayDate: string } {
  const now = new Date();
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

  const yyyy = vnNow.getFullYear();
  const mm = String(vnNow.getMonth() + 1).padStart(2, '0');
  const dd = String(vnNow.getDate()).padStart(2, '0');

  // Cho vaticannews URL: /2026/03/30.html
  const dateUrl = `${yyyy}/${mm}/${dd}`;
  const dateCache = `${yyyy}-${mm}-${dd}`;
  const displayDate = `${dd}/${mm}/${yyyy}`;

  return { dateUrl, dateCache, displayDate };
}

export function isGospelDataStale(data: GospelData | null): boolean {
  if (!data) return true;
  const { dateCache } = getTodayInfo();
  // Nếu ngày khác hôm nay thì stale
  return data.crawledAtDay !== dateCache;
}

export async function crawlGospel(): Promise<GospelData> {
  const { dateUrl, dateCache } = getTodayInfo();
  const url = `https://www.vaticannews.va/vi/loi-chua-hang-ngay/${dateUrl}.html`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    let rawText = '';

    $('section.section--evidence').each((i, el) => {
      if ($(el).find('h2').text().includes('Tin Mừng')) {
        const content = $(el).find('.section__content');
        
        content.find('p').each((idx, pEl) => {
          // Loại bỏ các thẻ <sup> (chứa số câu) để nội dung đọc liền mạch hơn
          $(pEl).find('sup').remove();
          
          const text = $(pEl).text().trim();
          // Skip generic footer lines
          if (text && !text.includes('GÓP Ý CẢI THIỆN') && !text.includes('LINK FORM')) {
             rawText += text + '\n\n';
          }
        });
      }
    });

    rawText = rawText.trim();

    if (!rawText) {
      throw new Error('Đã tải trang nhưng không tìm thấy nội dung "Tin Mừng".');
    }

    const gospelData: GospelData = {
      gospelText: rawText,
      crawledAtDay: dateCache,
      crawledAtMs: Date.now(),
      source: url,
    };

    writeGospelData(gospelData);
    return gospelData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      throw new Error(`Chưa có trang tin mừng cho ngày hôm nay (${dateUrl}) trên VaticanNews.`);
    }
    throw error;
  }
}

export async function getGospel(forceCrawl = false): Promise<{ data: GospelData; fromCache: boolean }> {
  const existing = readGospelData();
  if (!forceCrawl && !isGospelDataStale(existing)) {
    return { data: existing!, fromCache: true };
  }
  const freshData = await crawlGospel();
  return { data: freshData, fromCache: false };
}

export function formatGospelForTelegram(data: GospelData): string {
  const { displayDate } = getTodayInfo();

  let msg = `📖 <b>TIN MỪNG NGÀY HÔM NAY</b>\n`;
  msg += `📅 Ngày: <b>${displayDate}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `${data.gospelText}\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `🕊 Nguồn: Vatican News`;

  return msg;
}
