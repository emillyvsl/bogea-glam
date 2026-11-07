export const salonHours = Object.fromEntries([0,1,2,3,4,5,6].map(day => [day, day < 2 ? null : { open: 480, close: day === 5 ? 1140 : day === 6 ? 960 : 1080, lunchStart: 720, lunchEnd: 780 }]));

export function localNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Rio_Branco', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) === date;
}
export function planAppointment(date, start, duration, now = new Date(), configuredHours = salonHours, professionalHours = null) {
  if (!validDate(date) || !Number.isInteger(start) || start % 60 || !Number.isInteger(duration) || duration <= 0) return null;
  const current = localNow(now);
  if (date < current.date || (date === current.date && start <= current.minute)) return null;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const hours = configuredHours[day];
  const own = professionalHours ? professionalHours[day] : hours;
  if (!hours || !own) return null;
  const open = Math.max(hours.open, own.open), close = Math.min(hours.close, own.close);
  const pauses = [hours, own].filter(h => h.lunchStart != null).map(h => ({ start: h.lunchStart, end: h.lunchEnd })).sort((a,b) => a.start - b.start);
  const merged = [];
  for (const pause of pauses) {
    const last = merged.at(-1);
    if (last && pause.start <= last.end) last.end = Math.max(last.end, pause.end);
    else merged.push({ ...pause });
  }
  if (start < open || start >= close || merged.some(p => start >= p.start && start < p.end)) return null;
  const segments = [];
  let cursor = start, remaining = duration;
  for (const pause of merged) {
    if (pause.end <= cursor || pause.start >= close) continue;
    if (cursor + remaining <= pause.start) break;
    if (cursor < pause.start) {
      segments.push({ start: cursor, end: pause.start });
      remaining -= pause.start - cursor;
    }
    cursor = pause.end;
  }
  const end = cursor + remaining;
  segments.push({ start: cursor, end });
  return end <= close ? { start, end, segments } : null;
}
export const minutesToTime = minutes => `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
