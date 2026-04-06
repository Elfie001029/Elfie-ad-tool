'use client';
import { useState } from 'react';

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

export default function Home() {
  const [mode, setMode] = useState('single');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoContext, setVideoContext] = useState('');
  const [videoAnalysis, setVideoAnalysis] = useState(null);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  const [videoError, setVideoError] = useState('');

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
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono bg-white focus:outline-none focus:border-gray-400"
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

  function GeneralAnalysis({ data }) {
    if (!data) return null;
    const g = data;
    return (
      <div className="flex flex-col gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Hook analysis</p>
          <p className="text-sm font-medium text-gray-900 mb-1">{g.hook?.summary}</p>
          <p className="text-sm text-gray-500 leading-relaxed">{g.hook?.psychology}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Opener</p>
          <p className="text-sm text-gray-900 mb-2 leading-relaxed">{g.opener?.description}</p>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 mb-1">Product relationship</p>
            <p className="text-sm text-gray-600">{g.opener?.product_relationship}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Brand reveal</p>
            <p className="text-2xl font-medium text-gray-900 mb-1">{g.brand_reveal?.timestamp}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{g.brand_reveal?.description}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Product reveal</p>
            <p className="text-2xl font-medium text-gray-900 mb-1">{g.product_reveal?.timestamp}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{g.product_reveal?.description}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Ad structure</p>
          <p className="text-sm text-gray-700 leading-relaxed">{g.structure}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">CTA</p>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">{g.cta?.timestamp}</span>
            <span className="text-sm font-medium text-gray-900">"{g.cta?.text}"</span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">{g.cta?.strategy}</p>
        </div>
      </div>
    );
  }

  function Timeline({ data }) {
    if (!data?.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Frame by frame</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-5 py-3 w-24">Time</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3 w-28">Type</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Visual</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Copy / script</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-5 py-3 text-xs font-mono text-gray-500 align-top">{row.timestamp}</td>
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
      <div className="max-w-3xl mx-auto">

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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-gray-400"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Brand context (optional)</label>
                <input
                  type="text"
                  value={videoContext}
                  onChange={e => setVideoContext(e.target.value)}
                  placeholder="e.g. Hims hair loss ad targeting men 30-45"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
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
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">Total cuts</p>
                    <p className="text-xl font-medium text-gray-900">{videoAnalysis.timeline?.length ?? '—'}</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">Brand reveal</p>
                    <p className="text-xl font-medium text-gray-900">{videoAnalysis.general?.brand_reveal?.timestamp ?? '—'}</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">Product reveal</p>
                    <p className="text-xl font-medium text-gray-900">{videoAnalysis.general?.product_reveal?.timestamp ?? '—'}</p>
                  </div>
                </div>
                <GeneralAnalysis data={videoAnalysis.general} />
                <Timeline data={videoAnalysis.timeline} />
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
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