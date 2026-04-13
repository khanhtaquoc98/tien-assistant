/**
 * Anniversary / Love Day Tracker
 * - /ngay DD/MM/YYYY  → Lưu ngày kỷ niệm
 * - /ngay              → Xem đã bao nhiêu ngày & các mốc quan trọng
 */

import { readJsonFile, writeJsonFile } from './data-store';

const FILE_NAME = 'anniversary.json';

interface AnniversaryData {
  /** ISO date string, e.g. "2020-01-15" */
  date: string;
  /** Original input string */
  rawInput: string;
  /** Unix-ms khi lưu */
  savedAt: number;
}

/* ------------------------------------------------------------------ */
/*  Persistence                                                        */
/* ------------------------------------------------------------------ */

export function saveAnniversaryDate(dateStr: string): { success: boolean; error?: string; data?: AnniversaryData } {
  // Parse DD/MM/YYYY
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) {
    return { success: false, error: 'Định dạng sai. Vui lòng nhập theo DD/MM/YYYY.\nVí dụ: /ngay 14/02/2020' };
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { success: false, error: 'Ngày tháng năm phải là số.\nVí dụ: /ngay 14/02/2020' };
  }

  // Validate date
  const dateObj = new Date(year, month - 1, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return { success: false, error: 'Ngày không hợp lệ. Vui lòng kiểm tra lại.' };
  }

  // Cannot be in the future
  if (dateObj > new Date()) {
    return { success: false, error: 'Ngày không thể ở tương lai 😅' };
  }

  const data: AnniversaryData = {
    date: dateObj.toISOString().split('T')[0],
    rawInput: dateStr.trim(),
    savedAt: Date.now(),
  };

  writeJsonFile(FILE_NAME, data);
  return { success: true, data };
}

export function getAnniversaryDate(): AnniversaryData | null {
  return readJsonFile<AnniversaryData>(FILE_NAME);
}

/* ------------------------------------------------------------------ */
/*  Calculation helpers                                                 */
/* ------------------------------------------------------------------ */

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utcB - utcA) / msPerDay);
}

