import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import { createPortal } from 'react-dom'
import * as pdfjsLib from 'pdfjs-dist'
// NOTE: no pdf_viewer.css — we render to our own <canvas>, so pdf.js's
// stylesheet is unused. (It's scoped to .pdfViewer/.textLayer and was not the
// cause of the top gap, but importing it is dead weight.)

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface SheetMusicViewerProps {
  url: string
  title?: string
  onClose?: () => void
  /** Cache-busting token (song.updated_at). Changing it forces a fresh fetch
   *  everywhere — device SW cache, Vercel CDN — even if the Drive URL is reused. */
  version?: string
}

export default function SheetMusicViewer({ url, title, onClose, version }: SheetMusicViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Touch-gesture bookkeeping (mutable, no re-render needed)
  const touchRef = useRef<{ x: number; y: number; scrollLeft: number } | null>(null)
  const lastTapRef = useRef<{ t: number; x: number; y: number }>({ t: 0, x: 0, y: 0 })
  const [pdf, setPdf] = useState<any>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)

  // Convert Google Drive URLs to route through the server-side PDF proxy
  // (avoids browser CORS + Drive virus-scan interstitial on direct fetch)
  const getDirectUrl = (u: string, v?: string) => {
    // https://drive.google.com/file/d/FILE_ID/preview or /view
    const match = u.match(/drive\.google\.com\/file\/d\/([^/]+)/)
    if (match) {
      const base = '/api/pdf-proxy?fileId=' + match[1]
      // Append the version only when present so unversioned songs keep a stable
      // cache key (no needless cache miss / no behavior change when absent).
      return v ? base + '&v=' + encodeURIComponent(v) : base
    }
    return u
  }

  useEffect(() => {
    let cancelled = false
    // Reset viewer state so the previous document can never paint while the new
    // one loads (the "two movements" flash on switching/editing songs).
    setPdf(null)
    setNumPages(0)
    setCurrentPage(1)
    if (containerRef.current) containerRef.current.innerHTML = ''
    setLoading(true)
    setError(null)

    const loadPdf = async () => {
      try {
        const directUrl = getDirectUrl(url, version)
        const loadingTask = pdfjsLib.getDocument({
          url: directUrl,
          withCredentials: false,
        })
        const pdfDoc = await loadingTask.promise
        if (cancelled) return
        setPdf(pdfDoc)
        setNumPages(pdfDoc.numPages)
        setLoading(false)
      } catch (err: any) {
        if (cancelled) return
        // Google Drive CORS fallback — use the gview embed as last resort
        setError('cors')
        setLoading(false)
      }
    }
    loadPdf()
    return () => { cancelled = true }
  }, [url, version])

  // Render current page to canvas
  useEffect(() => {
    if (!pdf || !containerRef.current) return
    let cancelled = false

    const render = async () => {
      const page = await pdf.getPage(currentPage)
      if (cancelled) return

      const container = containerRef.current!
      const containerWidth = container.clientWidth

      const viewport = page.getViewport({ scale: 1 })
      const fitScale = (containerWidth / viewport.width) * scale
      const scaledViewport = page.getViewport({ scale: fitScale * (window.devicePixelRatio || 1) })

      const canvas = document.createElement('canvas')
      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height
      canvas.style.width = (scaledViewport.width / (window.devicePixelRatio || 1)) + 'px'
      canvas.style.height = (scaledViewport.height / (window.devicePixelRatio || 1)) + 'px'
      // No maxWidth cap: when zoomed the canvas must be allowed to exceed the
      // container so both axes become scrollable (and the aspect stays correct).
      canvas.style.display = 'block'
      canvas.style.margin = '0 auto'
      canvas.style.touchAction = 'manipulation' // pan/scroll ok; we own double-tap

      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
      if (cancelled) return

      container.innerHTML = ''
      container.appendChild(canvas)
    }
    render()
    return () => { cancelled = true }
  }, [pdf, currentPage, scale])

  // Change page and reset the scroll position to the top-left.
  const goToPage = (p: number) => {
    if (p < 1 || p > numPages) return
    setCurrentPage(p)
    const el = scrollRef.current
    if (el) { el.scrollTop = 0; el.scrollLeft = 0 }
  }

  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, scrollLeft: scrollRef.current?.scrollLeft ?? 0 }
  }

  const onTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchRef.current
    touchRef.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    const el = scrollRef.current
    // At fit scale there is no horizontal overflow → a horizontal swipe is free
    // for page nav. When zoomed in, horizontal panning wins and we do nothing.
    const noHorizontalOverflow = el ? el.scrollWidth <= el.clientWidth + 4 : true

    if (adx > 60 && adx > 2 * ady && noHorizontalOverflow) {
      goToPage(currentPage + (dx < 0 ? 1 : -1)) // swipe left → next, right → prev
      return
    }

    // Double-tap (two stationary taps < 300ms apart) toggles zoom 1 ↔ 1.75.
    if (adx < 10 && ady < 10) {
      const now = Date.now()
      const prev = lastTapRef.current
      if (now - prev.t < 300 && Math.abs(t.clientX - prev.x) < 30 && Math.abs(t.clientY - prev.y) < 30) {
        setScale(s => (s > 1 ? 1 : 1.75))
        lastTapRef.current = { t: 0, x: 0, y: 0 } // consume, so a 3rd tap doesn't retrigger
      } else {
        lastTapRef.current = { t: now, x: t.clientX, y: t.clientY }
      }
    }
  }

  // CORS fallback — show Google's viewer if direct fetch blocked
  if (error === 'cors') {
    const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
    const fileId = match ? match[1] : null
    return createPortal(
      <div className='fixed inset-0 z-[10050] bg-black flex flex-col'>
        <div className='flex items-center justify-between px-4 py-3 bg-gray-900 text-white'
          style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}>
          <span className='text-sm font-medium truncate'>{title || 'Sheet Music'}</span>
          <button onClick={onClose} className='min-w-[44px] min-h-[44px] flex items-center justify-center text-white'>✕</button>
        </div>
        <iframe
          src={'https://drive.google.com/file/d/' + fileId + '/preview'}
          className='flex-1 w-full border-0'
          allow='autoplay'
        />
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className='fixed inset-0 z-[10050] bg-gray-950 flex flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-2 bg-gray-900 flex-shrink-0'
        style={{ paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' }}>
        <button onClick={onClose} className='min-w-[44px] min-h-[44px] flex items-center justify-center text-white'>
          <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='15,18 9,12 15,6'/></svg>
        </button>
        <span className='text-sm font-medium text-white truncate flex-1 text-center px-2'>{title || 'Sheet Music'}</span>
        <div className='flex items-center'>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className='min-w-[44px] min-h-[44px] flex items-center justify-center text-white text-lg'>−</button>
          <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className='min-w-[44px] min-h-[44px] flex items-center justify-center text-white text-lg'>+</button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={scrollRef}
        className='flex-1 overflow-auto bg-gray-800 flex items-start justify-center p-2'
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {loading ? (
          <div className='flex flex-col items-center justify-center h-full text-gray-400 gap-3'>
            <div className='w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin'></div>
            <span className='text-sm'>Loading sheet music...</span>
          </div>
        ) : (
          <div ref={containerRef} className='w-full' />
        )}
      </div>

      {/* Page navigation */}
      {numPages > 1 && (
        <div className='flex items-center justify-between px-4 py-2 bg-gray-900 flex-shrink-0'
          style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className='min-w-[44px] min-h-[44px] flex items-center justify-center text-white disabled:opacity-30 rounded-xl'>
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='15,18 9,12 15,6'/></svg>
          </button>
          <span className='text-xs text-gray-400 font-medium'>{currentPage} / {numPages}</span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === numPages}
            className='min-w-[44px] min-h-[44px] flex items-center justify-center text-white disabled:opacity-30 rounded-xl'>
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='9,18 15,12 9,6'/></svg>
          </button>
        </div>
      )}
    </div>,
    document.body
  )
}
