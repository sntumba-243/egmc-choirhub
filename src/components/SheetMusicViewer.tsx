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

const touchDist = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

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
  const [chromeVisible, setChromeVisible] = useState(true)
  const chromeVisibleRef = useRef(true)
  const hideTimerRef = useRef<number | null>(null)
  const tapTimeoutRef = useRef<number | null>(null)
  const lastTouchEndRef = useRef(0)
  // Controlled pinch-zoom bookkeeping
  const pinchRef = useRef<{ startDist: number; startScale: number; vx: number; vy: number; sl: number; st: number } | null>(null)
  const isMultiTouchRef = useRef(false)
  const pendingScaleRef = useRef<number | null>(null)
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  // After a pinch, re-center the scroll so the focal point stays under the fingers.
  const pinchFocusRef = useRef<{ f: number; vx: number; vy: number; sl: number; st: number } | null>(null)
  const [resizeTick, setResizeTick] = useState(0) // bump forces a re-fit

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

  // ── Auto-hiding chrome (forScore/Apple Books pattern) ──
  const scheduleHide = () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => setChromeVisible(false), 3000)
  }
  const showChrome = () => { setChromeVisible(true); scheduleHide() } // reveal + restart timer
  const toggleChrome = () => {
    const next = !chromeVisibleRef.current
    setChromeVisible(next)
    if (next) scheduleHide()
    else if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
  }

  useEffect(() => {
    let cancelled = false
    // Reset viewer state so the previous document can never paint while the new
    // one loads (the "two movements" flash on switching/editing songs).
    setPdf(null)
    setNumPages(0)
    setCurrentPage(1)
    if (containerRef.current) containerRef.current.innerHTML = ''
    canvasElRef.current = null
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
      // Measure the ACTUAL full-viewport scroll container (inset-0), not a
      // bar-reduced box, so the page fills the width with no reserved band.
      const scrollEl = scrollRef.current
      const containerWidth = scrollEl ? scrollEl.clientWidth : container.clientWidth

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
      canvas.style.margin = 'auto' // center on BOTH axes (auto margins → 0 on overflow, no clip)
      canvas.style.touchAction = 'manipulation' // pan/scroll ok; we own double-tap

      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
      if (cancelled) return

      container.innerHTML = ''
      container.appendChild(canvas)
      canvasElRef.current = canvas

      // After a pinch re-render, restore the focal point (zoom-to-point).
      const focus = pinchFocusRef.current
      if (focus && scrollEl) {
        scrollEl.scrollLeft = Math.max(0, (focus.sl + focus.vx) * focus.f - focus.vx)
        scrollEl.scrollTop = Math.max(0, (focus.st + focus.vy) * focus.f - focus.vy)
        pinchFocusRef.current = null
      }
    }
    render()
    return () => { cancelled = true }
  }, [pdf, currentPage, scale, resizeTick])

  // Re-fit the page to the viewport on resize / orientation change.
  useEffect(() => {
    const onResize = () => setResizeTick(t => t + 1)
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  // Mirror chrome visibility into a ref for use inside timers/handlers.
  useEffect(() => { chromeVisibleRef.current = chromeVisible }, [chromeVisible])

  // On open (and whenever a new document loads): show chrome, auto-hide after 3s.
  useEffect(() => { showChrome() }, [url, version])

  // Clear timers on unmount.
  useEffect(() => () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    if (tapTimeoutRef.current) window.clearTimeout(tapTimeoutRef.current)
  }, [])

  // Change page and reset the scroll position to the top-left.
  const goToPage = (p: number) => {
    if (p < 1 || p > numPages) return
    setCurrentPage(p)
    const el = scrollRef.current
    if (el) { el.scrollTop = 0; el.scrollLeft = 0 }
  }

  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (e.touches.length >= 2) {
      // Pinch begins → suppress swipe/tap/double-tap for the whole sequence.
      isMultiTouchRef.current = true
      touchRef.current = null
      if (tapTimeoutRef.current) { window.clearTimeout(tapTimeoutRef.current); tapTimeoutRef.current = null }
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const el = scrollRef.current
      const contRect = el?.getBoundingClientRect()
      const canvas = canvasElRef.current
      if (canvas) {
        const r = canvas.getBoundingClientRect() // untransformed at gesture start
        canvas.style.transformOrigin = `${midX - r.left}px ${midY - r.top}px`
        canvas.style.willChange = 'transform'
      }
      pinchRef.current = {
        startDist: touchDist(e.touches[0], e.touches[1]),
        startScale: scale,
        vx: midX - (contRect?.left ?? 0),
        vy: midY - (contRect?.top ?? 0),
        sl: el?.scrollLeft ?? 0,
        st: el?.scrollTop ?? 0,
      }
      return
    }
    if (isMultiTouchRef.current) return // still finishing a multi-touch sequence
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, scrollLeft: scrollRef.current?.scrollLeft ?? 0 }
  }

  // Controlled pinch, phase 1: cheap GPU CSS-transform PREVIEW on the existing
  // canvas (slight blur is fine). The sharp PDF re-render happens once on release.
  const onTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    const p = pinchRef.current
    if (e.touches.length < 2 || !p) return
    const ratio = touchDist(e.touches[0], e.touches[1]) / p.startDist
    const finalScale = Math.min(3, Math.max(0.5, p.startScale * ratio))
    pendingScaleRef.current = finalScale
    const canvas = canvasElRef.current
    if (canvas) canvas.style.transform = `scale(${finalScale / p.startScale})`
  }

  const onTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (isMultiTouchRef.current) {
      // Keep gestures suppressed until EVERY finger has lifted.
      if (e.touches.length === 0) {
        const p = pinchRef.current
        const canvas = canvasElRef.current
        if (canvas) { canvas.style.transform = ''; canvas.style.transformOrigin = ''; canvas.style.willChange = '' }
        // Phase 2: one sharp re-render at the final scale, preserving focal point.
        if (p && pendingScaleRef.current != null && pendingScaleRef.current !== p.startScale) {
          pinchFocusRef.current = { f: pendingScaleRef.current / p.startScale, vx: p.vx, vy: p.vy, sl: p.sl, st: p.st }
          setScale(pendingScaleRef.current)
        }
        isMultiTouchRef.current = false
        pinchRef.current = null
        pendingScaleRef.current = null
        lastTouchEndRef.current = Date.now()
      }
      touchRef.current = null
      return
    }
    const start = touchRef.current
    touchRef.current = null
    if (!start) return
    lastTouchEndRef.current = Date.now() // so the synthesized click is ignored (desktop guard)
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
      if (tapTimeoutRef.current) { window.clearTimeout(tapTimeoutRef.current); tapTimeoutRef.current = null }
      goToPage(currentPage + (dx < 0 ? 1 : -1)) // swipe left → next, right → prev
      return
    }

    // Tap: a double-tap (< 300ms apart) zooms; a lone tap toggles chrome after a
    // 300ms wait — cancelled if a second tap arrives, so the two never collide.
    if (adx < 10 && ady < 10) {
      const now = Date.now()
      const prev = lastTapRef.current
      const isDouble = now - prev.t < 300 && Math.abs(t.clientX - prev.x) < 30 && Math.abs(t.clientY - prev.y) < 30
      if (isDouble) {
        if (tapTimeoutRef.current) { window.clearTimeout(tapTimeoutRef.current); tapTimeoutRef.current = null }
        setScale(s => (s > 1 ? 1 : 1.75))
        lastTapRef.current = { t: 0, x: 0, y: 0 } // consume
      } else {
        lastTapRef.current = { t: now, x: t.clientX, y: t.clientY }
        if (tapTimeoutRef.current) window.clearTimeout(tapTimeoutRef.current)
        tapTimeoutRef.current = window.setTimeout(() => { tapTimeoutRef.current = null; toggleChrome() }, 300)
      }
    }
  }

  // Desktop: a real mouse click (not a touch-synthesized one) toggles chrome.
  const onCanvasClick = () => {
    if (Date.now() - lastTouchEndRef.current < 700) return
    toggleChrome()
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
    <div className='fixed inset-0 z-[10050] bg-gray-950'>
      {/* Top chrome — absolute overlay so hiding it gives the partition full height */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gray-900 shadow-lg transition-all duration-200 ${chromeVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}
        style={{ paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' }}>
        <button onClick={onClose} className='min-w-[44px] min-h-[44px] flex items-center justify-center text-white'>
          <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='15,18 9,12 15,6'/></svg>
        </button>
        <span className='text-sm font-medium text-white truncate flex-1 text-center px-2'>{title || 'Sheet Music'}</span>
        <div className='flex items-center'>
          <button onClick={() => { setScale(s => Math.max(0.5, s - 0.25)); showChrome() }} className='min-w-[44px] min-h-[44px] flex items-center justify-center text-white text-lg'>−</button>
          <button onClick={() => { setScale(s => Math.min(3, s + 0.25)); showChrome() }} className='min-w-[44px] min-h-[44px] flex items-center justify-center text-white text-lg'>+</button>
        </div>
      </div>

      {/* Canvas area — fills the whole viewer; chrome overlays it (no reflow on hide) */}
      <div
        ref={scrollRef}
        className='absolute inset-0 overflow-auto bg-white'
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onCanvasClick}
      >
        {loading ? (
          <div className='flex flex-col items-center justify-center h-full text-gray-500 gap-3'>
            <div className='w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin'></div>
            <span className='text-sm'>Loading sheet music...</span>
          </div>
        ) : (
          // min-h-full + flex so the canvas (with margin:auto) centers on both axes
          <div ref={containerRef} className='w-full min-h-full flex' />
        )}
      </div>

      {/* Bottom chrome — absolute overlay */}
      {numPages > 1 && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gray-900 shadow-lg transition-all duration-200 ${chromeVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
          style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}>
          <button
            onClick={() => { goToPage(currentPage - 1); showChrome() }}
            disabled={currentPage === 1}
            className='min-w-[44px] min-h-[44px] flex items-center justify-center text-white disabled:opacity-30 rounded-xl'>
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'><polyline points='15,18 9,12 15,6'/></svg>
          </button>
          <span className='text-xs text-gray-400 font-medium'>{currentPage} / {numPages}</span>
          <button
            onClick={() => { goToPage(currentPage + 1); showChrome() }}
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
