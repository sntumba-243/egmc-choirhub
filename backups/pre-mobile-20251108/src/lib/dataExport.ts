export const dataExportService = {
  exportAllData(): void {
    const data = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: {
        practiceLogs: localStorage.getItem('choir_practice_logs'),
        offlineSongs: localStorage.getItem('choir_offline_songs'),
        setlists: localStorage.getItem('choir_setlists'),
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `choir-data-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  importData(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          if (!data.version || !data.data) {
            reject(new Error('Invalid data format'));
            return;
          }

          if (data.data.practiceLogs) {
            localStorage.setItem('choir_practice_logs', data.data.practiceLogs);
          }
          if (data.data.offlineSongs) {
            localStorage.setItem('choir_offline_songs', data.data.offlineSongs);
          }
          if (data.data.setlists) {
            localStorage.setItem('choir_setlists', data.data.setlists);
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },

  clearAllData(): void {
    if (confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
      localStorage.removeItem('choir_practice_logs');
      localStorage.removeItem('choir_offline_songs');
      localStorage.removeItem('choir_setlists');
      alert('All local data has been cleared');
    }
  },
};
