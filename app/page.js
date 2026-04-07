'use client';
import { useState, useRef } from 'react';

const TYPE_LABELS = {
  talking_head: 'Talking head',
  broll: 'B-roll',
  text_overlay: 'Text overlay',
  product_shot: 'Product shot',
  logo: 'Logo',
};

const TYPE_COLORS = {
  talking_head: 'bg-blue-50 text-blue-700',
  broll: 'bg-green-50 text-green-700',
  text_overlay: 'bg-purple-50 text-purple-700',
  product_shot: 'bg-amber-50 text-amber-700',
  logo: 'bg-gray-100 text-gray-600',
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

  const [myVideos, setMyVideos] = useState(['']);
  const [competitorVideos, setCompetitorVideos] = useState(['']);
  const [compareContext, setCompareContext] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [comparingVideos, setComparingVideos] = useState(false);
  const [compareError, setCompareError] = useState('');

  async function analyzeVideo() {
    if (!videoUrl) return setVideoError('Please paste a video URL first.');
    setVideoError('');
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

        {/* Tick marks above bar */}
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

        {/* Bar with tick lines */}
        <div className="relative h-10 flex rounded-lg overflow-hidden mb-1 gap-px">
          {data.map((section, i) => {
            const start = timestampToSeconds(section.start);
            const end = timestampToSeconds(section.end);
            const width = ((end - start) / totalSeconds) * 100;
            const color = SECTION_COLORS[section.section]?.bg || '#6b7280';
            return (
              <button
                key={i}
                onClick={() => jumpToTimestamp(section.start)}
                style={{ width: `${Math.max(width, 1)}%`, backgroundColor: color }}
                className="hover:opacity-75 transition-opacity relative"
                title={`${section.section} (${section.start})`}
              />
            );
          })}

          {/* Brand reveal tick */}
          {brandReveal && (
            <div
              className="absolute top-0 bottom-0 w-px bg-white opacity-90 pointer-events-none"
              style={{ left: `${brandPct}%` }}
            />
          )}
          {/* Product reveal tick */}
          {productReveal && (
            <div
              className="absolute top-0 bottom-0 w-px bg-white opacity-90 pointer-events-none"
              style={{ left: `${productPct}%` }}
            />
          )}
        </div>

        {/* Timestamps below bar */}
        <div className="relative h-5 mb-4">
          {brandReveal && (
            <div className="absolute" style={{ left: `${brandPct}%`, transform: 'translateX(-50%)' }}>
              <span className="text-xs font-mono text-gray-400">{brandReveal}</span>
            </div>
          )}
          {productReveal && Math.abs(productPct - brandPct) > 5 && (
            <div className="absolute" style={{ left: `${productPct}%`, transform: 'translateX(-50%)' }}>
              <span className="text-xs font-mono text-gray-400">{productReveal}</span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {data.map((section, i) => {
            const colors = SECTION_COLORS[section.section] || { light: 'bg-gray-50', text: 'text-gray-700', bg: '#6b7280' };
            return (
              <button
                key={i}
                onClick={() => jumpToTimestamp(section.start)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.light} hover:opacity-80 transition-opacity`}
              >
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
              <input
                type="text"
                value={url}
                onChange={e => updateVideo(side, i, e.target.value)}
                placeholder="https://file.swipekit.app/fb-xxx.mp4"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:border-gray-400"
              />
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

  function TrendsSection({ data }) {
    if (!data) return null;
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Product reveal — avg time</p>
            <div className="flex items-end gap-4 mb-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Competitors</p>
                <p className="text-2xl font-medium text-gray-900">{data.product_reveal?.competitor_average}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">My ads</p>
                <p className="text-2xl font-medium text-blue-600">{data.product_reveal?.my_average}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{data.product_reveal?.insight}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Brand reveal — avg time</p>
            <div className="flex items-end gap-4 mb-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Competitors</p>
                <p className="text-2xl font-medium text-gray-900">{data.brand_reveal?.competitor_average}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">My ads</p>
                <p className="text-2xl font-medium text-blue-600">{data.brand_reveal?.my_average}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{data.brand_reveal?.insight}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Top attention words</p>
          <div className="flex flex-wrap gap-2">
            {data.attention_words?.map((word, i) => (
              <span key={i} className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full">{word}</span>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Competitor structural pattern</p>
          <p className="text-sm text-gray-700 leading-relaxed">{data.structural_pattern}</p>
        </div>
      </div>
    );
  }

  function GapsSection({ data }) {
    if (!data?.length) return null;
    return (
      <div className="flex flex-col gap-3">
        {data.map((gap, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">{gap.dimension}</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-600 mb-1">My ads</p>
                <p className="text-xs text-gray-700 leading-relaxed">{gap.mine}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-xs font-medium text-purple-600 mb-1">Competitors</p>
                <p className="text-xs text-gray-700 leading-relaxed">{gap.competitor}</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">Gap</p>
              <p className="text-xs text-amber-800 leading-relaxed">{gap.gap}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function Top3Section({ data }) {
    if (!data?.length) return null;
    return (
      <div className="flex flex-col gap-3">
        {data.map((item, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4">
            <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
              {item.priority}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 mb-1">{item.title}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{item.action}</p>
            </div>
          </div>
        ))}
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
          <button
            onClick={() => setMode('single')}
            className={`p-4 rounded-xl border text-left transition-colors ${mode === 'single' ? 'border-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <p className={`text-sm font-medium mb-1 ${mode === 'single' ? 'text-gray-900' : 'text-gray-500'}`}>Single video</p>
            <p className="text-xs text-gray-400">Analyze one video ad in depth</p>
          </button>
          <button
            onClick={() => setMode('compare')}
            className={`p-4 rounded-xl border text-left transition-colors ${mode === 'compare' ? 'border-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
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
                <input
                  type="text"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://file.swipekit.app/fb-xxx.mp4"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:border-gray-400"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Brand context (optional)</label>
                <input
                  type="text"
                  value={videoContext}
                  onChange={e => setVideoContext(e.target.value)}
                  placeholder="e.g. Hims hair loss ad targeting men 30-45"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400"
                />
              </div>
              <button
                onClick={analyzeVideo}
                disabled={analyzingVideo}
                className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {analyzingVideo ? 'Analyzing video... this takes 1-2 minutes' : 'Analyze video'}
              </button>
              {videoError && <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2.5">{videoError}</div>}
            </div>

            {videoAnalysis && (
              <>
                {/* Analysis tabs */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                  <button
                    onClick={() => setActiveTab('analysis')}
                    className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${activeTab === 'analysis' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Analysis
                  </button>
                  <button
                    onClick={() => setActiveTab('framebyfrime')}
                    className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${activeTab === 'framebyfrime' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Frame by frame
                  </button>
                </div>

                {/* Two column layout */}
                <div className="grid gap-6 items-start" style={{ gridTemplateColumns: '3fr 2fr' }}>

                  {/* Left column */}
                  <div className="flex flex-col gap-4">

                    {/* TAB 1 — ANALYSIS */}
                    {activeTab === 'analysis' && (
                      <>
                        {/* 1. Hook & Opener */}
                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Hook & opener</p>
                          <p className="text-2xl font-medium text-gray-900 leading-snug mb-4">
                            "{videoAnalysis.general?.hook?.copy}"
                          </p>
                          <div className="border-t border-gray-100 pt-4">
                            <p className="text-xs text-gray-400 mb-1">Visual opener</p>
                            <p className="text-sm text-gray-700 leading-relaxed mb-3">{videoAnalysis.general?.hook?.visual}</p>
                            <button
                              onClick={() => jumpToTimestamp(videoAnalysis.general?.opener?.timestamp || '00:00:00')}
                              className="text-xs text-blue-500 hover:text-blue-700 font-mono hover:underline"
                            >
                              ▶ {videoAnalysis.general?.opener?.timestamp || '00:00:00'} — Jump to opener
                            </button>
                          </div>
                        </div>

                        {/* 2. Ad structure */}
                        <AdStructureBar
                          data={videoAnalysis.general?.ad_structure}
                          duration={videoAnalysis.general?.duration}
                          brandReveal={videoAnalysis.general?.brand_reveal?.timestamp}
                          productReveal={videoAnalysis.general?.product_reveal?.timestamp}
                        />

                        {/* 3. Stats */}
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Total time', value: videoAnalysis.general?.duration ?? '—' },
                            { label: 'Total cuts', value: videoAnalysis.timeline?.length ?? '—' },
                            { label: 'Brand reveal', value: videoAnalysis.general?.brand_reveal?.timestamp ?? '—', ts: videoAnalysis.general?.brand_reveal?.timestamp },
                            { label: 'Product reveal', value: videoAnalysis.general?.product_reveal?.timestamp ?? '—', ts: videoAnalysis.general?.product_reveal?.timestamp },
                          ].map(stat => (
                            <div
                              key={stat.label}
                              onClick={() => stat.ts && jumpToTimestamp(stat.ts)}
                              className={`bg-white border border-gray-200 rounded-xl p-4 text-center ${stat.ts ? 'cursor-pointer hover:border-blue-300 transition-colors' : ''}`}
                            >
                              <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                              <p className={`text-lg font-medium ${stat.ts ? 'text-blue-600' : 'text-gray-900'}`}>{stat.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* 4. Value propositions */}
                        {videoAnalysis.general?.value_propositions?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Value propositions</p>
                            <div className="flex flex-col gap-2">
                              {videoAnalysis.general.value_propositions.map((vp, i) => (
                                <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                  <p className="text-sm text-gray-700 leading-relaxed">{vp}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 5. Talent */}
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

                        {/* 6. CTA */}
                        {videoAnalysis.general?.cta && (
                          <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">CTA</p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => jumpToTimestamp(videoAnalysis.general.cta.timestamp)}
                                className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors flex-shrink-0"
                              >
                                {videoAnalysis.general.cta.timestamp}
                              </button>
                              <p className="text-sm font-medium text-gray-900">"{videoAnalysis.general.cta.text}"</p>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* TAB 2 — FRAME BY FRAME */}
                    {activeTab === 'framebyfrime' && (
                      <>
                        {/* A: Frame by frame table */}
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                          <div className="px-5 py-4 border-b border-gray-100">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Frame by frame</p>
                            <p className="text-xs text-gray-400 mt-1">Click any row to jump to that moment</p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gray-100">
                                  <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 w-24">Time</th>
                                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3 w-28">Type</th>
                                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Visual</th>
                                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Copy</th>
                                </tr>
                              </thead>
                              <tbody>
                                {videoAnalysis.timeline?.map((row, i) => (
                                  <tr
                                    key={i}
                                    className={`border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                                    onClick={() => jumpToTimestamp(row.timestamp)}
                                  >
                                    <td className="px-5 py-3 align-top">
                                      <span className="text-xs font-mono text-blue-500">{row.timestamp}</span>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${TYPE_COLORS[row.type] || 'bg-gray-100 text-gray-600'}`}>
                                        {TYPE_LABELS[row.type] || row.type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-700 leading-relaxed align-top max-w-xs">{row.visual}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500 leading-relaxed align-top max-w-xs italic">{row.copy || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* B: Copy only */}
                        {videoAnalysis.copy_only?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100">
                              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Copy only</p>
                            </div>
                            <div className="flex flex-col">
                              {videoAnalysis.copy_only.filter(c => c.text).map((line, i) => (
                                <div
                                  key={i}
                                  className="flex gap-4 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                                  onClick={() => jumpToTimestamp(line.timestamp)}
                                >
                                  <span className="text-xs font-mono text-blue-500 flex-shrink-0 pt-0.5">{line.timestamp}</span>
                                  <p className="text-sm text-gray-700 leading-relaxed">{line.text}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* C: Transferrable copy */}
                        {videoAnalysis.transferrable_copy?.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100">
                              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Transferrable format</p>
                              <p className="text-xs text-gray-400 mt-1">Reusable copy templates from this ad</p>
                            </div>
                            <div className="flex flex-col">
                              {videoAnalysis.transferrable_copy.map((item, i) => (
                                <div key={i} className="px-5 py-4 border-b border-gray-50 last:border-0">
                                  <p className="text-xs text-gray-400 mb-1">Original</p>
                                  <p className="text-sm text-gray-600 italic mb-2">"{item.original}"</p>
                                  <p className="text-xs text-gray-400 mb-1">Template</p>
                                  <p className="text-sm font-medium text-gray-900">{item.template}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* D: B-rolls to shoot */}
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

                  {/* Right — sticky video */}
                  <div style={{ position: 'sticky', top: '24px' }}>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        controls
                        className="w-full"
                        style={{ maxHeight: '360px' }}
                      />
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
                <input
                  type="text"
                  value={compareContext}
                  onChange={e => setCompareContext(e.target.value)}
                  placeholder="e.g. Both are DTC weight loss brands targeting women 25-40"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400"
                />
              </div>
              <button
                onClick={compareVideos}
                disabled={comparingVideos}
                className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {comparingVideos ? 'Comparing videos... this may take a few minutes' : 'Compare ads'}
              </button>
              {compareError && <div className="mt-3 bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2.5">{compareError}</div>}
            </div>

            {compareResult && (
              <>
                {compareResult.gaps?.filter(g => g.dimension === 'Hook strategy' || g.dimension === 'Pacing & editing').map((gap, i) => (
                  <div key={i} className="bg-gray-900 rounded-xl p-6">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{gap.dimension}</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Competitors</p>
                        <p className="text-lg font-medium text-white leading-snug">{gap.competitor}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-2">My ads</p>
                        <p className="text-lg font-medium text-gray-400 leading-snug">{gap.mine}</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-700 pt-4">
                      <p className="text-xs text-gray-500 mb-1">Gap</p>
                      <p className="text-sm text-amber-400 leading-relaxed">{gap.gap}</p>
                    </div>
                  </div>
                ))}

                <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 border-l-4 border-l-gray-900">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Trends</p>
                  <p className="text-xs text-gray-400">Patterns across all competitor ads</p>
                </div>
                <TrendsSection data={compareResult.trends} />

                <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 border-l-4 border-l-gray-900">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Gap analysis</p>
                  <p className="text-xs text-gray-400">What your ads are missing vs competitors</p>
                </div>
                <GapsSection data={compareResult.gaps} />

                <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 border-l-4 border-l-gray-900">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Top 3 priorities</p>
                  <p className="text-xs text-gray-400">The most important things to fix first</p>
                </div>
                <Top3Section data={compareResult.top3} />
              </>
            )}
          </div>
        )}

      </div>
    </main>
  );
}