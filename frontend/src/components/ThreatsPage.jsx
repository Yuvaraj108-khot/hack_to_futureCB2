import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { BotActivityCard } from './ThreatsExtensions';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ─── Base hotspot data (claims + risk updated from API) ─────────────────────
const BASE_HOTSPOTS = [
  { name: 'India', coordinates: [78.9629, 20.5937], baseClaims: 1204, lang: 'Hindi', riskWeight: 1.0 },
  { name: 'USA', coordinates: [-95.7129, 37.0902], baseClaims: 876, lang: 'English', riskWeight: 0.7 },
  { name: 'Brazil', coordinates: [-51.9253, -14.235], baseClaims: 643, lang: 'Portuguese', riskWeight: 0.7 },
  { name: 'Pakistan', coordinates: [69.3451, 30.3753], baseClaims: 512, lang: 'Urdu', riskWeight: 0.9 },
  { name: 'Nigeria', coordinates: [8.6753, 9.0820], baseClaims: 401, lang: 'English', riskWeight: 0.85 },
  { name: 'Indonesia', coordinates: [113.9213, -0.7893], baseClaims: 338, lang: 'Bahasa', riskWeight: 0.65 },
  { name: 'Russia', coordinates: [105.3188, 61.524], baseClaims: 289, lang: 'Russian', riskWeight: 0.5 },
  { name: 'Bangladesh', coordinates: [90.3563, 23.685], baseClaims: 221, lang: 'Bangla', riskWeight: 0.9 },
];

// ─── ThreatDot — DO NOT MODIFY ───────────────────────────────────────────────
const ThreatDot = ({ coordinates, claims, name, lang, risk }) => {
  const [hovered, setHovered] = useState(false);
  const r = 4 + (claims / 400);
  const color = '#00f5d4';

  return (
    <Marker coordinates={coordinates} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <circle r={r * 2} fill={color} opacity={0.15} className="animate-ping" />
      <circle r={r} fill={color} opacity={0.9} style={{ cursor: 'pointer', filter: `drop-shadow(0 0 8px ${color})` }} />
      {hovered && (
        <g transform="translate(0, -10)">
          <foreignObject x="-80" y="-80" width="160" height="80" style={{ overflow: 'visible', pointerEvents: 'none' }}>
            <div style={{
              background: '#0d1526', border: `1px solid ${color}`,
              borderRadius: '8px', padding: '8px 10px', fontSize: '10px',
              color: '#e2e8f0', whiteSpace: 'nowrap', textAlign: 'center',
              boxShadow: `0 4px 12px rgba(0, 0, 0, 0.5)`
            }}>
              <div style={{ color: color, fontWeight: 900, marginBottom: 2, textTransform: 'uppercase' }}>{name}</div>
              <div>{claims} Active Claims</div>
              <div className="mt-1">Lang: {lang} | Risk: <span style={{ color: risk === 'HIGH' ? '#ef4444' : risk === 'MEDIUM' ? '#f59e0b' : '#22c55e' }}>{risk}</span></div>
            </div>
          </foreignObject>
        </g>
      )}
    </Marker>
  );
};

// ─── Compute risk level from score ──────────────────────────────────────────
const riskLevel = (score) => score > 70 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW';

