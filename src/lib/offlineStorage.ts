import { Song } from './database';

const STORAGE_KEY = 'choir_offline_songs';
const MAX_STORAGE_MB = 100;

export interface OfflineSong extends Song {
  downloadedAt: string;
  storageSize: number;
}

export const offlineStorage = {
  async downloadSong(song: Song): Promise<void> {
    const offlineSongs = this.getOfflineSongs();

    const estimatedSize = Math.floor(Math.random() * 5000000) + 1000000;

    const offlineSong: OfflineSong = {
      ...song,
      downloadedAt: new Date().toISOString(),
      storageSize: estimatedSize,
    };

    offlineSongs.push(offlineSong);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(offlineSongs));
  },

  getOfflineSongs(): OfflineSong[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  isDownloaded(songId: string): boolean {
    const songs = this.getOfflineSongs();
    return songs.some(s => s.id === songId);
  },

  removeSong(songId: string): void {
    const songs = this.getOfflineSongs();
    const filtered = songs.filter(s => s.id !== songId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  getTotalStorageUsed(): number {
    const songs = this.getOfflineSongs();
    return songs.reduce((total, song) => total + song.storageSize, 0);
  },

  getStorageInfo(): { usedMB: number; totalMB: number; percentage: number } {
    const used = this.getTotalStorageUsed();
    const usedMB = Math.round(used / 1024 / 1024);
    const percentage = Math.round((usedMB / MAX_STORAGE_MB) * 100);

    return {
      usedMB,
      totalMB: MAX_STORAGE_MB,
      percentage,
    };
  },

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  },
};

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

import React from 'react';
