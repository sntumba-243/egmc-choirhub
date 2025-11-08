export interface Setlist {
  id: string;
  name: string;
  eventId?: string;
  songIds: string[];
  createdDate: string;
}

const STORAGE_KEY = 'choir_setlists';

export const setlistService = {
  getSetlists(): Setlist[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  getSetlist(id: string): Setlist | undefined {
    const setlists = this.getSetlists();
    return setlists.find(s => s.id === id);
  },

  getSetlistByEventId(eventId: string): Setlist | undefined {
    const setlists = this.getSetlists();
    return setlists.find(s => s.eventId === eventId);
  },

  createSetlist(data: Omit<Setlist, 'id' | 'createdDate'>): Setlist {
    const setlists = this.getSetlists();
    const newSetlist: Setlist = {
      ...data,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdDate: new Date().toISOString(),
    };
    setlists.push(newSetlist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setlists));
    return newSetlist;
  },

  updateSetlist(id: string, data: Partial<Setlist>): void {
    const setlists = this.getSetlists();
    const index = setlists.findIndex(s => s.id === id);
    if (index !== -1) {
      setlists[index] = { ...setlists[index], ...data };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(setlists));
    }
  },

  deleteSetlist(id: string): void {
    const setlists = this.getSetlists();
    const filtered = setlists.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  reorderSongs(id: string, songIds: string[]): void {
    this.updateSetlist(id, { songIds });
  },
};
