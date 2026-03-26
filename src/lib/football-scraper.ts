import axios from 'axios';
import * as cheerio from 'cheerio';
import { readJsonFile, writeJsonFile } from './data-store';

const FOOTBALL_URL = 'https://bongdaplus.vn/lich-thi-dau-bong-da';
const DATA_FILENAME = 'football_schedule.json';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 tiếng

export interface FootballMatch {
  time: string;
  homeTeam: string;
  awayTeam: string;
  score: string; // "vs" hoặc tỉ số nếu đã đấu
}

export interface LeagueSchedule {
  league: string;
  date: string;
  round: string; // e.g. "Vòng 5"
  matches: FootballMatch[];
}

export interface FootballData {
  schedules: LeagueSchedule[];
  crawledAt: string;
  crawledAtMs: number;
  source: string;
}

export function readFootballData(): FootballData | null {
  return readJsonFile<FootballData>(DATA_FILENAME);
}

export function writeFootballData(data: FootballData): void {
  writeJsonFile(DATA_FILENAME, data);
}

export function isFootballDataStale(data: FootballData | null): boolean {
  if (!data) return true;
  return Date.now() - data.crawledAtMs > CACHE_DURATION_MS;
}

/**
 * Lấy ngày hôm nay và ngày mai theo timezone Việt Nam (DD/MM/YYYY)
 */
function getTodayAndTomorrow(): { today: string; tomorrow: string } {
  const now = new Date();
  // Chuyển sang timezone Việt Nam (+7)
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

  const todayDD = String(vnNow.getDate()).padStart(2, '0');
  const todayMM = String(vnNow.getMonth() + 1).padStart(2, '0');
  const todayYYYY = vnNow.getFullYear();
  const today = `${todayDD}/${todayMM}/${todayYYYY}`;

  const tmr = new Date(vnNow);
  tmr.setDate(tmr.getDate() + 1);
  const tmrDD = String(tmr.getDate()).padStart(2, '0');
  const tmrMM = String(tmr.getMonth() + 1).padStart(2, '0');
  const tmrYYYY = tmr.getFullYear();
  const tomorrow = `${tmrDD}/${tmrMM}/${tmrYYYY}`;

  return { today, tomorrow };
}

/**
 * Crawl lịch thi đấu bóng đá từ bongdaplus.vn
 * Chỉ lấy dữ liệu hôm nay và ngày mai
 */
export async function crawlFootballSchedule(): Promise<FootballData> {
  const response = await axios.get(FOOTBALL_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);
  const { today, tomorrow } = getTodayAndTomorrow();
  const targetDates = [today, tomorrow];

  const schedules: LeagueSchedule[] = [];
  let currentLeague = '';
  let currentDate = '';
  let currentRound = '';

  // Iterate through all children inside the fixt-list container
  const container = $('#tblTnms .fixt-list');
  if (!container.length) {
    throw new Error('Không tìm thấy bảng lịch thi đấu trên bongdaplus.vn');
  }

  container.children().each((_, el) => {
    const $el = $(el);

    // League header: div.fx-leag > a.all-cap > b
    if ($el.hasClass('fx-leag')) {
      currentLeague = $el.find('a.all-cap b').text().trim();
      return; // continue
    }

    // Date header: div.fx-date
    if ($el.hasClass('fx-date')) {
      const dateText = $el.text().trim();
      // Extract date from "Vòng 5 - Ngày 26/03/2026" or "Ngày 26/03/2026"
      const dateMatch = dateText.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (dateMatch) {
        currentDate = dateMatch[1];
      }
      // Extract round info
      const roundMatch = dateText.match(/(Vòng\s+\S+)/);
      currentRound = roundMatch ? roundMatch[1] : '';
      return; // continue
    }

    // Match row: a.fx-match
    if ($el.hasClass('fx-match')) {
      // Only keep matches for today or tomorrow
      if (!targetDates.includes(currentDate)) return;

      const time = $el.find('.mch-time b').text().trim();
      const homeTeam = $el.find('.mch-home').text().trim();
      const awayTeam = $el.find('.mch-away').text().trim();
      const score = $el.find('.mch-score').text().trim();

      if (homeTeam && awayTeam) {
        // Find or create league schedule entry
        let leagueEntry = schedules.find(
          (s) => s.league === currentLeague && s.date === currentDate
        );
        if (!leagueEntry) {
          leagueEntry = {
            league: currentLeague,
            date: currentDate,
            round: currentRound,
            matches: [],
          };
          schedules.push(leagueEntry);
        }
        leagueEntry.matches.push({ time, homeTeam, awayTeam, score });
      }
    }
  });

  if (schedules.length === 0) {
    throw new Error(`Không tìm thấy trận đấu nào cho ngày ${today} hoặc ${tomorrow}`);
  }

  const now = new Date();
  const footballData: FootballData = {
    schedules,
    crawledAt: now.toISOString(),
    crawledAtMs: now.getTime(),
    source: FOOTBALL_URL,
  };

  writeFootballData(footballData);
  return footballData;
}

/**
 * Lấy lịch bóng đá - cache 1 tiếng
 */
export async function getFootballSchedule(
  forceCrawl = false
): Promise<{ data: FootballData; fromCache: boolean }> {
  const existing = readFootballData();
  if (!forceCrawl && !isFootballDataStale(existing)) {
    return { data: existing!, fromCache: true };
  }
  const freshData = await crawlFootballSchedule();
  return { data: freshData, fromCache: false };
}

/**
 * Format lịch bóng đá cho Telegram message
 */
export function formatFootballForTelegram(data: FootballData): string {
  const { today, tomorrow } = getTodayAndTomorrow();

  const crawlTime = new Date(data.crawledAt).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  let msg = `⚽ <b>LỊCH THI ĐẤU BÓNG ĐÁ</b>\n`;
  msg += `🕐 Cập nhật: <code>${crawlTime}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n`;

  // Group by date
  const todaySchedules = data.schedules.filter((s) => s.date === today);
  const tomorrowSchedules = data.schedules.filter((s) => s.date === tomorrow);

  if (todaySchedules.length > 0) {
    msg += `\n📅 <b>HÔM NAY - ${today}</b>\n\n`;
    msg += formatDaySchedule(todaySchedules);
  }

  if (tomorrowSchedules.length > 0) {
    msg += `\n📅 <b>NGÀY MAI - ${tomorrow}</b>\n\n`;
    msg += formatDaySchedule(tomorrowSchedules);
  }

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Nguồn: Bongdaplus.vn`;

  return msg;
}

function formatDaySchedule(schedules: LeagueSchedule[]): string {
  let msg = '';

  for (const schedule of schedules) {
    const roundText = schedule.round ? ` (${schedule.round})` : '';
    msg += `🏆 <b>${schedule.league}</b>${roundText}\n`;

    for (const match of schedule.matches) {
      const timeIcon = match.score === 'vs' ? '🕐' : '✅';
      const scoreDisplay = match.score === 'vs' ? 'vs' : match.score;
      msg += `  ${timeIcon} <code>${match.time}</code>  ${match.homeTeam} <b>${scoreDisplay}</b> ${match.awayTeam}\n`;
    }
    msg += `\n`;
  }

  return msg;
}
