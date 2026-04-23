'use client';

import { useEffect, useRef } from 'react';
import { Flex } from '@tremor/react';
import { 
    ComposedChart, Bar, Line, XAxis, YAxis, Tooltip as ReTooltip, 
    ResponsiveContainer, CartesianGrid, LabelList
} from 'recharts';
import type { ChartSectionProps } from '@/lib/types';
import { getColor } from '@/lib/constants';
import { formatValue } from '@/lib/formatters';

export function ChartSection({ title, label, data, categories, minColWidth = 60, barCategoryGap = "10%", isCurrency = true }: ChartSectionProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        }
    }, [data]);

    return (
        <div className="space-y-6">
            <Flex className="px-2" alignItems="end">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-[#0C0C0C]">{title}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{label} TREND ANALYSIS</p>
                </div>
                <div className="hidden md:flex gap-6 items-center bg-white px-4 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                    {Array.isArray(categories) && categories.map((cat, i) => (
                        <div key={cat} className="flex items-center gap-2 group cursor-default">
                            <div className="w-3 h-3 rounded-sm shadow-sm border border-white" style={{ backgroundColor: getColor(i, categories.length) }} />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-[#0C0C0C] transition-colors">{cat}</span>
                        </div>
                    ))}
                </div>
            </Flex>

            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/30 p-10 border border-slate-50 relative overflow-hidden group transition-all">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div ref={containerRef} className="h-[450px] overflow-x-auto scrollbar-hide">
                    {Array.isArray(data) && data.length > 0 && (
                        <div style={{ minWidth: `${Math.max(800, data.length * minColWidth)}px`, height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data} barCategoryGap={barCategoryGap} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={15} />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                                        tickFormatter={(val) => formatValue(val, isCurrency)}
                                        width={60}
                                    />
                                    <ReTooltip 
                                        cursor={{ fill: '#f8fafc', radius: 12 }}
                                        content={(props) => {
                                            const { payload, active, label: timeLabel } = props;
                                            if (!active || !payload || payload.length === 0) return null;
                                            const growth = payload[0].payload.growth;
                                            const total = payload[0].payload.total;
                                            return (
                                                <div className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-100 min-w-[320px]">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-50 pb-3">{timeLabel}</p>
                                                    <div className="space-y-4 mb-5">
                                                        {payload.filter((p: any) => p.dataKey !== 'total' && p.dataKey !== 'growth').map((entry: any) => {
                                                            const catGrowth = entry.payload.categoryGrowth?.[entry.name];
                                                            const actualIndex = categories.indexOf(entry.name);
                                                            const color = getColor(actualIndex, categories.length);
                                                            return (
                                                                <div key={entry.name} className="flex justify-between items-center gap-6">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                                                                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tighter">{entry.name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-xs font-black text-[#0C0C0C]">{formatValue(entry.value, isCurrency)}</span>
                                                                        {catGrowth !== undefined && (
                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${catGrowth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                                                                                {catGrowth >= 0 ? '+' : ''}{catGrowth.toFixed(2)}%
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center border border-slate-100">
                                                        <div className="flex items-center gap-3"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">TOTAL</p><p className="text-xl font-bold text-[#0C0C0C]">{formatValue(total, isCurrency)}</p></div>
                                                        <div className={`px-3 py-1 rounded-md text-[11px] font-bold ${(growth ?? 0) >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                            {(growth ?? 0) >= 0 ? '+' : ''}{(growth ?? 0).toFixed(2)}%
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    />
                                    {Array.isArray(categories) && categories.map((category, i) => (
                                        <Bar 
                                            key={category} 
                                            dataKey={category} 
                                            stackId="a" 
                                            fill={getColor(i, categories.length)} 
                                            radius={i === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                                            isAnimationActive={true}
                                            stroke="#fff"
                                            strokeWidth={2}
                                        />
                                    ))}
                                    <Line 
                                        type="monotone" 
                                        dataKey="total" 
                                        stroke="none" 
                                        dot={false} 
                                        isAnimationActive={false}
                                    >
                                        <LabelList dataKey="growth" position="top" content={(props: any) => {
                                            const { x, y, value, index } = props;
                                            if (index === 0 || value === undefined || value === null || Math.abs(value) < 0.1) return null;
                                            const isPos = value >= 0;
                                            return (
                                                <g>
                                                    <rect x={x - 22} y={y - 30} width={44} height={20} rx={10} fill={isPos ? '#d1fae5' : '#fee2e2'} />
                                                    <text x={x} y={y - 16} fill={isPos ? '#047857' : '#b91c1c'} textAnchor="middle" className="text-[9px] font-bold leading-none">{isPos ? '+' : ''}{value.toFixed(2)}%</text>
                                                </g>
                                            );
                                        }}/>
                                    </Line>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
