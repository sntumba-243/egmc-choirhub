import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isMobile } from '../../utils/mobile-helpers';
import '../../styles/mobile-optimization.css';

interface PDFViewerProps {
  url: string;
  title?: string;
}

export function PDFViewer({ url, title }: PDFViewerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mobile = isMobile();

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls && mobile) {
      const timer = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showControls, mobile]);

  // Toggle controls on tap
  function handleTap() {
    setShowControls(!showControls);
  }

  // Toggle fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Minimal Header - Auto-hides */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 transition-transform duration-300 ${
          showControls ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)'
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 safe-area-top">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white text-sm font-medium bg-black bg-opacity-50 rounded-full px-3 py-1.5"
          >
            <span className="text-lg">←</span>
            <span>Back</span>
          </button>

          {/* Title - Truncated */}
          {title && (
            <div className="flex-1 px-3 text-center">
              <p className="text-white text-sm font-medium truncate">
                {title}
              </p>
            </div>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="text-white text-lg bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center"
          >
            {isFullscreen ? '↙' : '↗'}
          </button>
        </div>
      </div>

      {/* PDF Viewer - Full Height */}
      <div
        className="flex-1 w-full overflow-hidden"
        onClick={handleTap}
        onTouchStart={handleTap}
      >
        <iframe
          src={url}
          className="w-full h-full border-0"
          title={title || 'PDF Viewer'}
          style={{
            // Remove all iframe chrome
            border: 'none',
            margin: 0,
            padding: 0,
          }}
        />
      </div>

      {/* Floating Hint - Only shows first time */}
      {showControls && (
        <div
          className={`absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-4 py-2 rounded-full transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Tap to toggle controls
        </div>
      )}
    </div>
  );
}

// Standalone page version
export function PDFViewerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { url, title } = (location.state || {}) as { url?: string; title?: string };

  if (!url) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white p-6">
          <p className="text-xl mb-4">No PDF URL provided</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-blue-600 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <PDFViewer url={url} title={title} />;
}
