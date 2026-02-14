import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Mic } from 'lucide-react';
import { SongRecorder } from './SongRecorder';

interface PDFViewerProps {
  url: string;
  title?: string;
  songId?: string;
  assignmentId?: string;
}

export function PDFViewer({ url: googleDriveUrl, title: songTitle, songId, assignmentId }: PDFViewerProps) {
  const navigate = useNavigate();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [iframeUrl, setIframeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);
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
      <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center">
        <div className="text-center text-gray-600">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-400 border-t-transparent mx-auto mb-4"></div>
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
      className="fixed inset-0 bg-white z-[9999]"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Always-visible minimal back button */}
      <button
        onClick={goBack}
        className="fixed top-3 left-3 z-[10003] w-9 h-9 bg-gray-200/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-gray-300/70 transition-all"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        <ArrowLeft className="w-4 h-4 text-gray-600" strokeWidth={2.5} />
      </button>

      {/* Google Drive iframe */}
      <iframe
        src={iframeUrl}
        title={songTitle || 'Sheet Music'}
        allow="autoplay"
        className="border-0 transition-all origin-top-left"
        style={{
          width: '110%',
          height: showRecorder ? 'calc(110% - 70px)' : '110%',
          transform: 'scale(0.909)',
          transformOrigin: 'top left',
        }}
        onLoad={() => console.log('✅ PDF iframe loaded')}
      />

      {/* Thin top-edge tap zone to show controls - invisible, doesn't block PDF scrolling */}
      {!controlsVisible && !showRecorder && (
        <div
          onClick={showControls}
          className="absolute top-0 left-0 right-0 h-4 z-[10000]"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        />
      )}

      {/* Record Button - Small floating icon */}
      {songId && (
        <button
          onClick={() => setShowRecorder(true)}
          className="fixed bottom-4 right-4 z-[10003] bg-red-600 hover:bg-red-700 text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all opacity-80 hover:opacity-100"
          title="Record your practice"
        >
          <Mic className="w-5 h-5" />
        </button>
      )}

      {/* Song Recorder Modal */}
      {showRecorder && songId && (
        <SongRecorder
          songId={songId}
          songTitle={songTitle || 'Song'}
          assignmentId={assignmentId}
          onClose={() => setShowRecorder(false)}
          onSuccess={() => setShowRecorder(false)}
        />
      )}
    </div>
  );
}

// Standalone page version for React Router
export function PDFViewerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { url?: string; title?: string; songId?: string; assignmentId?: string } | null;

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

  return <PDFViewer url={state.url} title={state.title} songId={state.songId} assignmentId={state.assignmentId} />;
}
