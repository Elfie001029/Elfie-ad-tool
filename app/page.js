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
  const [urls, setUrls] = useState(['', '']);
  const [context, setContext] = useState('');
  const [analysisType, setAnalysisType] = useState('single'); // 'single' | 'group'
  const freshGroupAnalysis = useRef(false);

  // ── shot list
  const [shotList, setShotList] = useState([]);
  const [shotListOpen, setShotListOpen] = useState(false);
  const [shotListExpanded, setShotListExpanded] = useState(false);
  const [briefNotes, setBriefNotes] = useState('');
  const [pdfTitle, setPdfTitle] = useState('Shot List');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [sections, setSections] = useState([]);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const dragData = useRef(null);

  // ── library
  const [library, setLibrary] = useState([]);

  // ── analyze single
  const [videoUrl, setVideoUrl] = useState('');
  const [videoContext, setVideoContext] = useState('');
  const [videoAnalysis, setVideoAnalysis] = useState(null);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [extractingFb, setExtractingFb] = useState(false);
  const [expandedSectionIds, setExpandedSectionIds] = useState(new Set());
  function toggleSectionExpanded(id) {
    setExpandedSectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const videoRef = useRef(null);
  const captureVideoRef = useRef(null);
  const scrollContainerRef = useRef(null);
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
  const [groupKeyFrames, setGroupKeyFrames] = useState({}); // "vidIdx:timestamp" → dataUrl
  const [groupFirstFrames, setGroupFirstFrames] = useState({}); // vidIdx → dataUrl
  const [groupSelectedVideoIdx, setGroupSelectedVideoIdx] = useState(null);
  const [groupHoveredFrame, setGroupHoveredFrame] = useState(null); // { videoIdx, frameIdx }
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
    const filledUrls = groupUrls.filter(u => u.trim());
    // Support new video_analyses structure and old key_frames fallback
    const frames = groupResult?.video_analyses
      ? groupResult.video_analyses.flatMap(va => va.frames.map(f => ({ ...f, video_index: va.video_index })))
      : (groupResult?.key_frames || []);
    if (!frames.length) return;
    captureGroupFrames(frames, filledUrls, groupResult);
  }, [groupResult]);

  // ── navigation
  function goHome() {
    setMode('home');
    setUrls(['', '']); setContext('');
    setVideoAnalysis(null); setGroupResult(null);
    setVideoError(''); setGroupError('');
    setCapturedFrames({}); setOpenerFrame(null); setGroupKeyFrames({}); setGroupFirstFrames({}); setGroupSelectedVideoIdx(null); setGroupHoveredFrame(null);
  }

  // ── main analyze handler
  function isFbUrl(url) {
    return /facebook\.com|fb\.watch|fb\.com/i.test(url);
  }

  async function resolveFbUrls(urlList) {
    if (!urlList.some(isFbUrl)) return urlList;
    setExtractingFb(true);
    try {
      return await Promise.all(urlList.map(async url => {
        if (!isFbUrl(url)) return url;
        const res = await fetch('/api/process-fb-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data.url;
      }));
    } finally {
      setExtractingFb(false);
    }
  }

  async function handleAnalyze() {
    const filled = urls.filter(u => u.trim());
    if (!filled.length) return;

    let resolved;
    try { resolved = await resolveFbUrls(filled); }
    catch (err) { setVideoError(err.message || 'Failed to extract Facebook video'); return; }

    if (resolved.length === 1) {
      const url = resolved[0];
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
      setGroupUrls(resolved); setGroupContext(context);
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
    const entry = {
      id: Date.now().toString(), type: 'single',
      urls: [url], analysis, groupResult: null,
      savedAt: new Date().toISOString(), thumbnail: null,
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
  async function captureGroupFrames(frameList, urls, result) {
    const frames = {};
    const firstFrames = {};
    for (const kf of frameList) {
      const video = groupVideoRefs.current[kf.video_index];
      if (!video) continue;
      if (video.readyState < 1) {
        await new Promise(resolve => {
          video.addEventListener('loadedmetadata', resolve, { once: true });
          if (video.networkState === 0) video.load();
        });
      }
      const nw = video.videoWidth || 9; const nh = video.videoHeight || 16;
      const w = 1080; const h = Math.round(w * nh / nw);
      const dataUrl = await captureFrameFromVideo(video, kf.timestamp, w, h);
      const key = `${kf.video_index}:${kf.timestamp}`;
      frames[key] = dataUrl;
      // Track first captured frame per video for left panel thumbnail
      if (!firstFrames[kf.video_index] && dataUrl) firstFrames[kf.video_index] = dataUrl;
      setGroupKeyFrames({ ...frames });
      setGroupFirstFrames({ ...firstFrames });
    }
    if (freshGroupAnalysis.current) {
      freshGroupAnalysis.current = false;
      const thumbnail = await createGroupThumbnail(Object.values(firstFrames));
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
    const w = 1080; const h = Math.round(w * nh / nw);
    const frames = {};
    for (const row of videoAnalysis.timeline) {
      frames[row.timestamp] = await captureFrameFromVideo(video, row.timestamp, w, h);
      setCapturedFrames({ ...frames });
    }
    setCapturingFrames(false);

    // Backfill library thumbnail for this entry once frames are ready
    const firstFrame = frames[videoAnalysis.timeline[0]?.timestamp];
    if (firstFrame && videoUrl) {
      const lib = getLibrary();
      const idx = lib.findIndex(e => (e.urls?.[0] === videoUrl || e.url === videoUrl) && !e.thumbnail);
      if (idx !== -1) {
        lib[idx] = { ...lib[idx], thumbnail: firstFrame };
        persistLibrary(lib);
        setLibrary([...lib]);
      }
    }
  }

  // ── library
  function openFromLibrary(entry) {
    if (entry.type === 'group') {
      setGroupUrls(entry.urls || []); setGroupContext('');
      setGroupResult(entry.groupResult); setGroupKeyFrames({}); setGroupFirstFrames({}); setGroupSelectedVideoIdx(null); setGroupHoveredFrame(null);
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
    setShotList(prev => [...prev, { id: Date.now().toString() + Math.random(), thumbnail, hqThumbnail: hqThumbnail || thumbnail, annotation: annotation || '', shootDirection: shootDirection || '', source: source || '', videoUrl: itemVideoUrl || '', sectionId: null }]);
    setShotListOpen(true);
  }
  function removeFromShotList(id) { setShotList(prev => prev.filter(i => i.id !== id)); }
  function updateShotListItem(id, field, value) {
    setShotList(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  // ── section helpers
  function addSection() {
    const id = Date.now().toString() + Math.random();
    setSections(prev => [...prev, { id, name: 'New category' }]);
    setEditingSectionId(id);
  }
  function updateSectionName(id, name) { setSections(prev => prev.map(s => s.id === id ? { ...s, name } : s)); }
  function deleteSection(id) {
    setSections(prev => prev.filter(s => s.id !== id));
    setShotList(prev => prev.map(sh => sh.sectionId === id ? { ...sh, sectionId: null } : sh));
  }

  // ── drag and drop handlers
  function handleDragStartShot(shotId) { dragData.current = { type: 'shot', id: shotId }; }
  function handleDragStartSection(sectionId) { dragData.current = { type: 'section', id: sectionId }; }
  function handleDropOnSection(e, targetSectionId) {
    e.preventDefault(); e.stopPropagation();
    const d = dragData.current; if (!d) { setDragOverTarget(null); return; }
    if (d.type === 'shot') {
      setShotList(prev => prev.map(s => s.id === d.id ? { ...s, sectionId: targetSectionId } : s));
      setExpandedSectionIds(prev => { const next = new Set(prev); next.delete(targetSectionId); return next; });
    } else if (d.type === 'section' && d.id !== targetSectionId) {
      setSections(prev => {
        const arr = [...prev];
        const fi = arr.findIndex(s => s.id === d.id); const ti = arr.findIndex(s => s.id === targetSectionId);
        if (fi === -1 || ti === -1) return prev;
        const [item] = arr.splice(fi, 1); arr.splice(ti, 0, item); return arr;
      });
    }
    setDragOverTarget(null); dragData.current = null;
  }
  function handleDropOnUnsorted(e) {
    e.preventDefault();
    const d = dragData.current; if (!d || d.type !== 'shot') { setDragOverTarget(null); return; }
    setShotList(prev => prev.map(s => s.id === d.id ? { ...s, sectionId: null } : s));
    setDragOverTarget(null); dragData.current = null;
  }
  function handleDropOnShot(e, targetShot) {
    e.preventDefault(); e.stopPropagation();
    const d = dragData.current; if (!d || d.type !== 'shot' || d.id === targetShot.id) { setDragOverTarget(null); return; }
    setShotList(prev => {
      const arr = [...prev];
      const fi = arr.findIndex(s => s.id === d.id);
      const dragged = { ...arr[fi], sectionId: targetShot.sectionId ?? null };
      arr.splice(fi, 1);
      const ti = arr.findIndex(s => s.id === targetShot.id);
      arr.splice(ti, 0, dragged);
      return arr;
    });
    setDragOverTarget(null); dragData.current = null;
  }

  // ── PDF download
  async function downloadPDF() {
    setPdfDownloading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 28;
      const contentW = pageW - margin * 2;
      const colGap = 14; const rowGap = 16;
      const cardW = (contentW - colGap) / 2;
      const thumbH = 250;
      const thumbW = Math.round(thumbH * 9 / 16);
      const thumbXOff = Math.round((cardW - thumbW) / 2);
      const textPad = 8;
      const cardH = thumbH + 100;
      const sectionHeaderH = 28;

      let y = margin;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(20, 20, 20);
      doc.text(pdfTitle || 'Shot List', margin, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(160, 160, 160);
      doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageW - margin, y, { align: 'right' });
      y += 28;

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
      doc.line(margin, y, pageW - margin, y); y += 16;

      const allGroups = [
        ...sections.map(s => ({ name: s.name, shots: shotList.filter(sh => sh.sectionId === s.id) })).filter(g => g.shots.length),
        { name: null, shots: shotList.filter(sh => !sh.sectionId || !sections.find(s => s.id === sh.sectionId)) },
      ].filter(g => g.shots.length);

      let globalShotIdx = 0;

      function renderCard(item, shotNum, cardX, cardY) {
        const imgSrc = item.hqThumbnail || item.thumbnail;
        doc.setFillColor(248, 249, 251); doc.setDrawColor(226, 228, 236); doc.setLineWidth(0.5);
        doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6, 'FD');
        const imgX = cardX + thumbXOff; const imgY2 = cardY + 10;
        if (imgSrc) { try { doc.addImage(imgSrc, 'JPEG', imgX, imgY2, thumbW, thumbH, undefined, 'NONE'); } catch {} }
        else { doc.setFillColor(220, 222, 230); doc.roundedRect(imgX, imgY2, thumbW, thumbH, 3, 3, 'F'); }
        doc.setFillColor(13, 15, 26); doc.roundedRect(cardX + 6, cardY + 6, 18, 14, 3, 3, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
        doc.text(String(shotNum), cardX + 15, cardY + 15, { align: 'center' });
        let tY = cardY + 10 + thumbH + 12;
        const maxW = cardW - textPad * 2;
        if (item.source) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(160, 160, 160); doc.text(item.source, cardX + textPad, tY, { maxWidth: maxW }); tY += 11; }
        if (item.annotation) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20); const al = doc.splitTextToSize(item.annotation, maxW).slice(0, 3); doc.text(al, cardX + textPad, tY); tY += al.length * 12 + 6; }
        if (item.videoUrl) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(37, 99, 235);
          const urlText = item.videoUrl.length > 55 ? item.videoUrl.slice(0, 52) + '...' : item.videoUrl;
          doc.text(urlText, cardX + textPad, tY, { maxWidth: maxW });
          try { doc.link(cardX + textPad, tY - 7, maxW, 9, { url: item.videoUrl }); } catch {}
        }
      }

      for (const group of allGroups) {
        if (group.name) {
          if (y + sectionHeaderH > pageH - margin) { doc.addPage(); y = margin; }
          doc.setFillColor(240, 241, 246); doc.setDrawColor(220, 222, 230); doc.setLineWidth(0.5);
          doc.roundedRect(margin, y, contentW, sectionHeaderH - 4, 4, 4, 'FD');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 40);
          doc.text(group.name.toUpperCase(), margin + 12, y + 17);
          y += sectionHeaderH + 6;
        }
        for (let i = 0; i < group.shots.length; i += 2) {
          if (y + cardH > pageH - margin) { doc.addPage(); y = margin; }
          renderCard(group.shots[i], ++globalShotIdx, margin, y);
          if (group.shots[i + 1]) renderCard(group.shots[i + 1], ++globalShotIdx, margin + cardW + colGap, y);
          y += cardH + rowGap;
        }
        y += 8;
      }

      const filename = (pdfTitle || 'shot-list').replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '');
      doc.save(`${filename}.pdf`);
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
    const isExpanded = shotListExpanded;
    const unsortedShots = shotList.filter(sh => !sh.sectionId || !sections.find(s => s.id === sh.sectionId));
    // Global shot order for badge numbers: sections first, unsorted last
    const orderedForBadge = [
      ...sections.flatMap(s => shotList.filter(sh => sh.sectionId === s.id)),
      ...unsortedShots,
    ];
    const shotNum = (id) => orderedForBadge.findIndex(s => s.id === id) + 1;

    const SECTION_COLORS = [
      { bg: '#dbeafe', border: '#60a5fa' },
      { bg: '#dcfce7', border: '#4ade80' },
      { bg: '#fef3c7', border: '#fbbf24' },
      { bg: '#ede9fe', border: '#a78bfa' },
      { bg: '#ffe4e6', border: '#fb7185' },
      { bg: '#ccfbf1', border: '#2dd4bf' },
      { bg: '#ffedd5', border: '#fb923c' },
    ];

    function renderShotCard(item) {
      const isDragOver = dragOverTarget === `shot-${item.id}`;
      return (
        <div key={item.id}
          draggable
          onDragStart={e => { e.stopPropagation(); handleDragStartShot(item.id); }}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverTarget(`shot-${item.id}`); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTarget(null); }}
          onDrop={e => handleDropOnShot(e, item)}
          style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${isDragOver ? C.accent : C.border}`, transition: 'border-color 0.1s', userSelect: 'none', cursor: 'grab' }}>
          {/* Thumbnail */}
          <div style={{ position: 'relative', aspectRatio: '9/16', background: '#1a1c2e', flexShrink: 0 }}>
            {item.thumbnail && <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
            <div style={{ position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: '50%', background: 'rgba(13,15,26,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{shotNum(item.id)}</span>
            </div>
            <button onClick={e => { e.stopPropagation(); removeFromShotList(item.id); }}
              style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: 'rgba(13,15,26,0.6)', border: 'none', color: '#fff', fontSize: 13, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          {/* Note + URL */}
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              value={item.annotation}
              onChange={e => updateShotListItem(item.id, 'annotation', e.target.value.slice(0, 200))}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
              placeholder="Add a note…"
              maxLength={200}
              rows={2}
              style={{ width: '100%', fontSize: 12, color: C.text, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 9px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, overflow: 'hidden' }} />
            {item.videoUrl && (
              <a href={item.videoUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ fontSize: 10, color: C.accent, wordBreak: 'break-all', lineHeight: 1.4, textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                {item.videoUrl}
              </a>
            )}
          </div>
        </div>
      );
    }

    function handleDragOverScroll(e) {
      e.preventDefault();
      const el = scrollContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const zone = 80;
      if (y < zone) el.scrollTop -= Math.round((zone - y) / 4);
      else if (y > rect.height - zone) el.scrollTop += Math.round((y - rect.height + zone) / 4);
    }

    function renderFilmstrip(shots) {
      const visible = shots.slice(0, 8);
      const extra = shots.length - 8;
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', overflow: 'hidden', padding: '0 12px 10px' }}>
          {visible.map(shot => (
            <div key={shot.id} style={{ width: 34, aspectRatio: '9/16', borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: '#1a1c2e' }}>
              {shot.thumbnail && <img src={shot.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
            </div>
          ))}
          {extra > 0 && <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>+{extra}</span>}
        </div>
      );
    }

    function renderShotsGrid(shots) {
      return isExpanded
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 10 }}>{shots.map(s => renderShotCard(s))}</div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>{shots.map(s => renderShotCard(s))}</div>;
    }

    const containerStyle = isExpanded
      ? { position: 'fixed', inset: 0, zIndex: 60, background: '#f8f9fb', display: 'flex', flexDirection: 'column' }
      : { position: 'fixed', top: 0, right: 0, height: '100%', width: 520, background: '#fff', borderLeft: `1px solid ${C.border}`, boxShadow: '0 0 40px rgba(0,0,0,0.12)', zIndex: 50, display: 'flex', flexDirection: 'column', transition: 'transform 0.3s', transform: shotListOpen ? 'translateX(0)' : 'translateX(100%)' };

    return (
      <>
        {shotListOpen && !isExpanded && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 40 }} onClick={() => setShotListOpen(false)} />}
        <div style={containerStyle}>

          {/* Header */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: '#fff' }}>
            {isExpanded && (
              <button onClick={() => setShotListExpanded(false)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: C.textSub, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', flexShrink: 0 }}>← Back</button>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {isEditingTitle
                ? <input autoFocus value={pdfTitle} onChange={e => setPdfTitle(e.target.value)}
                    onBlur={() => setIsEditingTitle(false)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setIsEditingTitle(false); }}
                    style={{ fontSize: 14, fontWeight: 700, color: C.text, border: 'none', outline: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit' }} />
                : <p onClick={() => setIsEditingTitle(true)} title="Click to rename" style={{ fontSize: 14, fontWeight: 700, color: C.text, cursor: 'text', display: 'inline-block' }}>{pdfTitle}</p>
              }
              <p style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{shotList.length} {shotList.length === 1 ? 'frame' : 'frames'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {!isExpanded && (
                <button onClick={() => { setShotListExpanded(true); setShotListOpen(false); }} title="Full screen"
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.muted, fontSize: 14 }}>⤢</button>
              )}
              {shotList.length > 0 && <button onClick={() => setShotList([])} style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>}
              {!isExpanded && <button onClick={() => setShotListOpen(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>}
            </div>
          </div>

          {/* Brief notes */}
          <div style={{ padding: isExpanded ? '12px 80px' : '12px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: '#fff' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Brief notes</p>
            <textarea value={briefNotes} onChange={e => setBriefNotes(e.target.value)} placeholder="Add context, brand notes, or directions for the CP..."
              style={{ width: '100%', fontSize: 12, color: C.text, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, resize: 'none', outline: 'none', fontFamily: 'inherit' }} rows={2} />
          </div>

          {/* Scrollable content */}
          {isExpanded ? (
            /* EXPANDED: sticky categories + always-visible unsorted below */
            <div ref={scrollContainerRef} onDragOver={handleDragOverScroll} onDrop={handleDropOnUnsorted} style={{ flex: 1, overflowY: 'auto' }}>

              {/* Sticky bins — categories */}
              <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8f9fb', padding: '12px 80px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ marginBottom: sections.length > 0 ? 10 : 0 }}>
                  <button onClick={addSection} style={{ fontSize: 12, fontWeight: 600, color: C.accent, background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add category</button>
                </div>
                {sections.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {sections.map((section, si) => {
                      const sectionShots = shotList.filter(sh => sh.sectionId === section.id);
                      const isDragOver = dragOverTarget === `section-${section.id}`;
                      const isOpen = expandedSectionIds.has(section.id);
                      const color = SECTION_COLORS[si % SECTION_COLORS.length];
                      const displayShots = sectionShots.slice(0, 10);
                      const overflow = sectionShots.length - 10;
                      return (
                        <div key={section.id}
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverTarget(`section-${section.id}`); }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTarget(null); }}
                          onDrop={e => handleDropOnSection(e, section.id)}
                          style={{ gridColumn: isOpen ? '1 / -1' : 'auto', border: `1.5px dashed ${isDragOver ? C.accent : color.border}`, borderRadius: 12, background: isDragOver ? C.accentLight : color.bg, transition: 'border-color 0.1s, background 0.1s', overflow: 'hidden' }}>
                          {/* Header: drag | trash | name | chevron */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', cursor: 'pointer' }}
                            onClick={() => toggleSectionExpanded(section.id)}>
                            <span style={{ color: C.muted, fontSize: 12, flexShrink: 0, cursor: 'grab' }}
                              draggable onDragStart={e => { e.stopPropagation(); handleDragStartSection(section.id); }}
                              onClick={e => e.stopPropagation()}>⠿</span>
                            <button onClick={e => { e.stopPropagation(); deleteSection(section.id); }} title="Delete category"
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0, opacity: 0.6 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {editingSectionId === section.id
                                ? <input autoFocus value={section.name} onChange={e => updateSectionName(section.id, e.target.value)} onBlur={() => setEditingSectionId(null)} onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingSectionId(null); }} onClick={e => e.stopPropagation()} style={{ fontSize: 11, fontWeight: 700, color: C.text, border: 'none', outline: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.06em' }} />
                                : <span onClick={e => { e.stopPropagation(); setEditingSectionId(section.id); }} style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'text' }}>
                                    {section.name} <span style={{ fontWeight: 400, color: C.muted }}>({sectionShots.length})</span>
                                  </span>
                              }
                            </div>
                            <span style={{ fontSize: 14, color: C.textSub, flexShrink: 0, fontWeight: 600 }}>{isOpen ? '▾' : '▸'}</span>
                          </div>
                          {!isOpen && sectionShots.length > 0 && renderFilmstrip(sectionShots)}
                          {!isOpen && sectionShots.length === 0 && <p style={{ fontSize: 11, color: C.mutedLight, textAlign: 'center', padding: '4px 12px 12px', fontStyle: 'italic' }}>Drop shots here</p>}
                          {isOpen && (
                            <div style={{ padding: '0 12px 12px' }}>
                              {sectionShots.length === 0
                                ? <p style={{ fontSize: 11, color: C.mutedLight, textAlign: 'center', padding: '10px 0', fontStyle: 'italic' }}>Drop shots here</p>
                                : <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 8 }}>{displayShots.map(s => renderShotCard(s))}</div>
                                    {overflow > 0 && <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 }}>+{overflow} more in this category</p>}
                                  </>
                              }
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Always-visible unsorted — the table */}
              <div style={{ padding: '16px 80px' }}>
                {shotList.length === 0
                  ? <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>No frames yet</p>
                      <p style={{ fontSize: 12, color: C.muted }}>Click + on any captured frame to add it here.</p>
                    </div>
                  : <>
                      {sections.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                          <div style={{ flex: 1, height: 1, background: C.border }} />
                          <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>Unsorted · {unsortedShots.length}</span>
                          <div style={{ flex: 1, height: 1, background: C.border }} />
                        </div>
                      )}
                      {renderShotsGrid(unsortedShots)}
                    </>
                }
              </div>
            </div>
          ) : (
            /* SIDEBAR: simple vertical flow */
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <button onClick={addSection} style={{ fontSize: 12, fontWeight: 600, color: C.accent, background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add category</button>
                </div>
                {shotList.length === 0
                  ? <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>No frames yet</p>
                      <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>Click + on any captured frame to add it here.</p>
                    </div>
                  : <>
                      {sections.map((section, si) => {
                        const sectionShots = shotList.filter(sh => sh.sectionId === section.id);
                        const isDragOver = dragOverTarget === `section-${section.id}`;
                        const isOpen = expandedSectionIds.has(section.id);
                        const color = SECTION_COLORS[si % SECTION_COLORS.length];
                        return (
                          <div key={section.id}
                            onDragOver={e => { e.preventDefault(); setDragOverTarget(`section-${section.id}`); }}
                            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTarget(null); }}
                            onDrop={e => handleDropOnSection(e, section.id)}
                            style={{ border: `1.5px dashed ${isDragOver ? C.accent : color.border}`, borderRadius: 12, background: isDragOver ? C.accentLight : color.bg, transition: 'border-color 0.1s, background 0.1s', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', cursor: 'pointer' }} onClick={() => toggleSectionExpanded(section.id)}>
                              <span style={{ color: C.muted, fontSize: 12, flexShrink: 0, cursor: 'grab' }} draggable onDragStart={e => { e.stopPropagation(); handleDragStartSection(section.id); }} onClick={e => e.stopPropagation()}>⠿</span>
                              <button onClick={e => { e.stopPropagation(); deleteSection(section.id); }} title="Delete category"
                                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0, opacity: 0.6 }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                              </button>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {editingSectionId === section.id
                                  ? <input autoFocus value={section.name} onChange={e => updateSectionName(section.id, e.target.value)} onBlur={() => setEditingSectionId(null)} onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingSectionId(null); }} onClick={e => e.stopPropagation()} style={{ fontSize: 11, fontWeight: 700, color: C.text, border: 'none', outline: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.06em' }} />
                                  : <span onClick={e => { e.stopPropagation(); setEditingSectionId(section.id); }} style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'text' }}>
                                      {section.name} <span style={{ fontWeight: 400, color: C.muted }}>({sectionShots.length})</span>
                                    </span>
                                }
                              </div>
                              <span style={{ fontSize: 14, color: C.textSub, flexShrink: 0, fontWeight: 600 }}>{isOpen ? '▾' : '▸'}</span>
                            </div>
                            {!isOpen && sectionShots.length > 0 && renderFilmstrip(sectionShots)}
                            {!isOpen && sectionShots.length === 0 && <p style={{ fontSize: 11, color: C.mutedLight, textAlign: 'center', padding: '6px 12px 12px', fontStyle: 'italic' }}>Drop shots here</p>}
                            {isOpen && (
                              <div style={{ padding: '0 12px 12px' }}>
                                {renderShotsGrid(sectionShots)}
                                {sectionShots.length === 0 && <p style={{ fontSize: 11, color: C.mutedLight, textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>Drop shots here</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div onDragOver={e => { e.preventDefault(); setDragOverTarget('unsorted'); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTarget(null); }} onDrop={handleDropOnUnsorted}
                        style={sections.length > 0 ? { border: `1.5px dashed ${dragOverTarget === 'unsorted' ? C.accent : C.border}`, borderRadius: 12, background: dragOverTarget === 'unsorted' ? C.accentLight : 'transparent', transition: 'border-color 0.1s, background 0.1s', padding: 12 } : {}}>
                        {sections.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ flex: 1, height: 1, background: C.border }} />
                            <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Unsorted</span>
                            <div style={{ flex: 1, height: 1, background: C.border }} />
                          </div>
                        )}
                        {renderShotsGrid(unsortedShots)}
                      </div>
                    </>
                }
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: 16, borderTop: `1px solid ${C.border}`, flexShrink: 0, background: '#fff' }}>
            <button onClick={downloadPDF} disabled={pdfDownloading || shotList.length === 0}
              style={{ width: '100%', background: pdfDownloading || shotList.length === 0 ? C.mutedLight : C.text, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: pdfDownloading || shotList.length === 0 ? 'not-allowed' : 'pointer', transition: 'background 0.12s' }}>
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
      {ShotListSidebar()}
      {EditorBriefSidebar()}

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
                    <div className="card-overlay" style={{ position: 'absolute', top: 5, right: 5, opacity: 0, transition: 'opacity 0.15s', pointerEvents: 'none' }}>
                      <button onClick={e => { e.stopPropagation(); deleteEntry(entry.id); }}
                        style={{ pointerEvents: 'auto', width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, lineHeight: 1, cursor: 'pointer', backdropFilter: 'blur(2px)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.8)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}>
                        ×
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
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', animation: i > 1 ? 'fadeUp 0.2s ease' : undefined }}>
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
                      placeholder={i === 0 ? 'Paste a .mp4 URL from swipekit.app or foreplay.co…' : i === 1 ? 'Add another ad to compare… (optional)' : `Video URL ${i + 1}…`}
                      style={{ flex: 1, fontSize: 13, color: C.text, background: 'transparent', border: 'none', outline: 'none', fontFamily: C.mono }} />
                  </div>
                  {i >= 2 && (
                    <button onClick={() => setUrls(urls.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
                  )}
                </div>
              ))}

              {urls.length < 6 && (
                <button onClick={() => setUrls([...urls, ''])}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', background: 'transparent', border: `1.5px dashed ${C.border}`, borderRadius: 10, padding: 9, color: C.muted, fontSize: 13, cursor: 'pointer', transition: 'border-color 0.12s, color 0.12s, background 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; e.currentTarget.style.background = C.accentLight; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>
                  <span>Add another ad</span>
                </button>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 0', opacity: 0.7 }}>
                <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, fontWeight: 500 }}>Context</span>
                <input value={context} onChange={e => setContext(e.target.value)}
                  placeholder="Brand context, target audience… (optional)"
                  style={{ flex: 1, fontSize: 12, color: C.textSub, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 2 }}>
                {isGroup && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.accent, background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 20, padding: '2px 8px' }}>
                    Group mode · {urls.filter(u => u.trim()).length} URLs
                  </span>
                )}
                <button onClick={handleAnalyze} disabled={!urls.some(u => u.trim()) || extractingFb}
                  style={{ width: '100%', background: urls.some(u => u.trim()) ? C.accent : C.mutedLight, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: urls.some(u => u.trim()) && !extractingFb ? 'pointer' : 'not-allowed', transition: 'background 0.15s, transform 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onMouseEnter={e => { if (urls.some(u => u.trim()) && !extractingFb) e.currentTarget.style.transform = 'scale(1.01)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                  {extractingFb
                    ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Extracting from Facebook…</>
                    : isGroup ? `Analyze ${urls.filter(u => u.trim()).length} ads` : 'Analyze'}
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
                                                  onClick={e => {
                                                    e.stopPropagation();
                                                    if (alreadyAdded) return;
                                                    addToShotList({ thumbnail: frame, hqThumbnail: frame, annotation: row.visual, shootDirection: '', source: `${urlFilename} · ${row.timestamp}`, videoUrl });
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
                                          <div style={{ flexShrink: 0, alignSelf: 'center' }} onClick={e => {
                                            e.stopPropagation();
                                            const already = shotList.some(s => s.thumbnail === frame);
                                            if (already) return;
                                            addToShotList({ thumbnail: frame, hqThumbnail: frame, annotation: row.visual, shootDirection: '', source: `${urlFilename} · ${row.timestamp}`, videoUrl });
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

                    {groupResult && (() => {
                      const filledUrls = groupUrls.filter(u => u.trim());
                      // Normalize video_analyses (new) or fall back to key_frames (old)
                      const videoAnalyses = groupResult.video_analyses || filledUrls.map((_, idx) => {
                        const kfs = (groupResult.key_frames || []).filter(k => k.video_index === idx);
                        return { video_index: idx, frames: kfs.map(k => ({ ...k, is_starred: true, why_starred: null, copy: '' })) };
                      });

                      return (
                        <div style={{ display: 'flex', height: '100%', gap: 0 }}>

                          {/* ── LEFT: video thumbnails + stats */}
                          <div style={{ width: 200, minWidth: 200, flexShrink: 0, position: 'sticky', top: 0, alignSelf: 'flex-start', paddingRight: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {filledUrls.map((url, idx) => {
                              const thumb = groupFirstFrames[idx];
                              const isSelected = groupSelectedVideoIdx === idx;
                              return (
                                <div key={idx}
                                  style={{ borderRadius: 10, overflow: 'hidden', background: '#0d0f1a', border: `2px solid ${isSelected ? C.accent : C.border}`, cursor: 'pointer', transition: 'border-color 0.15s' }}
                                  onClick={() => setGroupSelectedVideoIdx(isSelected ? null : idx)}>
                                  {/* thumbnail / inline player */}
                                  <div style={{ position: 'relative', aspectRatio: '9/16' }}>
                                    {isSelected
                                      ? <video src={url} controls autoPlay onClick={e => e.stopPropagation()}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }} />
                                      : thumb
                                        ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, paddingLeft: 2 }}>▶</span>
                                            </div>
                                          </div>
                                    }
                                    <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.6)', borderRadius: 5, padding: '2px 6px', pointerEvents: 'none' }}>
                                      <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>Video {idx + 1}</span>
                                    </div>
                                  </div>
                                  {/* analyze individually */}
                                  <div style={{ padding: '8px 10px', background: '#fff', borderTop: `1px solid ${C.border}` }}>
                                    <button
                                      onClick={async e => {
                                        e.stopPropagation();
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
                                        } catch { setVideoError('Something went wrong.'); }
                                        finally { setAnalyzingVideo(false); }
                                      }}
                                      style={{ width: '100%', fontSize: 11, fontWeight: 600, color: C.accent, background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 6, padding: '5px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
                                      Analyze →
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Avg stats */}
                            {(groupResult.avg_duration || groupResult.avg_cuts) && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {groupResult.avg_duration && (
                                  <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                                    <p style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Avg. time</p>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{groupResult.avg_duration}</p>
                                  </div>
                                )}
                                {groupResult.avg_cuts != null && (
                                  <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                                    <p style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Avg. cuts</p>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{groupResult.avg_cuts}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* ── RIGHT: scrollable analysis */}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>

                            {/* Keywords + Format */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              {groupResult.keyword_clusters?.length > 0 && (
                                <div>
                                  <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Keyword</p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {groupResult.keyword_clusters.map((k, i) => (
                                      <p key={i} style={{ fontSize: k.frequency === 'high' ? 20 : k.frequency === 'medium' ? 16 : 13, fontWeight: k.frequency === 'high' ? 600 : 500, color: C.text, lineHeight: 1.4 }}>{k.word}</p>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {groupResult.format?.length > 0 && (
                                <div>
                                  <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Format</p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {groupResult.format.map((f, i) => (
                                      <p key={i} style={{ fontSize: 16, fontWeight: 500, color: C.text, lineHeight: 1.4 }}>{f}</p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Common hooks */}
                            {groupResult.common_hooks?.length > 0 && (
                              <div>
                                <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Common line</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {groupResult.common_hooks.map((h, i) => (
                                    <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px' }}>
                                      <p style={{ fontSize: 16, fontWeight: 500, color: C.text, lineHeight: 1.4, marginBottom: 8 }}>"{h.copy}"</p>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 10, background: C.border, color: C.textSub, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>Appears in {h.appears_in} ads</span>
                                        <p style={{ fontSize: 11, color: C.muted }}>{h.strategy}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Visual trend */}
                            {groupResult.visual_pattern && (
                              <div>
                                <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Visual trend</p>
                                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                                  {[{ label: 'Setting', value: groupResult.visual_pattern.setting }, { label: 'Text treatment', value: groupResult.visual_pattern.text_treatment }, { label: 'Color palette', value: groupResult.visual_pattern.color_palette }, { label: 'Editing pace', value: groupResult.visual_pattern.editing_pace }].filter(i => i.value).map((item, i, arr) => (
                                    <div key={item.label} style={{ display: 'flex', gap: 16, padding: '10px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                      <p style={{ fontSize: 11, color: C.muted, width: 100, flexShrink: 0, paddingTop: 1 }}>{item.label}</p>
                                      <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.5 }}>{item.value}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Per-video filmstrips */}
                            {videoAnalyses.map(va => {
                              const vidUrl = filledUrls[va.video_index];
                              if (!vidUrl) return null;
                              const hoveredIdx = groupHoveredFrame?.videoIdx === va.video_index ? groupHoveredFrame.frameIdx : null;
                              const hoveredFrameData = hoveredIdx !== null ? va.frames[hoveredIdx] : null;
                              return (
                                <div key={va.video_index}>
                                  <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                                    Frame by frame analysis · Video {va.video_index + 1}
                                  </p>

                                  {/* Filmstrip */}
                                  <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'thin' }}>
                                    {va.frames.map((frame, fi) => {
                                      const key = `${va.video_index}:${frame.timestamp}`;
                                      const thumb = groupKeyFrames[key];
                                      const isHov = hoveredIdx === fi;
                                      const tc = TYPE_COLORS_INLINE[frame.type] || { bg: '#f3f4f6', color: '#6b7280' };
                                      return (
                                        <div key={fi}
                                          onMouseEnter={() => setGroupHoveredFrame({ videoIdx: va.video_index, frameIdx: fi })}
                                          onMouseLeave={() => setGroupHoveredFrame(null)}
                                          style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0, cursor: 'default' }}>
                                          <div style={{
                                            width: 90, aspectRatio: '9/16', borderRadius: 8, overflow: 'hidden', background: '#1a1c2e', position: 'relative',
                                            outline: isHov ? `2px solid ${C.accent}` : frame.is_starred ? `2px solid #f59e0b` : '2px solid transparent',
                                            outlineOffset: 1, transition: 'outline-color 0.1s',
                                          }}>
                                            {thumb
                                              ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isHov ? 1 : 0.85, transition: 'opacity 0.1s' }} />
                                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                  <div style={{ width: 10, height: 10, border: `1.5px solid rgba(255,255,255,0.15)`, borderTop: `1.5px solid rgba(255,255,255,0.5)`, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                                </div>}
                                            {frame.is_starred && (
                                              <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 13 }}>⭐</div>
                                            )}
                                            {thumb && (
                                              <div style={{ position: 'absolute', bottom: 4, right: 4 }} onClick={e => {
                                                e.stopPropagation();
                                                if (!shotList.some(s => s.thumbnail === thumb)) addToShotList({ thumbnail: thumb, hqThumbnail: thumb, annotation: frame.visual, shootDirection: '', source: `Group V${va.video_index + 1} · ${frame.timestamp}`, videoUrl: vidUrl });
                                              }}>
                                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: shotList.some(s => s.thumbnail === thumb) ? 'rgba(37,99,235,0.9)' : 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: shotList.some(s => s.thumbnail === thumb) ? '#fff' : C.text, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                                                  {shotList.some(s => s.thumbnail === thumb) ? '✓' : '+'}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                          {/* type color bar */}
                                          <div style={{ height: 3, background: tc.color, borderRadius: '0 0 3px 3px', marginTop: 2, opacity: 0.6 }} />
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Hover detail */}
                                  <div style={{
                                    marginTop: 8, minHeight: 56, background: C.surface, borderRadius: 10, padding: '10px 14px',
                                    border: `1px solid ${hoveredFrameData ? (hoveredFrameData.is_starred ? '#fcd34d' : C.accentBorder) : C.border}`,
                                    transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column', gap: 5,
                                  }}>
                                    {hoveredFrameData ? (
                                      <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.accent }}>{hoveredFrameData.timestamp}</span>
                                          {(() => { const tc = TYPE_COLORS_INLINE[hoveredFrameData.type] || { bg: '#f3f4f6', color: '#6b7280' }; return <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: tc.bg, color: tc.color }}>{TYPE_LABELS[hoveredFrameData.type] || hoveredFrameData.type}</span>; })()}
                                          {hoveredFrameData.is_starred && <span style={{ fontSize: 10 }}>⭐ {hoveredFrameData.why_starred}</span>}
                                        </div>
                                        <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.5 }}>{hoveredFrameData.visual}</p>
                                        {hoveredFrameData.copy && <p style={{ fontSize: 12, color: C.text, fontWeight: 500, lineHeight: 1.5 }}>"{hoveredFrameData.copy}"</p>}
                                      </>
                                    ) : (
                                      <p style={{ fontSize: 11, color: C.mutedLight }}>Hover a frame to see transcript and scene detail.</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Ad structure */}
                            {groupResult.ad_structure_template?.length > 0 && (
                              <div>
                                <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Ad structure</p>
                                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                                  {groupResult.ad_structure_template.map((s, i) => {
                                    const sc = SECTION_COLORS[s.section] || { bg: '#6b7280', light: 'bg-gray-50' };
                                    return (
                                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px', borderBottom: i < groupResult.ad_structure_template.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sc.bg + '18', color: sc.bg, flexShrink: 0, marginTop: 1 }}>{s.section}</span>
                                        <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.5 }}>{s.description}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Talent pattern */}
                            {groupResult.talent_pattern && (
                              <div>
                                <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Talent pattern</p>
                                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                                  {[{ label: 'Appearance', value: groupResult.talent_pattern.appearance }, { label: 'Clothing', value: groupResult.talent_pattern.clothing }, { label: 'Setting', value: groupResult.talent_pattern.setting }, { label: 'Energy', value: groupResult.talent_pattern.energy }].filter(i => i.value).map((item, i, arr) => (
                                    <div key={item.label} style={{ display: 'flex', gap: 16, padding: '10px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                      <p style={{ fontSize: 11, color: C.muted, width: 80, flexShrink: 0, paddingTop: 1 }}>{item.label}</p>
                                      <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.5 }}>{item.value}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Strongest patterns */}
                            {groupResult.strongest_patterns?.length > 0 && (
                              <div>
                                <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Strongest patterns</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {groupResult.strongest_patterns.map((p, i) => (
                                    <div key={i} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 14 }}>
                                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.text, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{i + 1}</div>
                                      <div>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{p.title}</p>
                                        <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>{p.observation}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Editor brief CTA */}
                            {groupResult.broll_logic && (
                              <button onClick={() => setEditorBriefOpen(true)}
                                style={{ width: '100%', background: C.surface, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: '11px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s' }}
                                onMouseEnter={e => e.currentTarget.style.background = C.accentLight}
                                onMouseLeave={e => e.currentTarget.style.background = C.surface}>
                                Apply this editing logic to a script →
                              </button>
                            )}

                          </div>{/* /right */}
                        </div>
                      );
                    })()}
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
