'use client';
import { useState, useRef, useEffect } from 'react';

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
    video.currentTime = timestampToSeconds(timestamp);
    video.addEventListener('seeked', function onSeeked() {
      video.removeEventListener('seeked', onSeeked);
      function draw() {
        try { ctx.drawImage(video, 0, 0, w, h); resolve(canvas.toDataURL('image/jpeg', 0.75)); }
        catch { resolve(null); }
      }
      if (video.readyState >= 2) draw();
      else video.addEventListener('canplay', draw, { once: true });
    }, { once: true });
  });
}

export default function Home() {
  // ── nav
  const [mode, setMode] = useState('library');

  // ── shot list (global cart)
  const [shotList, setShotList] = useState([]);
  const [shotListOpen, setShotListOpen] = useState(false);

  // ── library
  const [library, setLibrary] = useState([]);
  const [newAdBrand, setNewAdBrand] = useState('');
  const [newAdType, setNewAdType] = useState('own');
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  // ── analyze (single)
  const [activeTab, setActiveTab] = useState('analysis');
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
  const [groupKeyFrames, setGroupKeyFrames] = useState({}); // key: `${videoIndex}:${timestamp}` → dataURL
  const groupVideoRefs = useRef([]);

  // ── boot
  useEffect(() => { setLibrary(getLibrary()); }, []);

  // ── frame capture effects (single)
  useEffect(() => {
    if (activeTab === 'framebyfrime' && videoAnalysis?.timeline?.length && Object.keys(capturedFrames).length === 0 && !capturingFrames) captureFrames();
  }, [activeTab, videoAnalysis]);

  useEffect(() => {
    if (videoAnalysis?.general?.opener?.timestamp) captureOpenerFrame(videoAnalysis.general.opener.timestamp);
  }, [videoAnalysis]);

  // ── capture group key frames when result arrives
  useEffect(() => {
    if (!groupResult?.key_frames?.length) return;
    const filledUrls = groupUrls.filter(u => u.trim());
    captureGroupKeyFrames(groupResult.key_frames, filledUrls);
  }, [groupResult]);

  // ── analyze single
  async function analyzeVideo() {
    if (!videoUrl) return setVideoError('Please paste a video URL first.');
    setVideoError(''); setCapturedFrames({}); setOpenerFrame({}); setShowSavePrompt(false);
    setAnalyzingVideo(true); setVideoAnalysis(null); setActiveTab('analysis');
    try {
      const res = await fetch('/api/analyze-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl, adContext: videoContext }) });
      const data = await res.json();
      if (data.error) return setVideoError(data.error);
      setVideoAnalysis(data.analysis);
      setShowSavePrompt(true);
    } catch { setVideoError('Something went wrong. Please try again.'); }
    finally { setAnalyzingVideo(false); }
  }

  // ── group analysis
  async function runGroupAnalysis() {
    const filled = groupUrls.filter(u => u.trim());
    if (filled.length < 2) return setGroupError('Add at least 2 video URLs.');
    setGroupError(''); setGroupRunning(true); setGroupResult(null); setGroupKeyFrames({});
    try {
      const res = await fetch('/api/group-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrls: filled, context: groupContext }) });
      const data = await res.json();
      if (data.error) return setGroupError(data.error);
      setGroupResult(data.result);
    } catch { setGroupError('Something went wrong. Please try again.'); }
    finally { setGroupRunning(false); }
  }

  // ── capture group key frames
  async function captureGroupKeyFrames(keyFrames, urls) {
    const frames = {};
    for (const kf of keyFrames) {
      const url = urls[kf.video_index];
      if (!url) continue;
      const video = groupVideoRefs.current[kf.video_index];
      if (!video) continue;
      const nw = video.videoWidth || 9;
      const nh = video.videoHeight || 16;
      const w = 160; const h = Math.round(w * nh / nw);
      const dataUrl = await captureFrameFromVideo(video, kf.timestamp, w, h);
      frames[`${kf.video_index}:${kf.timestamp}`] = dataUrl;
      setGroupKeyFrames({ ...frames });
    }
  }

  // ── single frame capture helpers
  async function captureOpenerFrame(timestamp) {
    const video = captureVideoRef.current;
    if (!video) return;
    const nw = videoNaturalSize?.w || 9; const nh = videoNaturalSize?.h || 16;
    const dataUrl = await captureFrameFromVideo(video, timestamp, 540, Math.round(540 * nh / nw));
    setOpenerFrame(dataUrl || null);
  }

  async function captureFrames() {
    if (!captureVideoRef.current || !videoAnalysis?.timeline?.length) return;
    setCapturingFrames(true); setCapturedFrames({});
    const video = captureVideoRef.current;
    const nw = videoNaturalSize?.w || 9; const nh = videoNaturalSize?.h || 16;
    const w = 160; const h = Math.round(w * nh / nw);
    const frames = {};
    for (const row of videoAnalysis.timeline) {
      frames[row.timestamp] = await captureFrameFromVideo(video, row.timestamp, w, h);
      setCapturedFrames({ ...frames });
    }
    setCapturingFrames(false);
  }

  // ── shot list helpers
  function addToShotList({ thumbnail, annotation, shootDirection, source }) {
    if (!thumbnail) return;
    setShotList(prev => [...prev, { id: Date.now().toString() + Math.random(), thumbnail, annotation: annotation || '', shootDirection: shootDirection || '', source: source || '' }]);
    setShotListOpen(true);
  }
  function removeFromShotList(id) { setShotList(prev => prev.filter(i => i.id !== id)); }
  function updateShotListItem(id, field, value) {
    setShotList(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }
  function copyBrief() {
    const text = ['SHOT LIST', '', ...shotList.map((item, i) => [
      `${i + 1}. [${item.source}]`,
      `   ${item.annotation}`,
      item.shootDirection ? `   ↳ Shoot: ${item.shootDirection}` : '',
    ].filter(Boolean).join('\n'))].join('\n');
    navigator.clipboard.writeText(text);
  }

  // ── library helpers
  async function saveAnalysis() {
    const entry = { id: Date.now().toString(), type: 'single', brand: newAdBrand.trim() || 'Untagged', adType: newAdType, dateAdded: new Date().toISOString(), thumbnail: null, url: videoUrl, analysis: videoAnalysis };
    const video = captureVideoRef.current;
    if (video) {
      try {
        const nw = videoNaturalSize?.w || 9; const nh = videoNaturalSize?.h || 16;
        entry.thumbnail = await captureFrameFromVideo(video, '00:00:00', 300, Math.round(300 * nh / nw));
      } catch {}
    }
    const updated = [entry, ...getLibrary()];
    persistLibrary(updated); setLibrary(updated);
    setShowSavePrompt(false); setNewAdBrand(''); setNewAdType('own');
  }
  function openFromLibrary(entry) {
    setVideoUrl(entry.url); setVideoAnalysis(entry.analysis);
    setShowSavePrompt(false); setCapturedFrames({}); setOpenerFrame(null);
    setActiveTab('analysis'); setMode('analyze');
  }
  function deleteEntry(id) { const u = getLibrary().filter(e => e.id !== id); persistLibrary(u); setLibrary(u); }
  function jumpToTimestamp(ts) { if (videoRef.current) { videoRef.current.currentTime = timestampToSeconds(ts); videoRef.current.play(); } }

  const existingBrands = [...new Set(library.map(e => e.brand).filter(Boolean))];
  const brandGroups = existingBrands.reduce((acc, b) => { acc[b] = library.filter(e => e.brand === b); return acc; }, {});
  const untagged = library.filter(e => !existingBrands.includes(e.brand) || e.brand === 'Untagged');
  if (untagged.length) brandGroups['Untagged'] = untagged;

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

  function AddToShotListBtn({ thumbnail, annotation, shootDirection, source }) {
    const already = shotList.some(i => i.thumbnail === thumbnail);
    return (
      <button
        onClick={e => { e.stopPropagation(); already ? null : addToShotList({ thumbnail, annotation, shootDirection, source }); }}
        title={already ? 'Already in shot list' : 'Add to shot list'}
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${already ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-900 hover:text-white'}`}>
        {already ? '✓' : '+'}
      </button>
    );
  }

  function LibraryCard({ entry }) {
    return (
      <div className="relative group rounded-xl overflow-hidden bg-white border border-gray-200 cursor-pointer">
        <div className="bg-gray-100 overflow-hidden" style={{ aspectRatio: '9/16' }}>
          {entry.thumbnail ? <img src={entry.thumbnail} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-xs text-gray-300">no preview</span></div>}
        </div>
        <div className="p-3">
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${entry.adType === 'own' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>{entry.adType === 'own' ? 'Own' : 'Competitor'}</span>
          <p className="text-xs text-gray-400 mt-1">{formatDate(entry.dateAdded)}</p>
        </div>
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
          <button onClick={() => openFromLibrary(entry)} className="w-full bg-white text-gray-900 text-sm font-medium py-2 rounded-lg hover:bg-gray-100 transition-colors">Open</button>
          <button onClick={e => { e.stopPropagation(); deleteEntry(entry.id); }} className="w-full bg-white/10 text-white text-sm py-2 rounded-lg hover:bg-white/20 transition-colors">Delete</button>
        </div>
      </div>
    );
  }

  // ── Shot list sidebar
  function ShotListSidebar() {
    return (
      <>
        {/* overlay */}
        {shotListOpen && <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShotListOpen(false)} />}
        {/* sidebar */}
        <div className={`fixed top-0 right-0 h-full bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${shotListOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: 380 }}>
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-sm font-semibold text-gray-900">Shot List</p>
              <p className="text-xs text-gray-400">{shotList.length} {shotList.length === 1 ? 'frame' : 'frames'} selected</p>
            </div>
            <div className="flex items-center gap-2">
              {shotList.length > 0 && (
                <button onClick={() => setShotList([])} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Clear all</button>
              )}
              <button onClick={() => setShotListOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-2">×</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {shotList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <p className="text-sm font-medium text-gray-900 mb-1">No frames yet</p>
                <p className="text-xs text-gray-400 leading-relaxed">Click the <span className="inline-flex w-4 h-4 rounded-full bg-gray-100 items-center justify-center text-xs font-bold">+</span> button on any captured frame to add it here.</p>
              </div>
            ) : (
              shotList.map((item, i) => (
                <div key={item.id} className="flex gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-medium">{i + 1}</span>
                    <div className="rounded-lg overflow-hidden bg-gray-200" style={{ width: 48, aspectRatio: '9/16' }}>
                      {item.thumbnail && <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-xs text-gray-400">{item.source}</p>
                    <textarea
                      value={item.annotation}
                      onChange={e => updateShotListItem(item.id, 'annotation', e.target.value)}
                      placeholder="Description..."
                      className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:border-gray-400"
                      rows={2} />
                    <textarea
                      value={item.shootDirection}
                      onChange={e => updateShotListItem(item.id, 'shootDirection', e.target.value)}
                      placeholder="How to shoot this scene..."
                      className="w-full text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-2 resize-none focus:outline-none focus:border-blue-300"
                      rows={2} />
                  </div>
                  <button onClick={() => removeFromShotList(item.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0 mt-0.5">×</button>
                </div>
              ))
            )}
          </div>

          {shotList.length > 0 && (
            <div className="p-4 border-t border-gray-200 flex-shrink-0">
              <button onClick={copyBrief} className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
                Copy brief
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  // ── render
  return (
    <main className="min-h-screen bg-gray-50">
      <ShotListSidebar />

      {/* Nav */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-8">
          <h1 className="text-sm font-semibold text-gray-900 tracking-tight">Ad Intelligence</h1>
          <nav className="flex gap-1">
            {[{ id: 'library', label: 'Library' }, { id: 'analyze', label: 'Analyze' }, { id: 'group', label: 'Group Analysis' }].map(tab => (
              <button key={tab.id} onClick={() => setMode(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === tab.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {mode === 'library' && (
            <button onClick={() => setMode('analyze')} className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">+ Add ad</button>
          )}
          <button onClick={() => setShotListOpen(true)}
            className="relative flex items-center gap-2 text-sm border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Shot List
            {shotList.length > 0 && (
              <span className="bg-gray-900 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">{shotList.length}</span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── LIBRARY ───────────────────────────────────────────── */}
        {mode === 'library' && (
          <div>
            {library.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <p className="text-sm font-medium text-gray-900 mb-2">Your library is empty</p>
                <p className="text-xs text-gray-400 mb-6">Analyze a video ad and save it to build your library.</p>
                <button onClick={() => setMode('analyze')} className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">Analyze your first ad</button>
              </div>
            ) : (
              Object.entries(brandGroups).map(([brand, entries]) => !entries.length ? null : (
                <div key={brand} className="mb-12">
                  <div className="flex items-center gap-3 mb-5">
                    <p className="text-xs font-semibold text-gray-900 uppercase tracking-widest">{brand}</p>
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">{entries.length} {entries.length === 1 ? 'ad' : 'ads'}</span>
                  </div>
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                    {entries.map(entry => <LibraryCard key={entry.id} entry={entry} />)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── ANALYZE ───────────────────────────────────────────── */}
        {mode === 'analyze' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Single video analysis</p>
              <p className="text-sm text-gray-600 mb-4">Find a video ad on{' '}<a href="https://www.swipekit.app" target="_blank" className="text-blue-500 hover:underline">swipekit.app</a>{' '}or{' '}<a href="https://www.foreplay.co" target="_blank" className="text-blue-500 hover:underline">foreplay.co</a>, copy the direct .mp4 URL and paste it below.</p>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Video URL (.mp4)</label>
                <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://file.swipekit.app/fb-xxx.mp4" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:border-gray-400" />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Brand context (optional)</label>
                <input type="text" value={videoContext} onChange={e => setVideoContext(e.target.value)} placeholder="e.g. Hims hair loss ad targeting men 30-45" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400" />
              </div>
              <button onClick={analyzeVideo} disabled={analyzingVideo} className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {analyzingVideo ? 'Analyzing video… this takes 1-2 minutes' : 'Analyze video'}
              </button>
              {videoError && <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2.5">{videoError}</div>}
            </div>

            {showSavePrompt && videoAnalysis && (
              <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                <p className="text-sm font-medium text-white whitespace-nowrap">Save to library</p>
                <input value={newAdBrand} onChange={e => setNewAdBrand(e.target.value)} list="brand-suggestions" placeholder="Brand name…" className="border border-white/20 bg-white/10 text-white placeholder-white/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-white/50 w-44" />
                <datalist id="brand-suggestions">{existingBrands.map(b => <option key={b} value={b} />)}</datalist>
                <div className="flex gap-1 bg-white/10 rounded-lg p-1">
                  {['own', 'competitor'].map(t => (
                    <button key={t} onClick={() => setNewAdType(t)} className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${newAdType === t ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white'}`}>{t}</button>
                  ))}
                </div>
                <button onClick={saveAnalysis} className="bg-white text-gray-900 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors ml-auto">Save</button>
                <button onClick={() => setShowSavePrompt(false)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
              </div>
            )}

            {videoAnalysis && (
              <>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                  <button onClick={() => setActiveTab('analysis')} className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${activeTab === 'analysis' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Analysis</button>
                  <button onClick={() => setActiveTab('framebyfrime')} className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${activeTab === 'framebyfrime' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Frame by frame</button>
                </div>

                <div className="grid gap-6 items-start" style={{ gridTemplateColumns: '3fr 2fr' }}>
                  <div className="flex flex-col gap-4">
                    {activeTab === 'analysis' && (
                      <>
                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Hook & opener</p>
                          <div className="flex gap-4 mb-4">
                            {openerFrame && (
                              <div className="flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 cursor-pointer" style={{ width: 72, height: 128 }} onClick={() => jumpToTimestamp(videoAnalysis.general?.opener?.timestamp || '00:00:00')}>
                                <img src={openerFrame} alt="Opener frame" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <p className="text-2xl font-medium text-gray-900 leading-snug">"{videoAnalysis.general?.hook?.copy}"</p>
                          </div>
                          <div className="border-t border-gray-100 pt-4">
                            <p className="text-xs text-gray-400 mb-1">Visual opener</p>
                            <p className="text-sm text-gray-700 leading-relaxed mb-3">{videoAnalysis.general?.hook?.visual}</p>
                            <button onClick={() => jumpToTimestamp(videoAnalysis.general?.opener?.timestamp || '00:00:00')} className="text-xs text-blue-500 hover:text-blue-700 font-mono hover:underline">▶ {videoAnalysis.general?.opener?.timestamp || '00:00:00'} — Jump to opener</button>
                          </div>
                        </div>

                        <AdStructureBar data={videoAnalysis.general?.ad_structure} duration={videoAnalysis.general?.duration} brandReveal={videoAnalysis.general?.brand_reveal?.timestamp} productReveal={videoAnalysis.general?.product_reveal?.timestamp} />

                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Total time', value: videoAnalysis.general?.duration ?? '—' },
                            { label: 'Total cuts', value: videoAnalysis.timeline?.length ?? '—' },
                            { label: 'Brand reveal', value: videoAnalysis.general?.brand_reveal?.timestamp ?? '—', ts: videoAnalysis.general?.brand_reveal?.timestamp },
                            { label: 'Product reveal', value: videoAnalysis.general?.product_reveal?.timestamp ?? '—', ts: videoAnalysis.general?.product_reveal?.timestamp },
                          ].map(stat => (
                            <div key={stat.label} onClick={() => stat.ts && jumpToTimestamp(stat.ts)} className={`bg-white border border-gray-200 rounded-xl p-4 text-center ${stat.ts ? 'cursor-pointer hover:border-blue-300 transition-colors' : ''}`}>
                              <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                              <p className={`text-lg font-medium ${stat.ts ? 'text-blue-600' : 'text-gray-900'}`}>{stat.value}</p>
                            </div>
                          ))}
                        </div>

                        {videoAnalysis.general?.value_propositions?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Value propositions</p>
                            <div className="flex flex-col gap-2">
                              {videoAnalysis.general.value_propositions.map((vp, i) => (
                                <div key={i} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                  <div className="flex flex-col gap-1">
                                    <p className="text-sm font-medium text-gray-800 leading-snug">{vp.summary ?? vp}</p>
                                    {vp.copy && <p className="text-xs text-gray-500 leading-relaxed italic">"{vp.copy}"</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {videoAnalysis.general?.talent && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Talent</p>
                            <div className="flex flex-col gap-2">
                              {[{ label: 'Appearance', value: videoAnalysis.general.talent.appearance }, { label: 'Clothing', value: videoAnalysis.general.talent.clothing }, { label: 'Setting', value: videoAnalysis.general.talent.setting }, { label: 'Energy', value: videoAnalysis.general.talent.energy }].map(item => item.value ? (
                                <div key={item.label} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                                  <p className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{item.label}</p>
                                  <p className="text-xs text-gray-700 leading-relaxed">{item.value}</p>
                                </div>
                              ) : null)}
                            </div>
                          </div>
                        )}

                        {videoAnalysis.general?.cta && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">CTA</p>
                            <div className="flex items-center gap-3">
                              <button onClick={() => jumpToTimestamp(videoAnalysis.general.cta.timestamp)} className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors flex-shrink-0">{videoAnalysis.general.cta.timestamp}</button>
                              <p className="text-sm font-medium text-gray-900">"{videoAnalysis.general.cta.text}"</p>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {activeTab === 'framebyfrime' && (
                      <>
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                          <div className="px-5 py-4 border-b border-gray-100">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Frame by frame</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {capturingFrames ? `Capturing ${Object.keys(capturedFrames).length} of ${videoAnalysis.timeline?.length}…` : Object.keys(capturedFrames).length > 0 ? `${Object.keys(capturedFrames).length} frames captured` : 'Click any frame to jump to that moment'}
                            </p>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {videoAnalysis.timeline?.map((row, i) => {
                              const frame = capturedFrames[row.timestamp];
                              const brand = newAdBrand || library.find(e => e.url === videoUrl)?.brand || 'Ad';
                              return (
                                <div key={i} className="flex gap-4 px-5 py-4 hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => jumpToTimestamp(row.timestamp)}>
                                  <div className="flex-shrink-0 rounded-lg overflow-hidden bg-gray-100" style={{ width: 60, aspectRatio: videoNaturalSize ? `${videoNaturalSize.w}/${videoNaturalSize.h}` : '9/16' }}>
                                    {frame ? <img src={frame} alt="" className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center">{capturingFrames ? <span className="text-xs text-gray-300">…</span> : <span className="text-xs font-mono text-blue-300">{row.timestamp}</span>}</div>}
                                  </div>
                                  <div className="flex-1 min-w-0 py-0.5">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-xs font-mono text-blue-500">{row.timestamp}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[row.type] || 'bg-gray-100 text-gray-600'}`}>{TYPE_LABELS[row.type] || row.type}</span>
                                    </div>
                                    <p className="text-xs text-gray-700 leading-relaxed mb-1">{row.visual}</p>
                                    {row.copy && <p className="text-xs text-gray-400 italic leading-relaxed">"{row.copy}"</p>}
                                  </div>
                                  {frame && (
                                    <div className="flex-shrink-0 self-center" onClick={e => e.stopPropagation()}>
                                      <AddToShotListBtn thumbnail={frame} annotation={row.visual} shootDirection="" source={`${brand} · ${row.timestamp}`} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {videoAnalysis.copy_only?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Copy only</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{videoAnalysis.copy_only.filter(c => c.text).map(c => c.text).join(' ')}</p>
                          </div>
                        )}

                        {videoAnalysis.transferrable_copy?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Transferrable format</p>
                              <button onClick={() => navigator.clipboard.writeText(videoAnalysis.transferrable_copy.map(i => i.template).join('\n'))} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50 transition-colors">Copy all</button>
                            </div>
                            <p className="text-sm text-gray-800 leading-relaxed">{videoAnalysis.transferrable_copy.map(i => i.template).join(' ')}</p>
                          </div>
                        )}

                        {videoAnalysis.broll_shots?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">B-rolls to shoot</p>
                            <div className="flex flex-col">
                              {videoAnalysis.broll_shots.map((shot, i) => {
                                const ts = shot.timestamp || null;
                                const desc = shot.description ?? shot;
                                const frame = ts ? capturedFrames[ts] : null;
                                const brand = newAdBrand || library.find(e => e.url === videoUrl)?.brand || 'Ad';
                                return (
                                  <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0 -mx-5 px-5 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex-shrink-0 rounded-md overflow-hidden bg-gray-100 cursor-pointer" style={{ width: 48, aspectRatio: videoNaturalSize ? `${videoNaturalSize.w}/${videoNaturalSize.h}` : '9/16' }} onClick={() => ts && jumpToTimestamp(ts)}>
                                      {frame ? <img src={frame} alt="" className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-gray-300 text-xs font-mono">{ts || '—'}</span></div>}
                                    </div>
                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => ts && jumpToTimestamp(ts)}>
                                      {ts && <span className="text-xs font-mono text-blue-500 block mb-0.5">{ts}</span>}
                                      <p className="text-sm text-gray-700 leading-relaxed">{desc}</p>
                                    </div>
                                    {frame && <AddToShotListBtn thumbnail={frame} annotation={desc} shootDirection={desc} source={`${brand} · ${ts}`} />}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div style={{ position: 'sticky', top: 80 }}>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <video ref={videoRef} src={videoUrl} controls className="w-full" style={{ maxHeight: 360 }} />
                      <video ref={captureVideoRef} src={`/api/proxy-video?url=${encodeURIComponent(videoUrl)}`} crossOrigin="anonymous" preload="auto" style={{ display: 'none' }}
                        onLoadedMetadata={e => setVideoNaturalSize({ w: e.target.videoWidth, h: e.target.videoHeight })} />
                      <div className="px-4 py-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400">Click any timestamp to jump to that moment</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── GROUP ANALYSIS ────────────────────────────────────── */}
        {mode === 'group' && (
          <div className="flex flex-col gap-4">
            {/* hidden capture videos for key frames */}
            <div style={{ display: 'none' }}>
              {groupUrls.filter(u => u.trim()).map((url, i) => (
                <video key={i} ref={el => groupVideoRefs.current[i] = el}
                  src={`/api/proxy-video?url=${encodeURIComponent(url)}`}
                  crossOrigin="anonymous" preload="auto" />
              ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Group analysis</p>
              <p className="text-sm text-gray-600 mb-4">Add 2–6 video URLs from the same brand or trend. AI will find what they have in common.</p>
              <div className="flex flex-col gap-2 mb-3">
                {groupUrls.map((url, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input type="text" value={url} onChange={e => { const u = [...groupUrls]; u[i] = e.target.value; setGroupUrls(u); }} placeholder="https://file.swipekit.app/fb-xxx.mp4" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:border-gray-400" />
                    {groupUrls.length > 2 && <button onClick={() => setGroupUrls(groupUrls.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>}
                  </div>
                ))}
              </div>
              {groupUrls.length < 6 && <button onClick={() => setGroupUrls([...groupUrls, ''])} className="text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-lg px-3 py-2 w-full bg-white hover:bg-gray-50 transition-colors mb-3">+ Add video</button>}
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Context (optional)</label>
                <input type="text" value={groupContext} onChange={e => setGroupContext(e.target.value)} placeholder="e.g. Hims hair loss ads — Q4 2024 batch" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400" />
              </div>
              <button onClick={runGroupAnalysis} disabled={groupRunning} className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {groupRunning ? 'Analyzing… this may take a few minutes' : 'Run group analysis'}
              </button>
              {groupError && <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2.5">{groupError}</div>}
            </div>

            {groupResult && (
              <div className="flex flex-col gap-4">

                {/* Key frames */}
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
                              {frame
                                ? <img src={frame} alt="" className="w-full h-full object-contain" />
                                : <div className="w-full h-full flex items-center justify-center"><span className="text-xs text-gray-300 font-mono">{kf.timestamp}</span></div>}
                              {frame && (
                                <div className="absolute top-1.5 right-1.5" onClick={e => e.stopPropagation()}>
                                  <AddToShotListBtn thumbnail={frame} annotation={kf.visual} shootDirection={kf.shoot_direction} source={`Group · Video ${kf.video_index + 1} · ${kf.timestamp}`} />
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

                {/* Common hooks */}
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

                {/* Keyword clusters */}
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

                {/* Visual pattern */}
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

                {/* Ad structure template */}
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

                {/* Talent pattern */}
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

                {/* Strongest patterns */}
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

              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
