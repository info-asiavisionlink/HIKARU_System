/** Returns YYYY-MM-DD in Asia/Tokyo timezone (safe on Vercel UTC servers and browsers). */
export function getJSTDateString(date?: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(date ?? new Date())
}
