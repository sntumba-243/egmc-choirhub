const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
const FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink: string;
}

export const googleDriveService = {
  async listFilesInFolder(): Promise<DriveFile[]> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?` +
        `q='${FOLDER_ID}'+in+parents+and+trashed=false+and+(mimeType='application/pdf'+or+mimeType contains 'image/')` +
        `&key=${GOOGLE_API_KEY}` +
        `&fields=files(id,name,mimeType,webViewLink,webContentLink)`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch files from Google Drive');
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error('Error listing Google Drive files:', error);
      throw error;
    }
  },

  getEmbedUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  },

  extractFileId(url: string): string | null {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
};
