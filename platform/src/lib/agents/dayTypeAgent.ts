export type DayType = 'photo' | 'video';

// 4 photo days, 3 video days per week.
// Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4, Saturday=5, Sunday=6
const WEEK_SCHEDULE: DayType[] = [
  'photo',  // Monday
  'photo',  // Tuesday
  'video',  // Wednesday
  'photo',  // Thursday
  'video',  // Friday
  'photo',  // Saturday
  'video',  // Sunday
];

export function decideDayType(date: Date = new Date()): DayType {
  // Allow manual override from env (set by workflow_dispatch input or local testing)
  const override = (process.env.DAY_TYPE_OVERRIDE ?? '').toLowerCase();
  if (override === 'video') return 'video';
  if (override === 'photo') return 'photo';

  // getDay(): 0=Sunday … 6=Saturday — convert to Monday-indexed
  const sundayIndexed = date.getDay();
  const mondayIndexed = (sundayIndexed + 6) % 7;
  return WEEK_SCHEDULE[mondayIndexed];
}