function formatDateVN(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function getDayOfWeekVN(d: Date): string {
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return days[d.getDay()];
}

/* ------------------------------------------------------------------ */
/*  Milestones                                                         */
/* ------------------------------------------------------------------ */

/** Key milestones (days) */
const MILESTONE_DAYS = [
  100, 200, 300, 365, 500, 700, 730, 1000,
  1095, 1461, 1500, 2000, 2500, 3000, 3500,
  3650, 4000, 4500, 5000, 5475, 6000, 7000,
  7300, 8000, 9000, 10000, 10950,
];

const MILESTONE_LABELS: Record<number, string> = {
  100: '💯 100 ngày',
  200: '🎊 200 ngày',
  300: '🌟 300 ngày',
  365: '🎂 1 năm',
  500: '💝 500 ngày',
  700: '🌸 700 ngày',
  730: '🎂 2 năm',
  1000: '🏆 1.000 ngày',
  1095: '🎂 3 năm',
  1461: '🎂 4 năm',
  1500: '💎 1.500 ngày',
  2000: '👑 2.000 ngày',
  2500: '🌹 2.500 ngày',
  3000: '💍 3.000 ngày',
  3500: '🎆 3.500 ngày',
  3650: '🎂 10 năm',
  4000: '🔥 4.000 ngày',
  4500: '⭐ 4.500 ngày',
  5000: '🎉 5.000 ngày',
  5475: '🎂 15 năm',
  6000: '🌙 6.000 ngày',
  7000: '🎇 7.000 ngày',
  7300: '🎂 20 năm',
  8000: '💫 8.000 ngày',
  9000: '🌈 9.000 ngày',
  10000: '🥇 10.000 ngày',
  10950: '🎂 30 năm',
};

interface MilestoneInfo {
  days: number;
  label: string;
  date: Date;
  isPast: boolean;
  isToday: boolean;
  daysUntil: number;
}

function computeMilestones(startDate: Date, today: Date): MilestoneInfo[] {
  const totalDays = daysBetween(startDate, today);

  return MILESTONE_DAYS.map((m) => {
    const mDate = addDays(startDate, m);
    const daysUntil = m - totalDays;
    return {
      days: m,
      label: MILESTONE_LABELS[m] || `📌 ${m.toLocaleString()} ngày`,
      date: mDate,
      isPast: daysUntil < 0,
      isToday: daysUntil === 0,
      daysUntil,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Monthly anniversaries                                              */
/* ------------------------------------------------------------------ */

function getMonthlyAnniversaries(startDate: Date, today: Date): { months: number; date: Date }[] {
  const results: { months: number; date: Date }[] = [];
  const startDay = startDate.getDate();

  // Calculate total months from start to today + 6 future months
  const totalMonths =
    (today.getFullYear() - startDate.getFullYear()) * 12 +
    (today.getMonth() - startDate.getMonth()) +
    6;

  for (let m = 1; m <= totalMonths; m++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + m, startDay);
    // If the day overflowed (e.g. 31 → next month), skip
    if (d.getDate() !== startDay) continue;
    results.push({ months: m, date: d });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Format for Telegram                                                */
/* ------------------------------------------------------------------ */

export function formatAnniversaryForTelegram(data: AnniversaryData): string {
  const startDate = new Date(data.date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalDays = daysBetween(startDate, today);

  const years = Math.floor(totalDays / 365);
  const remainDays = totalDays % 365;
  const months = Math.floor(remainDays / 30);
  const days = remainDays % 30;

  // Header
  let msg = `💕 <b>Tình Yêu Của Chúng Mình</b> 💕\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `📅 Ngày bắt đầu: <b>${formatDateVN(startDate)}</b> (${getDayOfWeekVN(startDate)})\n`;
  msg += `📆 Hôm nay: <b>${formatDateVN(today)}</b> (${getDayOfWeekVN(today)})\n\n`;

  // Total days highlight
  msg += `❤️ <b>Đã yêu nhau được:</b>\n`;
  msg += `🔢 <b>${totalDays.toLocaleString()}</b> ngày`;
  if (years > 0) {
    msg += `\n📊 ≈ ${years} năm`;
    if (months > 0) msg += ` ${months} tháng`;
    if (days > 0) msg += ` ${days} ngày`;
  }
  msg += `\n\n`;

  // Fun stats
  msg += `💫 <b>Những con số đáng nhớ:</b>\n`;
  msg += `⏰ ${(totalDays * 24).toLocaleString()} giờ bên nhau\n`;
  msg += `💓 ~${(totalDays * 24 * 60 * 72).toLocaleString()} nhịp tim cùng đập\n`;
  msg += `🌅 ${totalDays.toLocaleString()} bình minh cùng đón\n`;
  msg += `🌙 ${totalDays.toLocaleString()} đêm cùng mơ\n\n`;

  // Milestones
  const milestones = computeMilestones(startDate, today);

  // Milestones đã đạt (last 3)
  const pastMilestones = milestones.filter((m) => m.isPast || m.isToday);
  if (pastMilestones.length > 0) {
    msg += `🏅 <b>Mốc đã đạt được:</b>\n`;
    const showPast = pastMilestones.slice(-5);
    for (const m of showPast) {
      if (m.isToday) {
        msg += `  🎯 ${m.label} — <b>HÔM NAY!</b> 🎉\n`;
      } else {
        msg += `  ✅ ${m.label} — ${formatDateVN(m.date)}\n`;
      }
    }
    msg += `\n`;
  }

  // Upcoming milestones (next 5)
  const upcoming = milestones.filter((m) => m.daysUntil > 0).slice(0, 5);
  if (upcoming.length > 0) {
    msg += `🎯 <b>Mốc sắp tới:</b>\n`;
    for (const m of upcoming) {
      msg += `  ⏳ ${m.label} — ${formatDateVN(m.date)} (${getDayOfWeekVN(m.date)}) — còn <b>${m.daysUntil}</b> ngày\n`;
    }
    msg += `\n`;
  }

  // Monthly anniversaries (next 3 upcoming)
  const monthlyAll = getMonthlyAnniversaries(startDate, today);
  const upcomingMonthly = monthlyAll.filter((m) => m.date >= today).slice(0, 3);
  if (upcomingMonthly.length > 0) {
    msg += `📆 <b>Kỷ niệm hằng tháng sắp tới:</b>\n`;
    for (const m of upcomingMonthly) {
      const daysUntil = daysBetween(today, m.date);
      const yearCount = Math.floor(m.months / 12);
      const monthCount = m.months % 12;
      let label = '';
      if (yearCount > 0 && monthCount === 0) {
        label = `${yearCount} năm`;
      } else if (yearCount > 0) {
        label = `${yearCount} năm ${monthCount} tháng`;
      } else {
        label = `${m.months} tháng`;
      }
      const prefix = daysUntil === 0 ? '🎉' : '💐';
      msg += `  ${prefix} ${label} — ${formatDateVN(m.date)} (${getDayOfWeekVN(m.date)})`;
      if (daysUntil === 0) {
        msg += ` — <b>HÔM NAY!</b>`;
      } else {
        msg += ` — còn <b>${daysUntil}</b> ngày`;
      }
      msg += `\n`;
    }
    msg += `\n`;
  }

  // Yearly anniversaries (next 3)
  msg += `🎂 <b>Sinh nhật tình yêu:</b>\n`;
  const currentAnniversaryYear = years + 1;
  for (let i = 0; i < 3; i++) {
    const yr = currentAnniversaryYear + i;
    const annivDate = new Date(startDate.getFullYear() + yr, startDate.getMonth(), startDate.getDate());
    const daysUntilAnniv = daysBetween(today, annivDate);
    if (daysUntilAnniv >= 0) {
      msg += `  🎈 Năm thứ ${yr} — ${formatDateVN(annivDate)} (${getDayOfWeekVN(annivDate)}) — còn <b>${daysUntilAnniv}</b> ngày\n`;
    }
  }

  msg += `\n━━━━━━━━━━━━━━━━━━\n`;
  msg += `💑 <i>Mỗi ngày bên nhau là một kỷ niệm đẹp!</i>`;

  return msg;
}
