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
  'Hook': { bg: '#3b82f6', light: 'bg-blue-50', text: 'text-blue-700' },
  'Opener': { bg: '#f97316', light: 'bg-orange-50', text: 'text-orange-700' },
  'Personal story': { bg: '#ec4899', light: 'bg-pink-50', text: 'text-pink-700' },
  'Pain point': { bg: '#ef4444', light: 'bg-red-50', text: 'text-red-700' },
  'Competitor mention': { bg: '#eab308', light: 'bg-yellow-50', text: 'text-yellow-700' },
  'Scientific facts': { bg: '#a855f7', light: 'bg-purple-50', text: 'text-purple-700' },
  'Product introduction': { bg: '#22c55e', light: 'bg-green-50', text: 'text-green-700' },
  'Social proof': { bg: '#14b8a6', light: 'bg-teal-50', text: 'text-teal-700' },
  'Price or offer': { bg: '#f59e0b', light: 'bg-amber-50', text: 'text-amber-700' },
  'CTA': { bg: '#6b7280', light: 'bg-gray-50', text: 'text-gray-700' },
};

function timestampToSeconds(ts) {
  if (!ts) return 0;
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

export default function Home() {
  const [mode, setMode] = useState('single');
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

  const [myVideos, setMyVideos] = useState(['']);
  const [competitorVideos, setCompetitorVideos] = useState(['']);
  const [compareContext, setCompareContext] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [comparingVideos, setComparingVideos] = useState(false);
  const [compareError, setCompareError] = useState('');

  async function analyzeVideo() {
    if (!videoUrl) return setVideoError('Please paste a video URL first.');
    setVideoError('');
    setCapturedFrames({});
    setOpenerFrame(null);
    setAnalyzingVideo(true);
    setVideoAnalysis(null);
    setActiveTab('analysis');
    try {
      const res = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, adContext: videoContext }),
      });
      const data = await res.json();
      if (data.error) return setVideoError(data.error);
      setVideoAnalysis(data.analysis);
    } catch (err) {
      setVideoError('Something went wrong. Please try again.');
    } finally {
      setAnalyzingVideo(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'framebyfrime' && videoAnalysis?.timeline?.length && Object.keys(capturedFrames).length === 0 && !capturingFrames) {
      captureFrames();
    }
  }, [activeTab, videoAnalysis]);

  useEffect(() => {
    if (videoAnalysis?.general?.opener?.timestamp) {
      captureOpenerFrame(videoAnalysis.general.opener.timestamp);
    }
  }, [videoAnalysis]);

  async function captureOpenerFrame(timestamp) {
    const video = captureVideoRef.current;
    if (!video) return;
    const seconds = timestampToSeconds(timestamp);
    const canvas = document.createElement('canvas');
    canvas.width = 540;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');
    await new Promise(resolve => {
      video.currentTime = seconds;
      video.addEventListener('seeked', function onSeeked() {
        video.removeEventListener('seeked', onSeeked);
        if (video.readyState >= 2) {
          resolve();
        } else {
          video.addEventListener('canplay', resolve, { once: true });
        }
      }, { once: true });
    });
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setOpenerFrame(canvas.toDataURL('image/jpeg', 0.85));
    } catch (e) {
      setOpenerFrame(null);
    }
  }

  async function captureFrames() {
    if (!captureVideoRef.current || !videoAnalysis?.timeline?.length) return;
    setCapturingFrames(true);
    setCapturedFrames({});

    const video = captureVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 380;
    const ctx = canvas.getContext('2d');
    const frames = {};

    for (const row of videoAnalysis.timeline) {
      const seconds = timestampToSeconds(row.timestamp);
      await new Promise(resolve => {
        function captureAndResolve() {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames[row.timestamp] = canvas.toDataURL('image/jpeg', 0.7);
          } catch (e) {
            frames[row.timestamp] = null;
          }
          setCapturedFrames({ ...frames });
          resolve();
        }
        video.currentTime = seconds;
        video.addEventListener('seeked', function onSeeked() {
          video.removeEventListener('seeked', onSeeked);
          if (video.readyState >= 2) {
            captureAndResolve();
          } else {
            video.addEventListener('canplay', captureAndResolve, { once: true });
          }
        }, { once: true });
      });
    }

    setCapturingFrames(false);
  }

  function jumpToTimestamp(ts) {
    if (videoRef.current) {
      videoRef.current.currentTime = timestampToSeconds(ts);
      videoRef.current.play();
    }
  }

  function addVideo(side) {
    if (side === 'my' && myVideos.length < 3) setMyVideos([...myVideos, '']);
    if (side === 'competitor' && competitorVideos.length < 3) setCompetitorVideos([...competitorVideos, '']);
  }

  function removeVideo(side, index) {
    if (side === 'my') setMyVideos(myVideos.filter((_, i) => i !== index));
    if (side === 'competitor') setCompetitorVideos(competitorVideos.filter((_, i) => i !== index));
  }

  function updateVideo(side, index, value) {
    if (side === 'my') {
      const updated = [...myVideos];
      updated[index] = value;
      setMyVideos(updated);
    }
    if (side === 'competitor') {
      const updated = [...competitorVideos];
      updated[index] = value;
      setCompetitorVideos(updated);
    }
  }

  async function compareVideos() {
    const myFilled = myVideos.filter(v => v.trim());
    const competitorFilled = competitorVideos.filter(v => v.trim());
    if (myFilled.length === 0) return setCompareError('Please add at least one video on your side.');
    if (competitorFilled.length === 0) return setCompareError('Please add at least one competitor video.');
    setCompareError('');
    setComparingVideos(true);
    setCompareResult(null);
    try {
      const res = await fetch('/api/compare-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myVideos: myFilled,
          competitorVideos: competitorFilled,
          context: compareContext,
        }),
      });
      const data = await res.json();
      if (data.error) return setCompareError(data.error);
      setCompareResult(data.result);
    } catch (err) {
      setCompareError('Something went wrong. Please try again.');
    } finally {
      setComparingVideos(false);
    }
  }

  function AdStructureBar({ data, duration, brandReveal, productReveal }) {
    if (!data?.length) return null;
    const totalSeconds = timestampToSeconds(duration) || 60;
    const brandPct = (timestampToSeconds(brandReveal) / totalSeconds) * 100;
    const productPct = (timestampToSeconds(productReveal) / totalSeconds) * 100;
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Ad structure</p>
        <div className="relative mb-1" style={{ height: '20px' }}>
          {brandReveal && (
            <div className="absolute flex flex-col items-center" style={{ left: `${brandPct}%`, transform: 'translateX(-50%)' }}>
              <span className="text-xs text-gray-400 font-mono whitespace-nowrap">brand</span>
            </div>
          )}
          {productReveal && Math.abs(productPct - brandPct) > 5 && (
            <div className="absolute flex flex-col items-center" style={{ left: `${productPct}%`, transform: 'translateX(-50%)' }}>
              <span className="text-xs text-gray-400 font-mono whitespace-nowrap">product</span>
            </div>
          )}
        </div>
        <div className="relative h-10 flex rounded-lg overflow-hidden mb-1 gap-px">
          {data.map((section, i) => {
            const start = timestampToSeconds(section.start);
            const end = timestampToSeconds(section.end);
            const width = ((end - start) / totalSeconds) * 100;
            const color = SECTION_COLORS[section.section]?.bg || '#6b7280';
            return (
              <button key={i} onClick={() => jumpToTimestamp(section.start)}
                style={{ width: `${Math.max(width, 1)}%`, backgroundColor: color }}
                className="hover:opacity-75 transition-opacity relative" title={`${section.section} (${section.start})`} />
            );
          })}
          {brandReveal && <div className="absolute top-0 bottom-0 w-px bg-white opacity-90 pointer-events-none" style={{ left: `${brandPct}%` }} />}
          {productReveal && <div className="absolute top-0 bottom-0 w-px bg-white opacity-90 pointer-events-none" style={{ left: `${productPct}%` }} />}
        </div>
        <div className="relative h-5 mb-4">
          {brandReveal && <div className="absolute" style={{ left: `${brandPct}%`, transform: 'translateX(-50%)' }}><span className="text-xs font-mono text-gray-400">{brandReveal}</span></div>}
          {productReveal && Math.abs(productPct - brandPct) > 5 && <div className="absolute" style={{ left: `${productPct}%`, transform: 'translateX(-50%)' }}><span className="text-xs font-mono text-gray-400">{productReveal}</span></div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {data.map((section, i) => {
            const colors = SECTION_COLORS[section.section] || { light: 'bg-gray-50', text: 'text-gray-700', bg: '#6b7280' };
            return (
              <button key={i} onClick={() => jumpToTimestamp(section.start)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.light} hover:opacity-80 transition-opacity`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors.bg }} />
                <span className={`text-xs font-medium ${colors.text}`}>{section.section}</span>
                <span className="text-xs text-gray-400 font-mono">{section.start}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function CompareAdStructureBars({ mine, competitor }) {
    if (!mine?.length && !competitor?.length) return null;
    const allSections = [...(mine || []), ...(competitor || [])];
    const maxPct = allSections.reduce((max, s) => Math.max(max, s.percentage || 0), 0);
    const total = (arr) => arr?.reduce((sum, s) => sum + (s.percentage || 0), 0) || 100;

    function renderBar(data, label, colorClass) {
      if (!data?.length) return null;
      const t = total(data);
      return (
        <div className="mb-3">
          <p className={`text-xs font-medium mb-1 ${colorClass}`}>{label}</p>
          <div className="flex h-8 rounded-lg overflow-hidden gap-px">
            {data.map((section, i) => {
              const color = SECTION_COLORS[section.section]?.bg || '#6b7280';
              const width = ((section.percentage || 0) / t) * 100;
              return (
                <div key={i} style={{ width: `${Math.max(width, 1)}%`, backgroundColor: color }}
                  className="relative" title={`${section.section} ${section.percentage}%`} />
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Ad structure comparison</p>
        {renderBar(mine, 'My ads', 'text-blue-600')}
        {renderBar(competitor, 'Competitor ads', 'text-purple-600')}
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(SECTION_COLORS).map(([name, colors]) => (
            <span key={name} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.bg }} />
              {name}
            </span>
          ))}
        </div>
      </div>
    );
  }

  function VideoInputList({ side, videos }) {
    const label = side === 'my' ? 'My ads' : 'Competitor ads';
    const accent = side === 'my' ? 'text-blue-600' : 'text-purple-600';
    const accentBg = side === 'my' ? 'bg-blue-50' : 'bg-purple-50';
    const accentBorder = side === 'my' ? 'border-blue-200' : 'border-purple-200';
    return (
      <div className={`border ${accentBorder} rounded-xl p-4 ${accentBg}`}>
        <p className={`text-xs font-medium uppercase tracking-wider mb-3 ${accent}`}>{label}</p>
        <div className="flex flex-col gap-2 mb-3">
          {videos.map((url, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="text" value={url} onChange={e => updateVideo(side, i, e.target.value)}
                placeholder="https://file.swipekit.app/fb-xxx.mp4"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:border-gray-400" />
              {videos.length > 1 && (
                <button onClick={() => removeVideo(side, i)} className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0">×</button>
              )}
            </div>
          ))}
        </div>
        {videos.length < 3 && (
          <button onClick={() => addVideo(side)} className="text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-lg px-3 py-2 w-full bg-white hover:bg-gray-50 transition-colors">
            + Add video
          </button>
        )}
      </div>
    );
  }

  function SectionDivider({ label }) {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="w-1 h-5 bg-gray-900 rounded-full flex-shrink-0" />
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-6xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-medium text-gray-900">Ad Library Intelligence</h1>
          <p className="text-sm text-gray-500 mt-1">Analyze competitor video ads with AI</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button onClick={() => setMode('single')}
            className={`p-4 rounded-xl border text-left transition-colors ${mode === 'single' ? 'border-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <p className={`text-sm font-medium mb-1 ${mode === 'single' ? 'text-gray-900' : 'text-gray-500'}`}>Single video</p>
            <p className="text-xs text-gray-400">Analyze one video ad in depth</p>
          </button>
          <button onClick={() => setMode('compare')}
            className={`p-4 rounded-xl border text-left transition-colors ${mode === 'compare' ? 'border-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <p className={`text-sm font-medium mb-1 ${mode === 'compare' ? 'text-gray-900' : 'text-gray-500'}`}>Group comparison</p>
            <p className="text-xs text-gray-400">Compare your ads vs competitor ads</p>
          </button>
        </div>

        {/* Single video mode */}
        {mode === 'single' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Video analysis</p>
              <p className="text-sm text-gray-600 mb-4">
                Find a video ad on{' '}
                <a href="https://www.swipekit.app" target="_blank" className="text-blue-500 hover:underline">swipekit.app</a>
                {' '}or{' '}
                <a href="https://www.foreplay.co" target="_blank" className="text-blue-500 hover:underline">foreplay.co</a>
                , copy the direct .mp4 URL and paste it below.
              </p>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Video URL (.mp4)</label>
                <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://file.swipekit.app/fb-xxx.mp4"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:border-gray-400" />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Brand context (optional)</label>
                <input type="text" value={videoContext} onChange={e => setVideoContext(e.target.value)}
                  placeholder="e.g. Hims hair loss ad targeting men 30-45"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400" />
              </div>
              <button onClick={analyzeVideo} disabled={analyzingVideo}
                className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {analyzingVideo ? 'Analyzing video... this takes 1-2 minutes' : 'Analyze video'}
              </button>
              {videoError && <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2.5">{videoError}</div>}
            </div>

            {videoAnalysis && (
              <>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                  <button onClick={() => setActiveTab('analysis')}
                    className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${activeTab === 'analysis' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    Analysis
                  </button>
                  <button onClick={() => setActiveTab('framebyfrime')}
                    className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${activeTab === 'framebyfrime' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    Frame by frame
                  </button>
                </div>

                <div className="grid gap-6 items-start" style={{ gridTemplateColumns: '3fr 2fr' }}>
                  <div className="flex flex-col gap-4">

                    {activeTab === 'analysis' && (
                      <>
                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Hook & opener</p>
                          <div className="flex gap-4 mb-4">
                            {openerFrame && (
                              <div className="flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                                style={{ width: '72px', height: '128px' }}
                                onClick={() => jumpToTimestamp(videoAnalysis.general?.opener?.timestamp || '00:00:00')}>
                                <img src={openerFrame} alt="Opener frame" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <p className="text-2xl font-medium text-gray-900 leading-snug">
                              "{videoAnalysis.general?.hook?.copy}"
                            </p>
                          </div>
                          <div className="border-t border-gray-100 pt-4">
                            <p className="text-xs text-gray-400 mb-1">Visual opener</p>
                            <p className="text-sm text-gray-700 leading-relaxed mb-3">{videoAnalysis.general?.hook?.visual}</p>
                            <button onClick={() => jumpToTimestamp(videoAnalysis.general?.opener?.timestamp || '00:00:00')}
                              className="text-xs text-blue-500 hover:text-blue-700 font-mono hover:underline">
                              ▶ {videoAnalysis.general?.opener?.timestamp || '00:00:00'} — Jump to opener
                            </button>
                          </div>
                        </div>

                        <AdStructureBar
                          data={videoAnalysis.general?.ad_structure}
                          duration={videoAnalysis.general?.duration}
                          brandReveal={videoAnalysis.general?.brand_reveal?.timestamp}
                          productReveal={videoAnalysis.general?.product_reveal?.timestamp}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Total time', value: videoAnalysis.general?.duration ?? '—' },
                            { label: 'Total cuts', value: videoAnalysis.timeline?.length ?? '—' },
                            { label: 'Brand reveal', value: videoAnalysis.general?.brand_reveal?.timestamp ?? '—', ts: videoAnalysis.general?.brand_reveal?.timestamp },
                            { label: 'Product reveal', value: videoAnalysis.general?.product_reveal?.timestamp ?? '—', ts: videoAnalysis.general?.product_reveal?.timestamp },
                          ].map(stat => (
                            <div key={stat.label} onClick={() => stat.ts && jumpToTimestamp(stat.ts)}
                              className={`bg-white border border-gray-200 rounded-xl p-4 text-center ${stat.ts ? 'cursor-pointer hover:border-blue-300 transition-colors' : ''}`}>
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
                              {[
                                { label: 'Appearance', value: videoAnalysis.general.talent.appearance },
                                { label: 'Clothing', value: videoAnalysis.general.talent.clothing },
                                { label: 'Setting', value: videoAnalysis.general.talent.setting },
                                { label: 'Energy', value: videoAnalysis.general.talent.energy },
                              ].map(item => item.value ? (
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
                              <button onClick={() => jumpToTimestamp(videoAnalysis.general.cta.timestamp)}
                                className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors flex-shrink-0">
                                {videoAnalysis.general.cta.timestamp}
                              </button>
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
                              {capturingFrames
                                ? `Capturing ${Object.keys(capturedFrames).length} of ${videoAnalysis.timeline?.length}…`
                                : Object.keys(capturedFrames).length > 0
                                  ? `${Object.keys(capturedFrames).length} frames captured`
                                  : 'Click any frame to jump to that moment'}
                            </p>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {videoAnalysis.timeline?.map((row, i) => (
                              <div key={i}
                                className="flex gap-4 px-5 py-4 hover:bg-blue-50/30 cursor-pointer transition-colors"
                                onClick={() => jumpToTimestamp(row.timestamp)}>
                                <div className="flex-shrink-0 rounded-lg overflow-hidden bg-gray-100" style={{ width: '60px', height: '190px' }}>
                                  {capturedFrames[row.timestamp]
                                    ? <img src={capturedFrames[row.timestamp]} alt={`Frame at ${row.timestamp}`} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center">
                                        {capturingFrames
                                          ? <span className="text-xs text-gray-300">…</span>
                                          : <span className="text-xs font-mono text-blue-300">{row.timestamp}</span>}
                                      </div>}
                                </div>
                                <div className="flex-1 min-w-0 py-0.5">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-xs font-mono text-blue-500">{row.timestamp}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[row.type] || 'bg-gray-100 text-gray-600'}`}>
                                      {TYPE_LABELS[row.type] || row.type}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-700 leading-relaxed mb-1">{row.visual}</p>
                                  {row.copy && <p className="text-xs text-gray-400 italic leading-relaxed">"{row.copy}"</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {videoAnalysis.copy_only?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Copy only</p>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {videoAnalysis.copy_only.filter(c => c.text).map(c => c.text).join(' ')}
                            </p>
                          </div>
                        )}

                        {videoAnalysis.transferrable_copy?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Transferrable format</p>
                              <button
                                onClick={() => navigator.clipboard.writeText(videoAnalysis.transferrable_copy.map(item => item.template).join('\n'))}
                                className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50 transition-colors">
                                Copy all
                              </button>
                            </div>
                            <div className="flex flex-col gap-3">
                              {videoAnalysis.transferrable_copy.map((item, i) => (
                                <div key={i} className="flex flex-col gap-1 py-2 border-b border-gray-50 last:border-0">
                                  <p className="text-xs text-gray-400 italic leading-relaxed">"{item.original}"</p>
                                  <p className="text-sm text-gray-800 leading-relaxed">{item.template}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {videoAnalysis.broll_shots?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">B-rolls to shoot</p>
                            <div className="flex flex-col gap-2">
                              {videoAnalysis.broll_shots.map((shot, i) => (
                                <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                                  <span className="w-5 h-5 rounded-full bg-green-50 text-green-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-medium">{i + 1}</span>
                                  <p className="text-sm text-gray-700 leading-relaxed">{shot}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div style={{ position: 'sticky', top: '24px' }}>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <video ref={videoRef} src={videoUrl} controls className="w-full" style={{ maxHeight: '360px' }} />
                      <video ref={captureVideoRef} src={`/api/proxy-video?url=${encodeURIComponent(videoUrl)}`} crossOrigin="anonymous" preload="auto" style={{ display: 'none' }} />
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

        {/* Group comparison mode */}
        {mode === 'compare' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Group comparison</p>
              <p className="text-sm text-gray-600 mb-4">
                Add up to 3 video URLs on each side. AI will identify what your ads are missing compared to your competitors.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <VideoInputList side="my" videos={myVideos} />
                <VideoInputList side="competitor" videos={competitorVideos} />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Context (optional)</label>
                <input type="text" value={compareContext} onChange={e => setCompareContext(e.target.value)}
                  placeholder="e.g. Both are DTC weight loss brands targeting women 25-40"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400" />
              </div>
              <button onClick={compareVideos} disabled={comparingVideos}
                className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {comparingVideos ? 'Comparing videos... this may take a few minutes' : 'Compare ads'}
              </button>
              {compareError && <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2.5">{compareError}</div>}
            </div>

            {compareResult && (
              <div className="flex flex-col gap-4">

                {/* 1. Hook & opener */}
                <SectionDivider label="1 — Hook & opener" />
                {compareResult.hook && (
                  <div className="flex flex-col gap-3">
                    {compareResult.hook.competitor_hooks?.map((h, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-6">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Competitor hook {compareResult.hook.competitor_hooks.length > 1 ? i + 1 : ''}</p>
                        <p className="text-2xl font-medium text-gray-900 leading-snug mb-3">"{h.copy}"</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{h.strategy}</p>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <p className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-2">Our hooks</p>
                        {compareResult.hook.my_hooks?.map((h, i) => (
                          <p key={i} className="text-sm text-blue-900 leading-relaxed mb-1">"{h.copy}"</p>
                        ))}
                      </div>
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                        <p className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-2">Analysis</p>
                        <p className="text-xs text-purple-900 leading-relaxed">{compareResult.hook.analysis}</p>
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                      <p className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-1">Gap</p>
                      <p className="text-sm text-amber-800 leading-relaxed">{compareResult.hook.gap}</p>
                    </div>
                  </div>
                )}

                {/* 2. Ad structure */}
                <SectionDivider label="2 — Ad structure" />
                <CompareAdStructureBars
                  mine={compareResult.ad_structure?.my_average}
                  competitor={compareResult.ad_structure?.competitor_average}
                />
                {compareResult.ad_structure?.gap && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-1">Gap</p>
                    <p className="text-sm text-amber-800 leading-relaxed">{compareResult.ad_structure.gap}</p>
                  </div>
                )}

                {/* 3. Buzz words */}
                <SectionDivider label="3 — Buzz words" />
                {compareResult.buzz_words?.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Words competitors always use</p>
                    <div className="flex flex-wrap gap-2">
                      {compareResult.buzz_words.map((item, i) => (
                        <span key={i} className={`bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-medium ${item.frequency === 'high' ? 'text-base' : item.frequency === 'medium' ? 'text-sm' : 'text-xs'}`}>
                          {item.word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Stats */}
                <SectionDivider label="4 — Stats comparison" />
                {compareResult.stats && (
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Avg duration', mine: compareResult.stats.my_avg_duration, comp: compareResult.stats.competitor_avg_duration },
                      { label: 'Avg cuts', mine: compareResult.stats.my_avg_cuts, comp: compareResult.stats.competitor_avg_cuts },
                      { label: 'Brand reveal', mine: compareResult.stats.my_brand_reveal, comp: compareResult.stats.competitor_brand_reveal },
                      { label: 'Product reveal', mine: compareResult.stats.my_product_reveal, comp: compareResult.stats.competitor_product_reveal },
                    ].map(stat => (
                      <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-400 mb-2">{stat.label}</p>
                        <p className="text-lg font-medium text-blue-600 mb-1">{stat.mine ?? '—'}</p>
                        <p className="text-xs text-gray-400">comp: {stat.comp ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Top 3 priorities */}
                <SectionDivider label="Top 3 priorities" />
                {compareResult.top3?.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {compareResult.top3.map((item, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-medium flex-shrink-0">{item.priority}</div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 mb-1">{item.title}</p>
                          <p className="text-sm text-gray-500 leading-relaxed">{item.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 5. Value propositions */}
                <SectionDivider label="5 — Value propositions" />
                {compareResult.value_propositions?.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">What competitors mention that we don't</p>
                    <div className="flex flex-col">
                      {compareResult.value_propositions.map((vp, i) => (
                        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${vp.mine_has ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                            {vp.mine_has ? '✓' : '✕'}
                          </div>
                          <p className="text-sm text-gray-700 flex-1">{vp.vp}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vp.mine_has ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {vp.mine_has ? 'We have it' : 'Missing'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Visual comparison */}
                <SectionDivider label="6 — Visual comparison" />
                {compareResult.visual_comparison && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <p className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-2">Our visuals</p>
                        <p className="text-sm text-blue-900 leading-relaxed">{compareResult.visual_comparison.mine}</p>
                      </div>
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                        <p className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-2">Competitor visuals</p>
                        <p className="text-sm text-purple-900 leading-relaxed">{compareResult.visual_comparison.competitor}</p>
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                      <p className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-1">Gap</p>
                      <p className="text-sm text-amber-800 leading-relaxed">{compareResult.visual_comparison.gap}</p>
                    </div>
                  </div>
                )}

                {/* 7. Talent */}
                <SectionDivider label="7 — Talent comparison" />
                {compareResult.talent && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-3">Our talent</p>
                      {[
                        { label: 'Appearance', value: compareResult.talent.mine?.appearance },
                        { label: 'Clothing', value: compareResult.talent.mine?.clothing },
                        { label: 'Setting', value: compareResult.talent.mine?.setting },
                        { label: 'Energy', value: compareResult.talent.mine?.energy },
                      ].map(item => item.value ? (
                        <div key={item.label} className="flex gap-2 mb-2 last:mb-0">
                          <p className="text-xs text-blue-400 w-20 flex-shrink-0 pt-0.5">{item.label}</p>
                          <p className="text-xs text-blue-900 leading-relaxed">{item.value}</p>
                        </div>
                      ) : null)}
                    </div>
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                      <p className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-3">Competitor talent</p>
                      {[
                        { label: 'Appearance', value: compareResult.talent.competitor?.appearance },
                        { label: 'Clothing', value: compareResult.talent.competitor?.clothing },
                        { label: 'Setting', value: compareResult.talent.competitor?.setting },
                        { label: 'Energy', value: compareResult.talent.competitor?.energy },
                      ].map(item => item.value ? (
                        <div key={item.label} className="flex gap-2 mb-2 last:mb-0">
                          <p className="text-xs text-purple-400 w-20 flex-shrink-0 pt-0.5">{item.label}</p>
                          <p className="text-xs text-purple-900 leading-relaxed">{item.value}</p>
                        </div>
                      ) : null)}
                    </div>
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