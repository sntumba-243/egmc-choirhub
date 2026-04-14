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
      let allFiles: DriveFile[] = [];
      let pageToken: string | null = null;
      
      // Keep fetching until no more pages
      do {
        const url = new URL('https://www.googleapis.com/drive/v3/files');
        
        // Build query parameters
        const params = {
          q: `'${FOLDER_ID}' in parents and trashed=false and (mimeType='application/pdf' or mimeType contains 'image/')`,
          key: GOOGLE_API_KEY || '',
          fields: 'files(id,name,mimeType,webViewLink,webContentLink),nextPageToken',
          pageSize: '1000', // Max allowed by Google Drive API
        };
        
        // Add pageToken if we have one (for subsequent pages)
        if (pageToken) {
          (params as any).pageToken = pageToken;
        }
        
        // Add all params to URL
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
        
        const response = await fetch(url.toString());

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Google Drive API error:', errorText);
          throw new Error(`Failed to fetch files from Google Drive: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Add files from this page to our collection
        if (data.files && data.files.length > 0) {
          allFiles = allFiles.concat(data.files);
        }
        
        // Get the next page token (null if no more pages)
        pageToken = data.nextPageToken || null;
        
      } while (pageToken); // Continue while there are more pages
      
      return allFiles;
      
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
