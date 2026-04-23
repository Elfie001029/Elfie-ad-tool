'use client';
import { useState, useRef, useEffect } from 'react';

// ── Type constants
const TYPE_LABELS = {
  talking_head: 'Talking head',
  talent_broll: 'Talent B-roll',
  product_broll: 'Product B-roll',
  greenscreen: 'Greenscreen',
};
const TYPE_COLORS = {
  talking_head: 'bg-blue-50 text-blue-700',
  talent_broll: 'bg-green-50 text-green-700',
  product_broll: 'bg-amber-50 text-amber-700',
  greenscreen: 'bg-purple-50 text-purple-700',
};
const TYPE_COLORS_INLINE = {
  talking_head: { bg: '#eff6ff', color: '#1d4ed8' },
  talent_broll: { bg: '#f0fdf4', color: '#15803d' },
  product_broll: { bg: '#fffbeb', color: '#b45309' },
  greenscreen:   { bg: '#faf5ff', color: '#7e22ce' },
};
const SECTION_COLORS = {
  'Hook':                { bg: '#3b82f6', light: 'bg-blue-50',   text: 'text-blue-700' },
  'Opener':              { bg: '#f97316', light: 'bg-orange-50', text: 'text-orange-700' },
  'Personal story':      { bg: '#ec4899', light: 'bg-pink-50',   text: 'text-pink-700' },
  'Pain point':          { bg: '#ef4444', light: 'bg-red-50',    text: 'text-red-700' },
  'Competitor mention':  { bg: '#eab308', light: 'bg-yellow-50', text: 'text-yellow-700' },
  'Scientific facts':    { bg: '#a855f7', light: 'bg-purple-50', text: 'text-purple-700' },
  'Product introduction':{ bg: '#22c55e', light: 'bg-green-50',  text: 'text-green-700' },
  'Social proof':        { bg: '#14b8a6', light: 'bg-teal-50',   text: 'text-teal-700' },
  'Price or offer':      { bg: '#f59e0b', light: 'bg-amber-50',  text: 'text-amber-700' },
  'CTA':                 { bg: '#6b7280', light: 'bg-gray-50',   text: 'text-gray-700' },
};

// ── Design tokens
const C = {
  bg: '#ffffff',
  surface: '#f7f8ff',
  surfaceHover: '#f0f2fe',
  border: '#e4e6f0',
  borderStrong: '#d0d4e8',
  text: '#0d0f1a',
  textSub: '#3d4158',
  muted: '#8b90a7',
  mutedLight: '#c4c7d8',
  accent: '#2563eb',
  accentLight: '#eff6ff',
  accentBorder: '#bfdbfe',
  mono: "'IBM Plex Mono', monospace",
};

// ── Utilities
function timestampToSeconds(ts) {
  if (!ts) return 0;
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}
function formatDate(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
}
function getLibrary() {
  try { return JSON.parse(localStorage.getItem('adLibrary') || '[]'); } catch { return []; }
}
function persistLibrary(entries) { localStorage.setItem('adLibrary', JSON.stringify(entries)); }

async function captureFrameFromVideo(video, timestamp, w, h) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    const timeout = setTimeout(() => resolve(null), 8000);

    function doSeek() {
      video.currentTime = timestampToSeconds(timestamp);
      video.addEventListener('seeked', function onSeeked() {
        video.removeEventListener('seeked', onSeeked);
        clearTimeout(timeout);
        try { ctx.drawImage(video, 0, 0, w, h); resolve(canvas.toDataURL('image/jpeg', 0.75)); }
        catch { resolve(null); }
      }, { once: true });
    }

    // Wait for the video to be ready to seek before seeking
    if (video.readyState >= 1) {
      doSeek();
    } else {
      video.addEventListener('loadedmetadata', doSeek, { once: true });
      // Kick off loading if it hasn't started
      if (video.networkState === 0) video.load();
    }
  });
}

async function createGroupThumbnail(frames) {
  const valid = frames.filter(Boolean).slice(0, 4);
  if (!valid.length) return null;
  const cols = 2;
  const cellW = 80;
  const cellH = Math.round(cellW * 16 / 9);
  const rows = Math.ceil(valid.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cellW * Math.min(valid.length, cols);
  canvas.height = cellH * rows;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await Promise.all(valid.map((src, i) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, (i % cols) * cellW, Math.floor(i / cols) * cellH, cellW, cellH);
      resolve();
    };
    img.onerror = resolve;
    img.src = src;
  })));
  return canvas.toDataURL('image/jpeg', 0.65);
}

