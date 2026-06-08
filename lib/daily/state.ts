export interface DailyResultEntry { day: number; stars: number; timeMs: number; clicks: number }
export interface DailyState { lastDay: number | null; streak: number; maxStreak: number; history: DailyResultEntry[] }

export function emptyDailyState(): DailyState {
  return { lastDay: null, streak: 0, maxStreak: 0, history: [] }
}
export function recordDaily(state: DailyState, result: DailyResultEntry): DailyState {
  if (state.lastDay === result.day) return state
  const streak = state.lastDay !== null && result.day === state.lastDay + 1 ? state.streak + 1 : 1
  const maxStreak = Math.max(state.maxStreak, streak)
  return { lastDay: result.day, streak, maxStreak, history: [...state.history, result] }
}
