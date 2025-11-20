import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

interface PDFViewerProps {
  url: string;
  title?: string;
}

export function PDFViewer({ url: googleDriveUrl, title: songTitle }: PDFViewerProps) {
  const navigate = useNavigate();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [iframeUrl, setIframeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  console.log('🎵 PDF Viewer - Google Drive Iframe');
  console.log('📄 URL:', googleDriveUrl);

  // Convert Google Drive URL to iframe embed URL
  useEffect(() => {
    function convertToIframeUrl(inputUrl: string): string {
      let extractedFileId = '';
      
      // Try to extract file ID from various Google Drive URL formats
      const viewPattern = inputUrl.match(/\/d\/([^/]+)/);
      if (viewPattern && viewPattern[1]) {
        extractedFileId = viewPattern[1];
      } else {
        const openPattern = inputUrl.match(/[?&]id=([^&]+)/);
        if (openPattern && openPattern[1]) {
          extractedFileId = openPattern[1];
        }
      }
      
      if (!extractedFileId) {
        console.error('❌ Could not extract Google Drive file ID from:', inputUrl);
        return '';
      }
      
      // Create embed URL with rm=minimal for minimal controls
      const finalUrl = `https://drive.google.com/file/d/${extractedFileId}/preview?rm=minimal`;
      console.log('✅ Embed URL:', finalUrl);
      return finalUrl;
    }
    
    const converted = convertToIframeUrl(googleDriveUrl);
    if (converted) {
      setIframeUrl(converted);
      setHasError(false);
    } else {
      setHasError(true);
    }
    setIsLoading(false);
  }, [googleDriveUrl]);

  // Auto-hide controls after 2.5 seconds
  useEffect(() => {
    if (controlsVisible) {
      const hideTimer = setTimeout(() => {
        setControlsVisible(false);
      }, 2500); // 2.5 seconds
      return () => clearTimeout(hideTimer);
    }
  }, [controlsVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("🧹 PDF Viewer unmounting - cleaning up");
      setIframeUrl("");
      setIsLoading(true);
    };
  }, []);

  function showControls() {
    setControlsVisible(true);
  }

  function goBack() {
    navigate(-1);
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-4"></div>
          <div className="text-sm opacity-75">Loading PDF...</div>
        </div>
      </div>
    );
  }

  // Show error if URL conversion failed
  if (hasError || !iframeUrl) {
    return (
      <div className="fixed inset-0 bg-red-600 z-[9999] flex items-center justify-center">
        <div className="text-center text-white p-6 max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-xl font-bold mb-2">Invalid Google Drive URL</div>
          <div className="text-sm mb-6 opacity-90">
            Could not extract file ID from the URL
          </div>
          <button
            onClick={goBack}
            className="px-6 py-3 bg-white text-red-600 rounded-lg font-bold hover:bg-gray-100 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Main viewer with minimal UI
  return (
    <div
      className="fixed inset-0 bg-black z-[9999]"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Header controls - auto-hide */}
      {controlsVisible && (
        <div className="fixed inset-0 z-[10001] pointer-events-none">
          <div 
            className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent pb-6"
            style={{
              paddingTop: 'max(env(safe-area-inset-top), 0.5rem)',
            }}
          >
            <div className="flex items-center justify-between px-3 pt-2">
              {/* Back button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goBack();
                }}
                className="pointer-events-auto flex items-center gap-1 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all"
              >
                <ArrowLeft className="w-4 h-4 text-white" strokeWidth={2.5} />
                <span className="text-white text-sm font-medium">Back</span>
              </button>

              {/* Title */}
              {songTitle && (
                <div className="text-white text-sm font-medium truncate max-w-[50%]">
                  {songTitle}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Google Drive iframe */}
      <iframe
        src={iframeUrl}
        title={songTitle || 'Sheet Music'}
        allow="autoplay"
        className="w-full h-full border-0"
        onLoad={() => console.log('✅ PDF iframe loaded')}
      />

      {/* Tap overlay - captures taps when controls are hidden */}
      {!controlsVisible && (
        <div
          onClick={showControls}
          onTouchEnd={showControls}
          className="absolute inset-0 z-[10000] cursor-pointer"
          style={{ touchAction: 'manipulation' }}
        />
      )}

      {/* Tap hint */}
      {controlsVisible && (
        <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none z-[10002]">
          <div className="inline-block bg-black/80 text-white text-xs px-4 py-2 rounded-full opacity-75">
            Tap to show/hide controls
          </div>
        </div>
      )}
    </div>
  );
}

// Standalone page version for React Router
export function PDFViewerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { url?: string; title?: string } | null;

  console.log('🎬 PDFViewerPage mounted');

  if (!state || !state.url) {
    return (
      <div className="fixed inset-0 bg-orange-500 z-[9999] flex items-center justify-center">
        <div className="text-center text-white p-6">
          <div className="text-2xl font-bold mb-4">No PDF URL Provided</div>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-white text-orange-500 rounded-lg font-bold hover:bg-gray-100 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <PDFViewer url={state.url} title={state.title} />;
}