export const ThreatsPage = () => {
  const [liveData, setLiveData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchLive = async () => {
    try {
      const res = await fetch(
        'https://hack-to-futurecb2-2.onrender.com/api/latest_claims'
      );

      const data = await res.json();

      if (Array.isArray(data)) {
        setLiveData(data);
        setLastUpdated(new Date().toLocaleTimeString());
      }

    } catch {
      /* backend offline — keep stale data */
    }
  };

  useEffect(() => {
    fetchLive();
    const t = setInterval(fetchLive, 30000);
    return () => clearInterval(t);
  }, []);

  // ── Dynamic hotspots: scale claims + risk from live API ──────────────────
  const avgRisk = liveData.length
    ? liveData.reduce((s, d) => s + (d.risk_score || 50), 0) / liveData.length
    : 50;
  const scale = 1 + (liveData.length / 40);

  const hotspots = BASE_HOTSPOTS.map(h => ({
    ...h,
    claims: Math.round(h.baseClaims * scale),
    risk: riskLevel(avgRisk * h.riskWeight),
  }));

  // ── Top 5 threats from live data ─────────────────────────────────────────
  const top5 = liveData.length
    ? [...liveData].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 5)
    : [
      { text: 'Mass vaccine death cover-up claim', category: 'Health', risk_score: 91, translated_text: 'Hindi' },
      { text: 'Emergency election fraud narrative', category: 'Politics', risk_score: 84, translated_text: 'English' },
      { text: 'Central bank collapse rumour', category: 'Finance', risk_score: 77, translated_text: 'Kannada' },
      { text: 'Terrorist sleeper cell activation hoax', category: 'Military', risk_score: 69, translated_text: 'Urdu' },
      { text: 'AI robot uprising disinformation wave', category: 'Tech', risk_score: 58, translated_text: 'Telugu' },
    ];

  const cardStyle = { backgroundColor: 'rgba(10,15,30,0.8)', border: '1px solid rgba(0,245,212,0.2)', borderRadius: 12 };

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#0a0f1e' }}>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl">
          <span className="text-white font-bold uppercase tracking-tight">THREAT</span>{' '}
          <span className="italic uppercase" style={{ color: '#00f5d4' }}>INTELLIGENCE MAP</span>
        </h1>
        {liveData.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 700 }}>LIVE — {liveData.length} claims indexed · Last sync {lastUpdated}</span>
          </div>
        )}
      </div>

      {/* Row 1: World Map + Bot Activity Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">

        {/* World Map */}
        <div className="lg:col-span-8 rounded-xl border p-6 flex flex-col" style={cardStyle}>
          <h2 className="text-sm font-bold uppercase mb-4" style={{ color: '#00f5d4' }}>Global Hotspots</h2>
          <div className="w-full flex-1 min-h-[400px] bg-[#060b18] rounded-xl overflow-hidden border flex items-center justify-center"
            style={{ borderColor: 'rgba(0,245,212,0.1)' }}>
            <ComposableMap projectionConfig={{ scale: 140 }} width={800} height={400} style={{ width: '100%', height: '100%' }}>
              <Geographies geography={geoUrl}>
                {({ geographies }) => geographies.map(geo => (
                  <Geography key={geo.rsmKey} geography={geo} fill="#0f172a" stroke="#1e293b" strokeWidth={0.5}
                    style={{ default: { outline: 'none' }, hover: { outline: 'none', fill: '#1e293b' }, pressed: { outline: 'none' } }} />
                ))}
              </Geographies>
              {hotspots.map((h, i) => <ThreatDot key={i} coordinates={h.coordinates} claims={h.claims} name={h.name} lang={h.lang} risk={h.risk} />)}
            </ComposableMap>
          </div>
        </div>

        {/* Bot Activity Intelligence */}
        <div className="lg:col-span-4">
          <BotActivityCard liveData={liveData} isLive={liveData.length > 0} lastUpdated={lastUpdated} />
        </div>
      </div>

      {/* Row 2: Top 5 Threats — real-time, full width */}
      <div className="rounded-xl border p-6" style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 className="text-sm font-bold uppercase" style={{ color: '#00f5d4' }}>Top 5 Threats</h2>
          {liveData.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
              <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 700 }}>LIVE</span>
            </div>
          )}
        </div>
        <div>
          {top5.map((t, i) => {
            const risk = t.risk_score || 0;
            const barColor = risk > 70 ? '#ef4444' : risk > 40 ? '#f59e0b' : '#22c55e';
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  height: 52, padding: '10px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  overflow: 'hidden',
                }}
              >
                {/* Rank */}
                <span style={{ color: '#00f5d4', fontWeight: 700, fontSize: 13, width: 30, flexShrink: 0, textAlign: 'center' }}>
                  #{i + 1}
                </span>

                {/* Claim text — truncated single line */}
                <span style={{
                  flex: 1, fontSize: 13, color: '#e2e8f0', fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {t.text}
                </span>

                {/* Category badge */}
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  padding: '3px 8px', borderRadius: 6,
                  background: 'rgba(0,245,212,0.08)', border: '1px solid rgba(0,245,212,0.25)',
                  color: '#00f5d4', letterSpacing: '0.05em',
                }}>
                  {t.category}
                </span>

                {/* Risk bar + score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, width: 160 }}>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${risk}%` }} transition={{ duration: 1 }}
                      style={{ height: '100%', background: barColor, boxShadow: `0 0 6px ${barColor}80`, borderRadius: 4 }}
                    />
                  </div>
                  <span style={{ color: barColor, fontWeight: 700, fontSize: 12, fontFamily: 'monospace', width: 26, textAlign: 'right' }}>
                    {risk}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
