import axios from 'axios';
import { readJsonFile, writeJsonFile } from './data-store';

const FOOTBALL_API_URL = 'https://data.bongdaplus.vn/data/lich-thi-dau-bong-da.json';
const DATA_FILENAME = 'football_schedule.json';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 tiếng

/** Raw match from bongdaplus API */
interface RawMatch {
  tournament: {
    tournament_id: string;
    tournament_name: string;
    tournament_slug: string;
    tournament_logo: string;
  };
  match_id: string;
  round_name: string;
  home_name: string;
  away_name: string;
  start_time: string;   // "2026-03-26 17:30:00"
  play_time: string;     // "17:30"
  goals_home: number;
  goals_away: number;
  status: number;        // 0 = chưa đá, 1 = đang đá, 2 = kết thúc
}

export interface FootballMatch {
  time: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  status: number;
}

export interface LeagueSchedule {
  league: string;
  date: string;         // DD/MM/YYYY
  round: string;
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
 * Lấy ngày hôm nay và ngày mai theo timezone Việt Nam (YYYY-MM-DD)
 */
function getTodayAndTomorrow(): { today: string; tomorrow: string; todayDisplay: string; tomorrowDisplay: string } {
  const now = new Date();
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

  const todayYYYY = vnNow.getFullYear();
  const todayMM = String(vnNow.getMonth() + 1).padStart(2, '0');
  const todayDD = String(vnNow.getDate()).padStart(2, '0');
  const today = `${todayYYYY}-${todayMM}-${todayDD}`;
  const todayDisplay = `${todayDD}/${todayMM}/${todayYYYY}`;

  const tmr = new Date(vnNow);
  tmr.setDate(tmr.getDate() + 1);
  const tmrYYYY = tmr.getFullYear();
  const tmrMM = String(tmr.getMonth() + 1).padStart(2, '0');
  const tmrDD = String(tmr.getDate()).padStart(2, '0');
  const tomorrow = `${tmrYYYY}-${tmrMM}-${tmrDD}`;
  const tomorrowDisplay = `${tmrDD}/${tmrMM}/${tmrYYYY}`;

  return { today, tomorrow, todayDisplay, tomorrowDisplay };
}

/**
 * Crawl lịch thi đấu bóng đá từ API bongdaplus.vn
 * Chỉ lấy dữ liệu hôm nay và ngày mai
 */
export async function crawlFootballSchedule(): Promise<FootballData> {
  const response = await axios.get<RawMatch[]>(FOOTBALL_API_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Referer': 'https://bongdaplus.vn/',
    },
    params: { _: Date.now() }, // cache buster
    timeout: 15000,
  });

  const rawMatches = response.data;
  if (!Array.isArray(rawMatches) || rawMatches.length === 0) {
    throw new Error('Không có dữ liệu lịch thi đấu từ bongdaplus.vn');
  }

  const { today, tomorrow, todayDisplay, tomorrowDisplay } = getTodayAndTomorrow();

  // Filter matches for today & tomorrow only
  const filteredMatches = rawMatches.filter((m) => {
    const matchDate = m.start_time.split(' ')[0]; // "2026-03-26"
    return matchDate === today || matchDate === tomorrow;
  });

  // Group by tournament + date
  const scheduleMap = new Map<string, LeagueSchedule>();

  for (const m of filteredMatches) {
    const matchDate = m.start_time.split(' ')[0];
    const dateDisplay = matchDate === today ? todayDisplay : tomorrowDisplay;
    const key = `${m.tournament.tournament_name}__${matchDate}`;

    let schedule = scheduleMap.get(key);
    if (!schedule) {
      const roundText = m.round_name && m.round_name !== '0' ? `Vòng ${m.round_name}` : '';
      schedule = {
        league: m.tournament.tournament_name,
        date: dateDisplay,
        round: roundText,
        matches: [],
      };
      scheduleMap.set(key, schedule);
    }

    // Determine score display
    let score = 'vs';
    if (m.status === 2) {
      score = `${m.goals_home} - ${m.goals_away}`;
    } else if (m.status === 1) {
      score = `${m.goals_home} - ${m.goals_away}`;
    }

    schedule.matches.push({
      time: m.play_time,
      homeTeam: m.home_name,
      awayTeam: m.away_name,
      score,
      status: m.status,
    });
  }

  const schedules = Array.from(scheduleMap.values());

  const now = new Date();
  const footballData: FootballData = {
    schedules,
    crawledAt: now.toISOString(),
    crawledAtMs: now.getTime(),
    source: FOOTBALL_API_URL,
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
  const { todayDisplay, tomorrowDisplay } = getTodayAndTomorrow();

  const crawlTime = new Date(data.crawledAt).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  let msg = `⚽ <b>LỊCH THI ĐẤU BÓNG ĐÁ</b>\n`;
  msg += `🕐 Cập nhật: <code>${crawlTime}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n`;

  const todaySchedules = data.schedules.filter((s) => s.date === todayDisplay);
  const tomorrowSchedules = data.schedules.filter((s) => s.date === tomorrowDisplay);

  if (todaySchedules.length > 0) {
    msg += `\n📅 <b>HÔM NAY - ${todayDisplay}</b>\n\n`;
    msg += formatDaySchedule(todaySchedules);
  }

  if (tomorrowSchedules.length > 0) {
    msg += `\n📅 <b>NGÀY MAI - ${tomorrowDisplay}</b>\n\n`;
    msg += formatDaySchedule(tomorrowSchedules);
  }

  if (todaySchedules.length === 0 && tomorrowSchedules.length === 0) {
    msg += `\n📭 Không có trận đấu nào hôm nay và ngày mai.\n`;
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
      let icon = '🕐';
      let scoreDisplay = match.score;
      if (match.status === 2) {
        icon = '✅';
        scoreDisplay = match.score;
      } else if (match.status === 1) {
        icon = '🔴';
        scoreDisplay = match.score;
      }

      msg += `  ${icon} <code>${match.time}</code>  ${match.homeTeam} <b>${scoreDisplay}</b> ${match.awayTeam}\n`;
    }
    msg += `\n`;
  }

  return msg;
}
