import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, LayoutGrid, ListFilter } from 'lucide-react';
import axios from 'axios';

const COLORS = ['#06b6d4', '#d946ef', '#84cc16', '#eab308', '#64748b'];

export const AdminCenter = () => {
  const [stats, setStats] = useState(null);
  const [latest, setLatest] = useState([]);

useEffect(() => {
  const fetchData = async () => {
    try {
      const statsRes = await axios.get(
        'https://hack-to-futurecb2-2.onrender.com/api/stats'
      );

      setStats(statsRes.data);

      const latestRes = await axios.get(
        'https://hack-to-futurecb2-2.onrender.com/api/latest_claims'
      );

      setLatest(latestRes.data);

    } catch (err) {
      console.error("Stats fetch failed", err);
    }
  };

  fetchData();
}, []);

  const mockTrendData = [
    { time: '00:00', surge: 12 },
    { time: '04:00', surge: 18 },
    { time: '08:00', surge: 45 },
    { time: '12:00', surge: 78 },
    { time: '16:00', surge: 62 },
    { time: '20:00', surge: 94 },
    { time: '23:59', surge: 88 },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-10 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-black uppercase tracking-tighter text-white italic">
          Admin <span className="text-cyan-400">Command Center</span>
        </h2>
        <div className="flex gap-4">
           <div className="bg-slate-900 border border-white/5 px-4 py-2 rounded-lg text-xs font-bold text-slate-500 uppercase tracking-widest">
             Status: <span className="text-lime-400">Encrypted</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Trend Chart */}
        <div className="lg:col-span-8 cyber-card">
          <div className="flex items-center gap-2 mb-8">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Intelligence Surge Analytics</h4>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockTrendData}>
                <defs>
                  <linearGradient id="colorSurge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10}} />
                <Tooltip 
                  contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                />
                <Area type="monotone" dataKey="surge" stroke="#06b6d4" fillOpacity={1} fill="url(#colorSurge)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Heatmap */}
        <div className="lg:col-span-4 cyber-card">
           <div className="flex items-center gap-2 mb-8">
            <LayoutGrid className="w-4 h-4 text-magenta-400" />
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Category Heatmap</h4>
          </div>
          <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.category_distribution || [{name: 'Empty', value: 1}]}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats?.category_distribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Intelligence Stream */}
      <div className="cyber-card">
        <div className="flex items-center gap-2 mb-8">
          <ListFilter className="w-4 h-4 text-lime-400" />
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Live Intelligence Stream</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="pb-4 px-4">Claim Metadata</th>
                <th className="pb-4 px-4">Category</th>
                <th className="pb-4 px-4">Verdict</th>
                <th className="pb-4 px-4">Risk</th>
                <th className="pb-4 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {latest.map((claim) => (
                <tr key={claim.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4 max-w-md truncate font-medium text-slate-300">{claim.text}</td>
                  <td className="py-4 px-4"><span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] uppercase">{claim.category}</span></td>
                  <td className="py-4 px-4"><span className={`font-bold uppercase ${claim.verdict.includes('FALSE') ? 'text-red-400' : 'text-lime-400'}`}>{claim.verdict}</span></td>
                  <td className="py-4 px-4 font-mono text-cyan-500 font-bold">{claim.risk_score}</td>
                  <td className="py-4 px-4 text-slate-500">{new Date(claim.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