export default function Home() {
  // ── layout state
  const [mode, setMode] = useState('home'); // 'home' | 'analysis'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('adelf_sidebar_collapsed') === 'true'; } catch { return false; }
  });

  // ── home form
  const [urls, setUrls] = useState(['']);
  const [context, setContext] = useState('');
  const [analysisType, setAnalysisType] = useState('single'); // 'single' | 'group'
  const freshGroupAnalysis = useRef(false);

  // ── shot list
  const [shotList, setShotList] = useState([]);
  const [shotListOpen, setShotListOpen] = useState(false);
  const [briefNotes, setBriefNotes] = useState('');
  const [pdfDownloading, setPdfDownloading] = useState(false);

  // ── library
  const [library, setLibrary] = useState([]);

  // ── analyze single
  const [videoUrl, setVideoUrl] = useState('');
  const [videoContext, setVideoContext] = useState('');
  const [videoAnalysis, setVideoAnalysis] = useState(null);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  const [videoError, setVideoError] = useState('');
  const videoRef = useRef(null);
  const captureVideoRef = useRef(null);
  const [capturedFrames, setCapturedFrames] = useState({});
  const [capturingFrames, setCapturingFrames] = useState(false);
  const [openerFrame, setOpenerFrame] = useState(null);
  const [videoNaturalSize, setVideoNaturalSize] = useState(null);

  // ── group analysis
  const [groupUrls, setGroupUrls] = useState(['', '']);
  const [groupContext, setGroupContext] = useState('');
  const [groupResult, setGroupResult] = useState(null);
  const [groupRunning, setGroupRunning] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [groupKeyFrames, setGroupKeyFrames] = useState({});
  const groupVideoRefs = useRef([]);

  // ── editor brief
  const [editorBriefOpen, setEditorBriefOpen] = useState(false);
  const [editorScript, setEditorScript] = useState('');
  const [labeledScript, setLabeledScript] = useState(null);
  const [labelingScript, setLabelingScript] = useState(false);

  // ── filmstrip
  const [hoveredFrameIdx, setHoveredFrameIdx] = useState(null);
  const [filmstripMode, setFilmstripMode] = useState('strip');
  const filmstripRef = useRef(null);

  // ── effects
  useEffect(() => { setLibrary(getLibrary()); }, []);
  useEffect(() => {
    try { localStorage.setItem('adelf_sidebar_collapsed', String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);
  useEffect(() => {
    if (!videoAnalysis?.timeline?.length || Object.keys(capturedFrames).length > 0 || capturingFrames) return;
    // Delay one tick so the hidden proxy video element has been rendered into the DOM
    const t = setTimeout(() => captureFrames(), 100);
    return () => clearTimeout(t);
  }, [videoAnalysis]);
  useEffect(() => {
    if (videoAnalysis?.general?.opener?.timestamp) captureOpenerFrame(videoAnalysis.general.opener.timestamp);
  }, [videoAnalysis]);
  useEffect(() => {
    if (!groupResult?.key_frames?.length) return;
    const filledUrls = groupUrls.filter(u => u.trim());
    captureGroupKeyFrames(groupResult.key_frames, filledUrls, groupResult);
  }, [groupResult]);

  // ── navigation
  function goHome() {
    setMode('home');
    setUrls(['']); setContext('');
    setVideoAnalysis(null); setGroupResult(null);
    setVideoError(''); setGroupError('');
    setCapturedFrames({}); setOpenerFrame(null); setGroupKeyFrames({});
  }

  // ── main analyze handler
  async function handleAnalyze() {
    const filled = urls.filter(u => u.trim());
    if (!filled.length) return;

    if (filled.length === 1) {
      const url = filled[0];
      setVideoUrl(url); setVideoContext(context);
      setAnalysisType('single'); setMode('analysis');
      setVideoError(''); setCapturedFrames({}); setOpenerFrame(null);
      setAnalyzingVideo(true); setVideoAnalysis(null);
      try {
        const res = await fetch('/api/analyze-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: url, adContext: context }) });
        const data = await res.json();
        if (data.error) return setVideoError(data.error);
        setVideoAnalysis(data.analysis);
        autoSaveSingle(url, data.analysis);
      } catch { setVideoError('Something went wrong. Please try again.'); }
      finally { setAnalyzingVideo(false); }
    } else {
      setGroupUrls(filled); setGroupContext(context);
      setAnalysisType('group'); setMode('analysis');
      freshGroupAnalysis.current = true;
      setGroupError(''); setGroupRunning(true); setGroupResult(null); setGroupKeyFrames({});
      try {
        const res = await fetch('/api/group-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrls: filled, context }) });
        const data = await res.json();
        if (data.error) return setGroupError(data.error);
        setGroupResult(data.result);
      } catch { setGroupError('Something went wrong. Please try again.'); }
      finally { setGroupRunning(false); }
    }
  }

  // ── auto-save
  async function autoSaveSingle(url, analysis) {
    const video = captureVideoRef.current;
    let thumbnail = null;
    if (video) {
      try {
        const nw = videoNaturalSize?.w || 9; const nh = videoNaturalSize?.h || 16;
        thumbnail = await captureFrameFromVideo(video, '00:00:00', 200, Math.round(200 * nh / nw));
      } catch {}
    }
    const entry = {
      id: Date.now().toString(), type: 'single',
      urls: [url], analysis, groupResult: null,
      savedAt: new Date().toISOString(), thumbnail,
      hook: analysis?.general?.hook?.copy || '',
    };
    const updated = [entry, ...getLibrary()];
    persistLibrary(updated); setLibrary(updated);
  }

  async function autoSaveGroup(urls, result, thumbnail) {
    const hook = result?.common_hooks?.[0]?.copy || result?.strongest_patterns?.[0]?.title || `${urls.length} ads`;
    const entry = {
      id: Date.now().toString(), type: 'group',
      urls, analysis: null, groupResult: result,
      savedAt: new Date().toISOString(), thumbnail,
      hook,
    };
    const updated = [entry, ...getLibrary()];
    persistLibrary(updated); setLibrary(updated);
  }

  // ── frame capture
  async function captureGroupKeyFrames(keyFrames, urls, result) {
    const frames = {};
    for (const kf of keyFrames) {
      const url = urls[kf.video_index];
      if (!url) continue;
      const video = groupVideoRefs.current[kf.video_index];
      if (!video) continue;
      const nw = video.videoWidth || 9; const nh = video.videoHeight || 16;
      const w = 160; const h = Math.round(w * nh / nw);
      const dataUrl = await captureFrameFromVideo(video, kf.timestamp, w, h);
      frames[`${kf.video_index}:${kf.timestamp}`] = dataUrl;
      setGroupKeyFrames({ ...frames });
    }
    if (freshGroupAnalysis.current) {
      freshGroupAnalysis.current = false;
      const byVideo = {};
      for (const kf of keyFrames) {
        if (!byVideo[kf.video_index] && frames[`${kf.video_index}:${kf.timestamp}`]) {
          byVideo[kf.video_index] = frames[`${kf.video_index}:${kf.timestamp}`];
        }
      }
      const thumbnail = await createGroupThumbnail(Object.values(byVideo));
      await autoSaveGroup(urls, result, thumbnail);
    }
  }

  async function captureOpenerFrame(timestamp) {
    const video = captureVideoRef.current;
    if (!video) return;
    const nw = videoNaturalSize?.w || 9; const nh = videoNaturalSize?.h || 16;
    const dataUrl = await captureFrameFromVideo(video, timestamp, 540, Math.round(540 * nh / nw));
    setOpenerFrame(dataUrl || null);
  }

  async function captureFrames() {
    if (!captureVideoRef.current || !videoAnalysis?.timeline?.length) return;
    const video = captureVideoRef.current;
    // Wait for the proxy video to have loaded enough metadata to be seekable
    if (video.readyState < 1) {
      await new Promise(resolve => {
        video.addEventListener('loadedmetadata', resolve, { once: true });
        if (video.networkState === 0) video.load();
      });
    }
    setCapturingFrames(true); setCapturedFrames({});
    const nw = video.videoWidth || videoNaturalSize?.w || 9;
    const nh = video.videoHeight || videoNaturalSize?.h || 16;
    const w = 160; const h = Math.round(w * nh / nw);
    const frames = {};
    for (const row of videoAnalysis.timeline) {
      frames[row.timestamp] = await captureFrameFromVideo(video, row.timestamp, w, h);
      setCapturedFrames({ ...frames });
    }
    setCapturingFrames(false);
  }

  // ── library
  function openFromLibrary(entry) {
    if (entry.type === 'group') {
      setGroupUrls(entry.urls || []); setGroupContext('');
      setGroupResult(entry.groupResult); setGroupKeyFrames({});
      setAnalysisType('group'); setMode('analysis');
    } else {
      setVideoUrl(entry.urls?.[0] || entry.url || '');
      setVideoContext(''); setVideoAnalysis(entry.analysis);
      setCapturedFrames({}); setOpenerFrame(null);
      setAnalysisType('single'); setMode('analysis');
    }
  }
  function deleteEntry(id) { const u = getLibrary().filter(e => e.id !== id); persistLibrary(u); setLibrary(u); }
  function jumpToTimestamp(ts) { if (videoRef.current) { videoRef.current.currentTime = timestampToSeconds(ts); videoRef.current.play(); } }

  // ── shot list helpers
  function addToShotList({ thumbnail, hqThumbnail, annotation, shootDirection, source, videoUrl: itemVideoUrl }) {
    if (!thumbnail) return;
    setShotList(prev => [...prev, { id: Date.now().toString() + Math.random(), thumbnail, hqThumbnail: hqThumbnail || thumbnail, annotation: annotation || '', shootDirection: shootDirection || '', source: source || '', videoUrl: itemVideoUrl || '' }]);
    setShotListOpen(true);
  }
  function removeFromShotList(id) { setShotList(prev => prev.filter(i => i.id !== id)); }
  function updateShotListItem(id, field, value) {
    setShotList(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  // ── PDF download
  async function downloadPDF() {
    setPdfDownloading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      const contentW = pageW - margin * 2;
      // 1-column layout: image left, text right
      const imgColW = 160;
      const textColX = margin + imgColW + 20;
      const textColW = contentW - imgColW - 20;
      let y = margin;

      // Header
      doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(20, 20, 20);
      doc.text('Shot List', margin, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(160, 160, 160);
      doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageW - margin, y, { align: 'right' });
      y += 28;

      // Brief notes
      if (briefNotes.trim()) {
        doc.setFontSize(10); doc.setTextColor(80, 80, 80);
        const noteLines = doc.splitTextToSize(briefNotes.trim(), contentW - 24);
        const noteBlockH = noteLines.length * 14 + 20;
        doc.setFillColor(248, 248, 248); doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.5);
        doc.roundedRect(margin, y, contentW, noteBlockH, 4, 4, 'FD');
        doc.text(noteLines, margin + 12, y + 14);
        y += noteBlockH + 16;
      }

      doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y); y += 24;

      for (let i = 0; i < shotList.length; i++) {
        const item = shotList[i];
        // Use highest quality thumbnail available
        const imgSrc = item.hqThumbnail || item.thumbnail;
        // Derive actual aspect ratio from the image if possible, default to 9:16
        const imgH = Math.round(imgColW * 16 / 9);
        const cardH = Math.max(imgH, 120) + 24;

        if (y + cardH > pageH - margin) { doc.addPage(); y = margin; }

        // Image
        if (imgSrc) {
          try { doc.addImage(imgSrc, 'JPEG', margin, y, imgColW, imgH, undefined, 'FAST'); } catch {}
        } else {
          doc.setFillColor(240, 240, 240); doc.roundedRect(margin, y, imgColW, imgH, 3, 3, 'F');
        }
        // Number badge on image
        doc.setFillColor(13, 15, 26); doc.roundedRect(margin + 6, y + 6, 20, 15, 3, 3, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
        doc.text(String(i + 1), margin + 16, y + 15.5, { align: 'center' });

        // Text column
        let textY = y + 2;
        // Source
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(160, 160, 160);
        doc.text(item.source || '', textColX, textY); textY += 16;

        // Annotation
        if (item.annotation) {
          doc.setFontSize(10); doc.setTextColor(20, 20, 20);
          const al = doc.splitTextToSize(item.annotation, textColW);
          doc.text(al, textColX, textY);
          textY += al.length * 13 + 8;
        }

        // Shoot direction
        if (item.shootDirection) {
          doc.setFontSize(9); doc.setTextColor(37, 99, 235);
          const sl = doc.splitTextToSize('\u2192 ' + item.shootDirection, textColW);
          doc.text(sl, textColX, textY);
          textY += sl.length * 12 + 8;
        }

        // Source link
        if (item.videoUrl) {
          doc.setFontSize(8); doc.setTextColor(37, 99, 235);
          const ll = 'View original ad \u2197';
          doc.text(ll, textColX, textY);
          doc.link(textColX, textY - 9, doc.getTextWidth(ll), 10, { url: item.videoUrl });
        }

        y += cardH + 8;
        // Divider between cards
        if (i < shotList.length - 1) {
          doc.setDrawColor(235, 235, 235); doc.setLineWidth(0.5);
          doc.line(margin, y, pageW - margin, y);
          y += 16;
        }
      }
      doc.save('shot-list.pdf');
    } finally { setPdfDownloading(false); }
  }

  // ── editor brief
  async function labelScript() {
    if (!editorScript.trim()) return;
    const brollLogic = videoAnalysis?.broll_logic || groupResult?.broll_logic || null;
    setLabelingScript(true); setLabeledScript(null);
    try {
      const res = await fetch('/api/label-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: editorScript, brollLogic }) });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setLabeledScript(data.result);
    } catch { alert('Something went wrong. Please try again.'); }
    finally { setLabelingScript(false); }
  }

  // ── derived
  const isGroup = urls.filter(u => u.trim()).length > 1;
  const urlFilename = videoUrl ? (videoUrl.split('/').pop()?.split('.')[0] || 'Ad') : 'Ad';

  // ── sub-components

  function AdStructureBar({ data, duration, brandReveal, productReveal }) {
    if (!data?.length) return null;
    const total = timestampToSeconds(duration) || 60;
    const bPct = (timestampToSeconds(brandReveal) / total) * 100;
    const pPct = (timestampToSeconds(productReveal) / total) * 100;
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Ad structure</p>
        <div className="relative mb-1" style={{ height: 20 }}>
          {brandReveal && <div className="absolute flex flex-col items-center" style={{ left: `${bPct}%`, transform: 'translateX(-50%)' }}><span className="text-xs text-gray-400 font-mono whitespace-nowrap">brand</span></div>}
          {productReveal && Math.abs(pPct - bPct) > 5 && <div className="absolute flex flex-col items-center" style={{ left: `${pPct}%`, transform: 'translateX(-50%)' }}><span className="text-xs text-gray-400 font-mono whitespace-nowrap">product</span></div>}
        </div>
        <div className="relative h-10 flex rounded-lg overflow-hidden mb-1 gap-px">
          {data.map((s, i) => { const w = ((timestampToSeconds(s.end) - timestampToSeconds(s.start)) / total) * 100; return <button key={i} onClick={() => jumpToTimestamp(s.start)} style={{ width: `${Math.max(w, 1)}%`, backgroundColor: SECTION_COLORS[s.section]?.bg || '#6b7280' }} className="hover:opacity-75 transition-opacity" title={`${s.section} (${s.start})`} />; })}
          {brandReveal && <div className="absolute top-0 bottom-0 w-px bg-white opacity-90 pointer-events-none" style={{ left: `${bPct}%` }} />}
          {productReveal && <div className="absolute top-0 bottom-0 w-px bg-white opacity-90 pointer-events-none" style={{ left: `${pPct}%` }} />}
        </div>
        <div className="relative h-5 mb-4">
          {brandReveal && <div className="absolute" style={{ left: `${bPct}%`, transform: 'translateX(-50%)' }}><span className="text-xs font-mono text-gray-400">{brandReveal}</span></div>}
          {productReveal && Math.abs(pPct - bPct) > 5 && <div className="absolute" style={{ left: `${pPct}%`, transform: 'translateX(-50%)' }}><span className="text-xs font-mono text-gray-400">{productReveal}</span></div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {data.map((s, i) => { const c = SECTION_COLORS[s.section] || { light: 'bg-gray-50', text: 'text-gray-700', bg: '#6b7280' }; return (<button key={i} onClick={() => jumpToTimestamp(s.start)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${c.light} hover:opacity-80 transition-opacity`}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.bg }} /><span className={`text-xs font-medium ${c.text}`}>{s.section}</span><span className="text-xs text-gray-400 font-mono">{s.start}</span></button>); })}
        </div>
      </div>
    );
  }

  function AddToShotListBtn({ thumbnail, annotation, shootDirection, source, videoUrl: itemVideoUrl }) {
    const already = shotList.some(i => i.thumbnail === thumbnail);
    return (
      <button
        onClick={e => { e.stopPropagation(); already ? null : addToShotList({ thumbnail, annotation, shootDirection, source, videoUrl: itemVideoUrl }); }}
        title={already ? 'Already in shot list' : 'Add to shot list'}
        style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, transition: 'background 0.12s, color 0.12s', background: already ? C.text : '#e4e6f0', color: already ? '#fff' : C.muted }}>
        {already ? '✓' : '+'}
      </button>
    );
  }

  function ShotListSidebar() {
    return (
      <>
        {shotListOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 40 }} onClick={() => setShotListOpen(false)} />}
        <div style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: 520, background: '#fff', borderLeft: `1px solid ${C.border}`, boxShadow: '0 0 40px rgba(0,0,0,0.12)', zIndex: 50, display: 'flex', flexDirection: 'column', transition: 'transform 0.3s', transform: shotListOpen ? 'translateX(0)' : 'translateX(100%)' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Shot List</p>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{shotList.length} {shotList.length === 1 ? 'frame' : 'frames'} selected</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {shotList.length > 0 && <button onClick={() => setShotList([])} style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>}
              <button onClick={() => setShotListOpen(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          </div>
          <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Brief notes</p>
            <textarea value={briefNotes} onChange={e => setBriefNotes(e.target.value)} placeholder="Add context, brand notes, or directions for the CP..." style={{ width: '100%', fontSize: 12, color: C.text, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, resize: 'none', outline: 'none', fontFamily: 'inherit' }} rows={3} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {shotList.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 24px' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>No frames yet</p>
                <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>Click + on any captured frame to add it here.</p>
              </div>
            ) : shotList.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', gap: 16, background: C.surface, borderRadius: 14, padding: 14 }}>
                {/* Thumbnail */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: C.text, color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{i + 1}</span>
                  <div style={{ width: 110, borderRadius: 10, overflow: 'hidden', background: C.borderStrong, aspectRatio: '9/16', flexShrink: 0 }}>
                    {item.thumbnail && <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                </div>
                {/* Text fields */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{item.source}</p>
                  <textarea value={item.annotation} onChange={e => updateShotListItem(item.id, 'annotation', e.target.value)} placeholder="Scene description..." style={{ width: '100%', fontSize: 12, color: C.text, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} rows={3} />
                  <textarea value={item.shootDirection} onChange={e => updateShotListItem(item.id, 'shootDirection', e.target.value)} placeholder="How to shoot this scene..." style={{ width: '100%', fontSize: 12, color: C.accent, background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: '8px 10px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} rows={3} />
                </div>
                <button onClick={() => removeFromShotList(item.id)} style={{ background: 'none', border: 'none', color: C.mutedLight, fontSize: 18, cursor: 'pointer', lineHeight: 1, flexShrink: 0, marginTop: 2 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ padding: 16, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button onClick={downloadPDF} disabled={pdfDownloading || shotList.length === 0} style={{ width: '100%', background: pdfDownloading || shotList.length === 0 ? C.mutedLight : C.text, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: pdfDownloading || shotList.length === 0 ? 'not-allowed' : 'pointer', transition: 'background 0.12s' }}>
              {pdfDownloading ? 'Generating PDF...' : 'Download PDF'}
            </button>
          </div>
        </div>
      </>
    );
  }

  function EditorBriefSidebar() {
    const brollLogic = videoAnalysis?.broll_logic || groupResult?.broll_logic || null;
    return (
      <>
        {editorBriefOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 40 }} onClick={() => setEditorBriefOpen(false)} />}
        <div style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: 420, background: '#fff', borderLeft: `1px solid ${C.border}`, boxShadow: '0 0 40px rgba(0,0,0,0.12)', zIndex: 50, display: 'flex', flexDirection: 'column', transition: 'transform 0.3s', transform: editorBriefOpen ? 'translateX(0)' : 'translateX(100%)' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Editor Brief</p>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{brollLogic ? 'B-roll logic loaded from analysis' : 'Run an analysis first to load B-roll logic'}</p>
            </div>
            <button onClick={() => setEditorBriefOpen(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {brollLogic ? (
              <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>B-roll logic</p>
                <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6, marginBottom: 12 }}>{brollLogic.summary}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {brollLogic.rules?.map((rule, i) => {
                    const colors = TYPE_COLORS[rule.footage_type] || 'bg-gray-100 text-gray-700';
                    return (
                      <div key={i} className={`rounded-lg p-2.5 bg-gray-50 flex flex-col gap-1`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${colors}`}>{TYPE_LABELS[rule.footage_type] || rule.footage_type}</span>
                          <p className="text-xs text-gray-500 italic">"{rule.trigger}"</p>
                        </div>
                        <p className="text-xs text-gray-400 pl-1">{rule.reason}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, background: C.surface }}>
                <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>Run a single ad analysis or group analysis to load the B-roll pairing logic.</p>
              </div>
            )}
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Script labeler</p>
              <textarea value={editorScript} onChange={e => setEditorScript(e.target.value)} placeholder={"Paste your script here — one sentence or line per paragraph.\n\nAI will label each line with the footage type that fits best."} style={{ width: '100%', fontSize: 12, color: C.text, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, resize: 'none', outline: 'none', fontFamily: 'inherit' }} rows={7} />
              <button onClick={labelScript} disabled={labelingScript || !editorScript.trim()} style={{ width: '100%', background: labelingScript || !editorScript.trim() ? C.mutedLight : C.text, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: labelingScript || !editorScript.trim() ? 'not-allowed' : 'pointer', transition: 'background 0.12s' }}>
                {labelingScript ? 'Labeling...' : 'Label script'}
              </button>
              {labeledScript?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {labeledScript.map((item, i) => {
                    const colors = TYPE_COLORS[item.footage_type] || 'bg-gray-100 text-gray-700';
                    return (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1.5">
                        <p className="text-xs text-gray-800 leading-relaxed">"{item.line}"</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${colors}`}>{TYPE_LABELS[item.footage_type] || item.footage_type}</span>
                          <p className="text-xs text-gray-400">{item.reason}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── render
  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans', sans-serif", color: C.text, background: C.bg }}>
      <ShotListSidebar />
      <EditorBriefSidebar />

      {/* ── Sidebar */}
      <div style={{ width: sidebarCollapsed ? 52 : 280, minWidth: sidebarCollapsed ? 52 : 280, height: '100%', background: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', transition: 'width 0.2s cubic-bezier(.4,0,.2,1), min-width 0.2s cubic-bezier(.4,0,.2,1)', overflow: 'hidden', flexShrink: 0, zIndex: 10 }}>

        {/* Logo */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: `1px solid ${C.border}`, gap: 10, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, background: C.accent, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '-0.5px' }}>A</span>
          </div>
          {!sidebarCollapsed && <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.4px', whiteSpace: 'nowrap' }}>Ad<span style={{ color: C.accent }}>Elf</span></span>}
        </div>

        {/* New analysis button */}
        <div style={{ padding: sidebarCollapsed ? '10px 8px' : '10px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={goHome}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: sidebarCollapsed ? 8 : '8px 12px', cursor: 'pointer', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
            <span style={{ fontSize: 16, color: C.accent, lineHeight: 1, flexShrink: 0 }}>+</span>
            {!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>New analysis</span>}
          </button>
        </div>

        {/* Library */}
        <div style={{ flex: 1, overflowY: 'auto', padding: sidebarCollapsed ? '8px 6px' : '12px 10px' }}>
          {sidebarCollapsed ? (
            library.slice(0, 8).map((entry, i) => (
              <div key={entry.id} title={entry.hook} onClick={() => openFromLibrary(entry)}
                style={{ width: 40, height: 40, borderRadius: 8, background: '#fff', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px auto', cursor: 'pointer', overflow: 'hidden' }}>
                {entry.thumbnail
                  ? <img src={entry.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>{entry.type === 'group' ? 'G' : 'S'}</span>}
              </div>
            ))
          ) : (
            library.length === 0 ? (
              <div style={{ padding: '32px 8px', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>Your library is empty.<br />Analyze an ad to get started.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, animation: 'slideIn 0.15s ease' }}>
                {library.map(entry => (
                  <div key={entry.id} style={{ position: 'relative' }}
                    onMouseEnter={e => e.currentTarget.querySelector('.card-overlay').style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.querySelector('.card-overlay').style.opacity = '0'}>
                    <button onClick={() => openFromLibrary(entry)}
                      style={{ width: '100%', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', textAlign: 'left', padding: 0, cursor: 'pointer', display: 'block', transition: 'border-color 0.12s, box-shadow 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accentBorder; e.currentTarget.style.boxShadow = '0 2px 10px rgba(37,99,235,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }}>
                      <div style={{ aspectRatio: '9/16', background: '#0d0f1a', position: 'relative', overflow: 'hidden' }}>
                        {entry.thumbnail
                          ? <img src={entry.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, paddingLeft: 2 }}>▶</span>
                              </div>
                            </div>}
                        <div style={{ position: 'absolute', top: 5, left: 5 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: entry.type === 'group' ? '#7c3aed' : C.accent, background: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: '1px 5px' }}>
                            {entry.type === 'group' ? `${entry.urls?.length || ''}` : 'Single'}
                          </span>
                        </div>
                      </div>
                      <div style={{ padding: '7px 8px 8px' }}>
                        <p style={{ fontSize: 11, color: C.text, fontWeight: 500, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {entry.hook ? `"${entry.hook}"` : '—'}
                        </p>
                        <p style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: C.mono }}>{formatDate(entry.savedAt)}</p>
                      </div>
                    </button>
                    <div className="card-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(13,15,26,0.55)', borderRadius: 10, opacity: 0, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <button onClick={e => { e.stopPropagation(); deleteEntry(entry.id); }}
                        style={{ pointerEvents: 'auto', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Collapse toggle */}
        <div style={{ padding: 10, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={() => setSidebarCollapsed(p => !p)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', gap: 8, background: 'transparent', border: 'none', padding: '6px 8px', borderRadius: 6, color: C.muted, fontSize: 12, cursor: 'pointer', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontSize: 14, display: 'inline-block', transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>←</span>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </div>

      {/* ── Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Home view */}
        {mode === 'home' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', animation: 'fadeUp 0.3s ease', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1px', color: C.text, marginBottom: 8 }}>Let's strategize your way out!</h1>
              <p style={{ fontSize: 15, color: C.muted }}>{isGroup ? 'Group analysis · find patterns across multiple ads' : 'Paste a video URL to analyze your ad'}</p>
            </div>

            <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {urls.map((url, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', animation: 'fadeUp 0.2s ease' }}>
                  {isGroup && (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.muted, flexShrink: 0 }}>{i + 1}</div>
                  )}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '13px 16px', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                    onFocus={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.accentBorder}`; }}
                    onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>🔗</span>
                    <input value={url}
                      onChange={e => { const n = [...urls]; n[i] = e.target.value; setUrls(n); }}
                      onFocus={e => e.currentTarget.parentElement.dispatchEvent(new FocusEvent('focus', { bubbles: true }))}
                      onBlur={e => e.currentTarget.parentElement.dispatchEvent(new FocusEvent('blur', { bubbles: true }))}
                      onKeyDown={e => { if (e.key === 'Enter' && i === urls.length - 1 && urls.some(u => u.trim())) handleAnalyze(); }}
                      placeholder={i === 0 ? 'Paste a .mp4 URL from swipekit.app or foreplay.co…' : `Video URL ${i + 1}…`}
                      style={{ flex: 1, fontSize: 13, color: C.text, background: 'transparent', border: 'none', outline: 'none', fontFamily: C.mono }} />
                  </div>
                  {urls.length > 1 && (
                    <button onClick={() => setUrls(urls.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '11px 16px', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.accentBorder}`; }}
                onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }}>
                <span style={{ fontSize: 12, color: C.muted, flexShrink: 0, fontWeight: 500 }}>Context</span>
                <input value={context} onChange={e => setContext(e.target.value)}
                  onFocus={e => e.currentTarget.parentElement.dispatchEvent(new FocusEvent('focus', { bubbles: true }))}
                  onBlur={e => e.currentTarget.parentElement.dispatchEvent(new FocusEvent('blur', { bubbles: true }))}
                  placeholder="Brand context, target audience… (optional)"
                  style={{ flex: 1, fontSize: 13, color: C.text, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
              </div>

              {urls.length < 6 && (
                <button onClick={() => setUrls([...urls, ''])}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', background: 'transparent', border: `1.5px dashed ${C.border}`, borderRadius: 10, padding: 9, color: C.muted, fontSize: 13, cursor: 'pointer', transition: 'border-color 0.12s, color 0.12s, background 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; e.currentTarget.style.background = C.accentLight; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>
                  <span>{isGroup ? 'Add another ad' : 'Compare with another ad'}</span>
                </button>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 2 }}>
                {isGroup && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.accent, background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 20, padding: '2px 8px' }}>
                    Group mode · {urls.filter(u => u.trim()).length} URLs
                  </span>
                )}
                <button onClick={handleAnalyze} disabled={!urls.some(u => u.trim())}
                  style={{ width: '100%', background: urls.some(u => u.trim()) ? C.accent : C.mutedLight, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: urls.some(u => u.trim()) ? 'pointer' : 'not-allowed', transition: 'background 0.15s, transform 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onMouseEnter={e => { if (urls.some(u => u.trim())) e.currentTarget.style.transform = 'scale(1.01)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                  {isGroup ? `Analyze ${urls.filter(u => u.trim()).length} ads` : 'Analyze'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analysis view */}
        {mode === 'analysis' && (
          <>
            {/* Top bar */}
            <div style={{ height: 52, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0, background: '#fff' }}>
              <button onClick={goHome}
                style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.12s', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                ← Back
              </button>
              <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />
              <div style={{ fontFamily: C.mono, fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {analysisType === 'single' ? videoUrl : `${groupUrls.filter(u => u).length} videos`}
                {(analyzingVideo || groupRunning) && (
                  <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 5, color: C.accent }}>
                    <span style={{ width: 10, height: 10, border: `2px solid ${C.accentBorder}`, borderTop: `2px solid ${C.accent}`, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Analyzing…
                  </span>
                )}
              </div>
              <button onClick={() => setEditorBriefOpen(true)}
                style={{ fontSize: 12, border: `1px solid ${C.border}`, background: '#fff', color: C.textSub, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', flexShrink: 0, fontWeight: 500, transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                Editor Brief
              </button>
              <button onClick={() => setShotListOpen(true)}
                style={{ fontSize: 12, border: `1px solid ${C.border}`, background: '#fff', color: C.textSub, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', flexShrink: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                Shot List
                {shotList.length > 0 && <span style={{ background: C.text, color: '#fff', fontSize: 10, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{shotList.length}</span>}
              </button>
            </div>

            {/* Scrollable analysis content */}
            <div style={{ flex: 1, overflowY: 'auto', animation: 'fadeUp 0.25s ease' }}>
              <div className="max-w-7xl mx-auto px-6 py-8">

                {/* ── Single analysis */}
                {analysisType === 'single' && (
                  <>
                    {analyzingVideo && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ width: 32, height: 32, border: `3px solid ${C.accentBorder}`, borderTop: `3px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
                          <p style={{ fontSize: 14, color: C.muted }}>Analyzing video… this takes 1–2 minutes</p>
                        </div>
                      </div>
                    )}
                    {videoError && <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, borderRadius: 12, padding: '12px 16px' }}>{videoError}</div>}
                    {videoAnalysis && (() => {
                      // ── helpers scoped to render
                      const timeline = videoAnalysis.timeline || [];
                      const adStructure = videoAnalysis.general?.ad_structure || [];
                      const fullTranscript = (videoAnalysis.copy_only || []).filter(c => c.text).map(c => c.text).join(' ');

                      // Map each timeline entry to its ad-structure section label
                      function getSectionForTimestamp(ts) {
                        const sec = timestampToSeconds(ts);
                        for (let i = adStructure.length - 1; i >= 0; i--) {
                          if (sec >= timestampToSeconds(adStructure[i].start)) return adStructure[i].section;
                        }
                        return null;
                      }

                      const hoveredRow = hoveredFrameIdx !== null ? timeline[hoveredFrameIdx] : null;

                      return (
                        <div style={{ display: 'flex', height: '100%', gap: 0 }}>

                          {/* ── LEFT: sticky video panel */}
                          <div style={{ width: 260, minWidth: 260, flexShrink: 0, position: 'sticky', top: 0, alignSelf: 'flex-start', paddingRight: 20 }}>
                            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                              <video ref={videoRef} src={videoUrl} controls style={{ width: '100%', display: 'block' }} />
                              <video ref={captureVideoRef} src={`/api/proxy-video?url=${encodeURIComponent(videoUrl)}`} crossOrigin="anonymous" preload="auto" style={{ display: 'none' }}
                                onLoadedMetadata={e => setVideoNaturalSize({ w: e.target.videoWidth, h: e.target.videoHeight })} />
                            </div>
                            {/* stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                              {[
                                { label: 'Total time', value: videoAnalysis.general?.duration ?? '—' },
                                { label: 'Total cuts', value: timeline.length || '—' },
                              ].map(s => (
                                <div key={s.label} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                                  <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{s.label}</p>
                                  <p style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{s.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* ── RIGHT: scrollable content */}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>

                            {/* Hook + Opener */}
                            <div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {/* Hook */}
                                <div>
                                  <p style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Hook</p>
                                  <p style={{ fontSize: 20, fontWeight: 500, color: C.text, lineHeight: 1.35 }}>"{videoAnalysis.general?.hook?.copy}"</p>
                                </div>
                                {/* Opener */}
                                <div>
                                  <p style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Opener</p>
                                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.55, flex: 1 }}>{videoAnalysis.general?.hook?.visual}</p>
                                    {openerFrame && (
                                      <div style={{ width: 52, flexShrink: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }} onClick={() => jumpToTimestamp(videoAnalysis.general?.opener?.timestamp || '00:00:00')}>
                                        <img src={openerFrame} alt="Opener" style={{ width: '100%', display: 'block' }} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Filmstrip */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <p style={{ fontSize: 11, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                  Frame by frame analysis
                                  {capturingFrames && <span style={{ marginLeft: 8, color: C.accent, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>capturing {Object.keys(capturedFrames).length}/{timeline.length}…</span>}
                                </p>
                                <button
                                  onClick={() => setFilmstripMode(m => m === 'strip' ? 'list' : 'strip')}
                                  style={{ fontSize: 11, fontWeight: 500, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                  {filmstripMode === 'strip' ? 'list view' : 'strip view'}
                                </button>
                              </div>

                              {filmstripMode === 'strip' ? (
                                <>
                                  {/* Filmstrip row */}
                                  <div style={{ position: 'relative' }}>
                                    <div ref={filmstripRef} style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'thin' }}>
                                      {timeline.map((row, i) => {
                                        const frame = capturedFrames[row.timestamp];
                                        const section = getSectionForTimestamp(row.timestamp);
                                        const sectionColor = SECTION_COLORS[section]?.bg || '#9ca3af';
                                        const isHovered = hoveredFrameIdx === i;
                                        const alreadyAdded = frame && shotList.some(s => s.thumbnail === frame);
                                        return (
                                          <div
                                            key={i}
                                            onMouseEnter={() => setHoveredFrameIdx(i)}
                                            onMouseLeave={() => setHoveredFrameIdx(null)}
                                            onClick={() => jumpToTimestamp(row.timestamp)}
                                            style={{ flexShrink: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 0 }}>
                                            {/* thumb */}
                                            <div style={{
                                              width: 100, aspectRatio: videoNaturalSize ? `${videoNaturalSize.w}/${videoNaturalSize.h}` : '9/16',
                                              borderRadius: 8, overflow: 'hidden', background: '#1a1c2e',
                                              outline: isHovered ? `2px solid ${C.accent}` : '2px solid transparent',
                                              outlineOffset: 1,
                                              transition: 'outline-color 0.1s',
                                              position: 'relative',
                                            }}>
                                              {frame
                                                ? <img src={frame} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: isHovered ? 1 : 0.82, transition: 'opacity 0.1s' }} />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {capturingFrames
                                                      ? <div style={{ width: 10, height: 10, border: `1.5px solid rgba(255,255,255,0.15)`, borderTop: `1.5px solid rgba(255,255,255,0.5)`, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                                      : <span style={{ fontFamily: C.mono, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{row.timestamp}</span>}
                                                  </div>}
                                              {/* + add button — always visible when frame is ready */}
                                              {frame && (
                                                <div
                                                  style={{ position: 'absolute', bottom: 5, right: 5 }}
                                                  onClick={async e => {
                                                    e.stopPropagation();
                                                    if (alreadyAdded) return;
                                                    // Capture high-res version (540px) for PDF quality
                                                    const vid = captureVideoRef.current;
                                                    const nw = vid?.videoWidth || 9;
                                                    const nh = vid?.videoHeight || 16;
                                                    const hqThumb = vid ? await captureFrameFromVideo(vid, row.timestamp, 540, Math.round(540 * nh / nw)) : null;
                                                    addToShotList({ thumbnail: frame, hqThumbnail: hqThumb || frame, annotation: row.visual, shootDirection: '', source: `${urlFilename} · ${row.timestamp}`, videoUrl });
                                                  }}>
                                                  <div style={{
                                                    width: 22, height: 22, borderRadius: '50%',
                                                    background: alreadyAdded ? 'rgba(37,99,235,0.9)' : 'rgba(255,255,255,0.85)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 13, fontWeight: 700, lineHeight: 1,
                                                    color: alreadyAdded ? '#fff' : C.text,
                                                    cursor: alreadyAdded ? 'default' : 'pointer',
                                                    transition: 'background 0.12s',
                                                    backdropFilter: 'blur(2px)',
                                                    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                                  }}>
                                                    {alreadyAdded ? '✓' : '+'}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                            {/* section color bar */}
                                            <div style={{ height: 3, background: sectionColor, borderRadius: '0 0 3px 3px', marginTop: 2 }} />
                                            {/* section label */}
                                            <p style={{ fontSize: 9, color: sectionColor, fontWeight: 600, marginTop: 3, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{section || ''}</p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {/* Scroll arrow */}
                                    <button
                                      onClick={() => filmstripRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                                      style={{ position: 'absolute', right: -14, top: '38%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', border: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, color: C.textSub, zIndex: 2 }}>
                                      ›
                                    </button>
                                  </div>

                                  {/* Hovered line detail */}
                                  <div style={{
                                    marginTop: 12, minHeight: 64, background: C.surface, borderRadius: 10, padding: '12px 16px',
                                    border: `1px solid ${hoveredRow ? C.accentBorder : C.border}`,
                                    transition: 'border-color 0.15s',
                                    display: 'flex', flexDirection: 'column', gap: 6,
                                  }}>
                                    {hoveredRow ? (
                                      <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.accent }}>{hoveredRow.timestamp}</span>
                                          {(() => {
                                            const section = getSectionForTimestamp(hoveredRow.timestamp);
                                            const sc = SECTION_COLORS[section];
                                            const tc = TYPE_COLORS_INLINE[hoveredRow.type] || { bg: '#f3f4f6', color: '#6b7280' };
                                            return (
                                              <>
                                                {section && sc && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: sc.light === 'bg-gray-50' ? '#f9fafb' : undefined, color: sc.bg }}>{section}</span>}
                                                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: tc.bg, color: tc.color }}>{TYPE_LABELS[hoveredRow.type] || hoveredRow.type}</span>
                                              </>
                                            );
                                          })()}
                                        </div>
                                        <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.5 }}>{hoveredRow.visual}</p>
                                        {hoveredRow.copy && <p style={{ fontSize: 13, color: C.text, fontWeight: 500, lineHeight: 1.5 }}>"{hoveredRow.copy}"</p>}
                                      </>
                                    ) : (
                                      <p style={{ fontSize: 12, color: C.mutedLight, lineHeight: 1.5 }}>Hover over a frame to see the transcript, scene description, and footage type.</p>
                                    )}
                                  </div>
                                </>
                              ) : (
                                /* List view */
                                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                                  {timeline.map((row, i) => {
                                    const frame = capturedFrames[row.timestamp];
                                    const section = getSectionForTimestamp(row.timestamp);
                                    const sc = SECTION_COLORS[section];
                                    const tc = TYPE_COLORS_INLINE[row.type] || { bg: '#f3f4f6', color: '#6b7280' };
                                    return (
                                      <div key={i}
                                        onClick={() => jumpToTimestamp(row.timestamp)}
                                        style={{ display: 'flex', gap: 14, padding: '12px 16px', borderBottom: i < timeline.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHover; setHoveredFrameIdx(i); }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; setHoveredFrameIdx(null); }}>
                                        {/* thumb */}
                                        <div style={{ width: 48, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: '#1a1c2e', aspectRatio: videoNaturalSize ? `${videoNaturalSize.w}/${videoNaturalSize.h}` : '9/16' }}>
                                          {frame
                                            ? <img src={frame} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: C.mono, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{row.timestamp}</span></div>}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            <span style={{ fontFamily: C.mono, fontSize: 11, color: C.accent, flexShrink: 0 }}>{row.timestamp}</span>
                                            {section && sc && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: sc.light === 'bg-gray-50' ? '#f9fafb' : undefined, color: sc.bg, flexShrink: 0 }}>{section}</span>}
                                            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: tc.bg, color: tc.color, flexShrink: 0 }}>{TYPE_LABELS[row.type] || row.type}</span>
                                          </div>
                                          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.5, marginBottom: row.copy ? 3 : 0 }}>{row.visual}</p>
                                          {row.copy && <p style={{ fontSize: 12, color: C.text, fontStyle: 'italic', lineHeight: 1.5 }}>"{row.copy}"</p>}
                                        </div>
                                        {frame && (
                                          <div style={{ flexShrink: 0, alignSelf: 'center' }} onClick={async e => {
                                            e.stopPropagation();
                                            const already = shotList.some(s => s.thumbnail === frame);
                                            if (already) return;
                                            const vid = captureVideoRef.current;
                                            const nw = vid?.videoWidth || 9; const nh = vid?.videoHeight || 16;
                                            const hqThumb = vid ? await captureFrameFromVideo(vid, row.timestamp, 540, Math.round(540 * nh / nw)) : null;
                                            addToShotList({ thumbnail: frame, hqThumbnail: hqThumb || frame, annotation: row.visual, shootDirection: '', source: `${urlFilename} · ${row.timestamp}`, videoUrl });
                                          }}>
                                            <AddToShotListBtn thumbnail={frame} annotation={row.visual} shootDirection="" source={`${urlFilename} · ${row.timestamp}`} videoUrl={videoUrl} />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Ad structure bar */}
                            <AdStructureBar data={adStructure} duration={videoAnalysis.general?.duration} brandReveal={videoAnalysis.general?.brand_reveal?.timestamp} productReveal={videoAnalysis.general?.product_reveal?.timestamp} />

                            {/* Full script */}
                            {fullTranscript && (
                              <div>
                                <p style={{ fontSize: 11, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Full script</p>
                                <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8 }}>{fullTranscript}</p>
                              </div>
                            )}

                            {/* Value propositions */}
                            {videoAnalysis.general?.value_propositions?.length > 0 && (
                              <div>
                                <p style={{ fontSize: 11, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Value proposition</p>
                                <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                                  {videoAnalysis.general.value_propositions.map((vp, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: i < videoAnalysis.general.value_propositions.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                      <div style={{ padding: '12px 16px', borderRight: `1px solid ${C.border}`, background: '#fff' }}>
                                        <p style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{vp.summary ?? vp}</p>
                                      </div>
                                      <div style={{ padding: '12px 16px', background: C.surface }}>
                                        <p style={{ fontSize: 13, color: C.textSub, fontStyle: vp.copy ? 'italic' : 'normal' }}>{vp.copy || '—'}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Why this works */}
                            {videoAnalysis.general?.why_this_works && (
                              <div>
                                <p style={{ fontSize: 11, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Why this works</p>
                                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
                                  <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8 }}>{videoAnalysis.general.why_this_works}</p>
                                </div>
                              </div>
                            )}

                            {/* Editor brief CTA */}
                            {videoAnalysis.broll_logic && (
                              <button onClick={() => setEditorBriefOpen(true)}
                                style={{ width: '100%', background: C.surface, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: '11px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.12s', fontFamily: 'inherit' }}
                                onMouseEnter={e => e.currentTarget.style.background = C.accentLight}
                                onMouseLeave={e => e.currentTarget.style.background = C.surface}>
                                Apply this editing logic to a script →
                              </button>
                            )}

                          </div>{/* /right col */}
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* ── Group analysis */}
                {analysisType === 'group' && (
                  <div className="flex flex-col gap-4">
                    {/* hidden capture videos */}
                    <div style={{ display: 'none' }}>
                      {groupUrls.filter(u => u.trim()).map((url, i) => (
                        <video key={i} ref={el => groupVideoRefs.current[i] = el}
                          src={`/api/proxy-video?url=${encodeURIComponent(url)}`}
                          crossOrigin="anonymous" preload="auto" />
                      ))}
                    </div>

                    {groupRunning && (
                      <div className="flex items-center justify-center py-32">
                        <div className="text-center">
                          <div style={{ width: 32, height: 32, border: `3px solid ${C.accentBorder}`, borderTop: `3px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
                          <p style={{ fontSize: 14, color: C.muted }}>Analyzing group… this may take a few minutes</p>
                        </div>
                      </div>
                    )}
                    {groupError && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{groupError}</div>}

                    {groupResult && (
                      <div className="flex flex-col gap-4">

                        {/* ── Source videos — individual analyze buttons */}
                        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px' }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Source videos</p>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {groupUrls.filter(u => u.trim()).map((url, idx) => {
                              // Find first key frame thumbnail for this video
                              const kf = groupResult.key_frames?.find(k => k.video_index === idx);
                              const thumb = kf ? groupKeyFrames[`${kf.video_index}:${kf.timestamp}`] : null;
                              const filename = url.split('/').pop()?.split('.')[0]?.slice(0, 28) || `Video ${idx + 1}`;
                              return (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px 8px 8px', flex: '1 1 200px', minWidth: 0 }}>
                                  {/* thumb */}
                                  <div style={{ width: 36, height: 64, borderRadius: 6, overflow: 'hidden', background: '#1a1c2e', flexShrink: 0 }}>
                                    {thumb && <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 2 }}>Video {idx + 1}</p>
                                    <p style={{ fontSize: 10, color: C.muted, fontFamily: C.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</p>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      // Switch to single analysis for this URL
                                      setVideoUrl(url); setVideoContext('');
                                      setAnalysisType('single'); setMode('analysis');
                                      setVideoError(''); setCapturedFrames({}); setOpenerFrame(null);
                                      setAnalyzingVideo(true); setVideoAnalysis(null);
                                      try {
                                        const res = await fetch('/api/analyze-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: url, adContext: '' }) });
                                        const data = await res.json();
                                        if (data.error) return setVideoError(data.error);
                                        setVideoAnalysis(data.analysis);
                                        autoSaveSingle(url, data.analysis);
                                      } catch { setVideoError('Something went wrong. Please try again.'); }
                                      finally { setAnalyzingVideo(false); }
                                    }}
                                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: C.accent, background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                    Analyze →
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {groupResult.key_frames?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Key frames</p>
                            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                              {groupResult.key_frames.map((kf, i) => {
                                const key = `${kf.video_index}:${kf.timestamp}`;
                                const frame = groupKeyFrames[key];
                                return (
                                  <div key={i} className="flex flex-col gap-2">
                                    <div className="relative rounded-lg overflow-hidden bg-gray-100" style={{ aspectRatio: '9/16' }}>
                                      {frame ? <img src={frame} alt="" className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-xs text-gray-300 font-mono">{kf.timestamp}</span></div>}
                                      {frame && (
                                        <div className="absolute top-1.5 right-1.5" onClick={e => e.stopPropagation()}>
                                          <AddToShotListBtn thumbnail={frame} annotation={kf.visual} shootDirection={kf.shoot_direction} source={`Group · Video ${kf.video_index + 1} · ${kf.timestamp}`} videoUrl={groupUrls[kf.video_index]} />
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-xs font-mono text-blue-500">{kf.timestamp}</p>
                                      <p className="text-xs text-gray-600 leading-snug mt-0.5">{kf.visual}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {groupResult.common_hooks?.length > 0 && (
                          <div className="flex flex-col gap-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Common hooks</p>
                            {groupResult.common_hooks.map((h, i) => (
                              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                                <p className="text-xl font-medium text-gray-900 leading-snug mb-2">"{h.copy}"</p>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Appears in {h.appears_in} ads</span>
                                  <p className="text-xs text-gray-500">{h.strategy}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {groupResult.keyword_clusters?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Keyword clusters</p>
                            <div className="flex flex-wrap gap-2">
                              {groupResult.keyword_clusters.map((k, i) => (
                                <span key={i} className={`bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-medium ${k.frequency === 'high' ? 'text-base' : k.frequency === 'medium' ? 'text-sm' : 'text-xs'}`}>{k.word}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {groupResult.visual_pattern && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Visual pattern</p>
                            <div className="flex flex-col gap-2">
                              {[{ label: 'Setting', value: groupResult.visual_pattern.setting }, { label: 'Text treatment', value: groupResult.visual_pattern.text_treatment }, { label: 'Color palette', value: groupResult.visual_pattern.color_palette }, { label: 'Editing pace', value: groupResult.visual_pattern.editing_pace }].map(item => item.value ? (
                                <div key={item.label} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                                  <p className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">{item.label}</p>
                                  <p className="text-xs text-gray-700 leading-relaxed">{item.value}</p>
                                </div>
                              ) : null)}
                            </div>
                          </div>
                        )}

                        {groupResult.ad_structure_template?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Typical ad structure</p>
                            <div className="flex flex-col gap-2">
                              {groupResult.ad_structure_template.map((s, i) => {
                                const c = SECTION_COLORS[s.section] || { light: 'bg-gray-50', text: 'text-gray-700' };
                                return (
                                  <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${c.light} ${c.text}`}>{s.section}</span>
                                    <p className="text-xs text-gray-600 leading-relaxed">{s.description}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {groupResult.talent_pattern && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Talent pattern</p>
                            <div className="flex flex-col gap-2">
                              {[{ label: 'Appearance', value: groupResult.talent_pattern.appearance }, { label: 'Clothing', value: groupResult.talent_pattern.clothing }, { label: 'Setting', value: groupResult.talent_pattern.setting }, { label: 'Energy', value: groupResult.talent_pattern.energy }].map(item => item.value ? (
                                <div key={item.label} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                                  <p className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{item.label}</p>
                                  <p className="text-xs text-gray-700 leading-relaxed">{item.value}</p>
                                </div>
                              ) : null)}
                            </div>
                          </div>
                        )}

                        {groupResult.strongest_patterns?.length > 0 && (
                          <div className="flex flex-col gap-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Strongest patterns</p>
                            {groupResult.strongest_patterns.map((p, i) => (
                              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-medium flex-shrink-0">{i + 1}</div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900 mb-1">{p.title}</p>
                                  <p className="text-sm text-gray-500 leading-relaxed">{p.observation}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {groupResult.broll_logic && (
                          <button onClick={() => setEditorBriefOpen(true)} style={{ width: '100%', background: C.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                            onMouseLeave={e => e.currentTarget.style.background = C.accent}>
                            Apply this editing logic to a script →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
