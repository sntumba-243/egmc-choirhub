export interface PracticeLog {
  id: string;
  userId: string;
  songId: string;
  songTitle: string;
  date: string;
  duration: number;
  speedUsed: string;
  notes?: string;
}

const STORAGE_KEY = 'choir_practice_logs';

export const practiceLogService = {
  getLogs(userId?: string): PracticeLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const logs: PracticeLog[] = data ? JSON.parse(data) : [];
      return userId ? logs.filter(log => log.userId === userId) : logs;
    } catch {
      return [];
    }
  },

  addLog(log: Omit<PracticeLog, 'id'>): PracticeLog {
    const logs = this.getLogs();
    const newLog: PracticeLog = {
      ...log,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };
    logs.push(newLog);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    return newLog;
  },

  getWeeklyTotal(userId: string): number {
    const logs = this.getLogs(userId);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return logs
      .filter(log => new Date(log.date) >= weekAgo)
      .reduce((total, log) => total + log.duration, 0);
  },

  getMonthlyTotal(userId: string): number {
    const logs = this.getLogs(userId);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    return logs
      .filter(log => new Date(log.date) >= monthAgo)
      .reduce((total, log) => total + log.duration, 0);
  },

  getMostPracticedSong(userId: string): { songId: string; songTitle: string; count: number } | null {
    const logs = this.getLogs(userId);
    if (logs.length === 0) return null;

    const songCounts = logs.reduce((acc, log) => {
      if (!acc[log.songId]) {
        acc[log.songId] = { songId: log.songId, songTitle: log.songTitle, count: 0 };
      }
      acc[log.songId].count++;
      return acc;
    }, {} as Record<string, { songId: string; songTitle: string; count: number }>);

    const songs = Object.values(songCounts);
    return songs.reduce((max, song) => (song.count > max.count ? song : max), songs[0]);
  },

  getCurrentStreak(userId: string): number {
    const logs = this.getLogs(userId);
    if (logs.length === 0) return 0;

    const uniqueDates = [...new Set(logs.map(log => log.date.split('T')[0]))].sort().reverse();

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < uniqueDates.length; i++) {
      const logDate = new Date(uniqueDates[i]);
      logDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      expectedDate.setHours(0, 0, 0, 0);

      if (logDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  },

  getRecentLogs(userId: string, limit: number = 10): PracticeLog[] {
    const logs = this.getLogs(userId);
    return logs
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  },

  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  },

  getStats(userId: string): { totalMinutes: number; sessionCount: number } {
    const logs = this.getLogs(userId);
    return {
      totalMinutes: logs.reduce((total, log) => total + log.duration, 0),
      sessionCount: logs.length,
    };
  },

  getAllLogs(userId: string): PracticeLog[] {
    return this.getLogs(userId).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },
};
