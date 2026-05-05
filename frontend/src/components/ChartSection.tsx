'use client';

import { useEffect, useRef, useState } from 'react';
import { Flex } from '@tremor/react';
import { 
    ComposedChart, Bar, Line, XAxis, YAxis, Tooltip as ReTooltip, 
    ResponsiveContainer, CartesianGrid, LabelList
} from 'recharts';
import type { ChartSectionProps } from '@/lib/types';
import { getColor, MIN_COLOR } from '@/lib/constants';
import { formatValue } from '@/lib/formatters';


export function ChartSection({ 
    title, 
    label, 
    data, 
    categories, 
    statuses = {},
    minColWidth = 60, 
    barCategoryGap = "10%", 
    isCurrency = true,
    view = 'combined',
    legendDimension = '',
    activeFilters = {},
    customTooltip = null
}: any) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pinnedPoint, setPinnedPoint] = useState<any>(null);
    const [chartHeight, setChartHeight] = useState(450);
    const [isResizing, setIsResizing] = useState(false);
    
    const startResize = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        const startY = e.clientY;
        const startHeight = chartHeight;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            setChartHeight(Math.max(200, startHeight + deltaY));
        };

        const onMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    
    const isStatusFiltered = activeFilters.status && activeFilters.status.length > 0 && activeFilters.status[0] !== '';
    const canFilterByStatus = ['Product name', 'Item name', 'counterparty'].includes(legendDimension);
    const showStatusWarning = isStatusFiltered && !canFilterByStatus;

    // Reset pinned point when data changes
    useEffect(() => {
        setPinnedPoint(null);
    }, [data, categories, legendDimension]);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        }
    }, [data]);

    const handleChartClick = (state: any) => {
        const coords = state?.activeCoordinate;
        const chartX = state?.chartX;
        const chartY = state?.chartY;
        
        let payload = state?.activePayload;
        let label = state?.activeLabel;

        // Recovery logic: if Recharts didn't provide payload, get it from source data
        if (!payload && state && state.activeTooltipIndex !== undefined) {
            const index = Number(state.activeTooltipIndex);
            const item = data[index];
            if (item) {
                label = item.time;
                payload = categories.map((cat: string) => ({
                    name: cat,
                    dataKey: cat,
                    value: item[cat],
                    payload: item
                }));
            }
        }

        if (payload && payload.length > 0) {
            const finalX = coords?.x || chartX || 0;
            const finalY = coords?.y || chartY || 0;

            setPinnedPoint({
                payload,
                label: label || "",
                x: finalX,
                y: finalY
            });
        } else {
            setPinnedPoint(null);
        }
    };

    return (
        <div className="space-y-6 relative">
            {showStatusWarning && (
                <div className="absolute inset-0 z-[100] bg-white/95 backdrop-blur-md flex items-center justify-center rounded-3xl border border-slate-200/60 shadow-inner">
                    <div className="text-center p-8 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-sm">
                            <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <h3 className="text-xl font-black text-[#0C0C0C] mb-3 tracking-tight">DIMENSION MISMATCH</h3>
                        <p className="text-sm font-bold text-slate-400 max-w-[280px] mx-auto leading-relaxed uppercase tracking-widest">
                            Status filtering is only supported for <span className="text-slate-600">Product</span>, <span className="text-slate-600">SKU</span>, or <span className="text-slate-600">Client</span>.
                        </p>
                    </div>
                </div>
            )}
            <Flex className="px-2" alignItems="end">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-[#0C0C0C]">{title}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{label} TREND ANALYSIS</p>
                </div>
                {view === 'combined' && (
                    <div className="hidden md:flex gap-6 items-center bg-white px-4 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                        {Array.isArray(categories) && categories.map((cat: string, i: number) => (
                            <div key={cat} className="flex items-center gap-2 group cursor-default">
                                <div className="w-3 h-3 rounded-sm shadow-sm border border-white" style={{ backgroundColor: cat === 'Other' ? MIN_COLOR : getColor(i, categories.length) }} />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-[#0C0C0C] transition-colors">{cat}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Flex>

            <div className={`bg-white rounded-3xl shadow-xl shadow-slate-200/30 p-10 pb-12 border border-slate-50 relative overflow-hidden group ${isResizing ? '' : 'transition-all'}`}>
                <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Resizer Handle */}
                <div 
                    className="absolute bottom-0 left-0 w-full h-3 cursor-row-resize hover:bg-slate-200 active:bg-slate-300 transition-colors z-50 flex items-center justify-center group/resizer"
                    onMouseDown={startResize}
                    title="Drag to resize"
                >
                    <div className="w-12 h-1 bg-slate-300 rounded-full group-hover/resizer:bg-slate-500 transition-colors" />
                </div>

                <div ref={containerRef} className="overflow-y-auto overflow-x-auto scrollbar-hide relative" style={{ height: view === 'combined' ? `${chartHeight}px` : 'auto' }}>
                    {view === 'combined' ? (
                        Array.isArray(data) && data.length > 0 && (
                            <div className="flex min-h-full w-max min-w-full">
                                {/* Sticky Y-Axis */}
                                <div className="sticky left-0 z-20 bg-white/95 backdrop-blur-md pr-2 border-r border-slate-100/50 shadow-[12px_0_20px_-10px_rgba(0,0,0,0.03)] flex-shrink-0" style={{ width: '85px', height: `${chartHeight}px` }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={data} margin={{ top: 30, right: 0, left: 5, bottom: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} 
                                                tickFormatter={(val) => formatValue(val, isCurrency)}
                                                width={65}
                                                domain={['auto', 'auto']}
                                            />
                                            {/* Transparent bar to ensure axis scale is calculated */}
                                            <Bar dataKey="total" fill="transparent" isAnimationActive={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Scrollable Chart Content */}
                                <div style={{ minWidth: `${Math.max(800, data.length * minColWidth)}px`, height: `${chartHeight}px` }} className="flex-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart 
                                            data={data} 
                                            barCategoryGap={barCategoryGap} 
                                            margin={{ top: 30, right: 30, left: 0, bottom: 40 }}
                                            onClick={(state: any) => {
                                                handleChartClick(state);
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" style={{ pointerEvents: 'none' }} />
                                            <XAxis 
                                                dataKey="time" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                                                dy={15} 
                                                style={{ pointerEvents: 'none' }}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={false} width={0} domain={['auto', 'auto']} style={{ pointerEvents: 'none' }} />
                                            <ReTooltip 
                                                active={pinnedPoint ? true : undefined}
                                                position={pinnedPoint ? { x: pinnedPoint.x, y: pinnedPoint.y - 120 } : undefined}
                                                wrapperStyle={{ 
                                                    pointerEvents: pinnedPoint ? 'auto' : 'none', 
                                                    zIndex: 1000 
                                                }}
                                                cursor={pinnedPoint ? false : { fill: '#f8fafc', radius: 12, pointerEvents: 'none' }}
                                                content={(props: any) => {
                                                    // Determine which data to display
                                                    const isPinned = !!pinnedPoint;
                                                    const displayPayload = isPinned ? pinnedPoint.payload : props.payload;
                                                    const displayLabel = isPinned ? pinnedPoint.label : props.label;
                                                    const isActive = isPinned || props.active;

                                                    if (!isActive || !displayPayload || displayPayload.length === 0) return null;

                                                    // Use the customTooltip if provided (for AI analysis button)
                                                    if (customTooltip) {
                                                        const React = require('react');
                                                        return (
                                                            <div className="relative">
                                                                {React.cloneElement(customTooltip, { active: true, payload: displayPayload, label: displayLabel })}
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    const growth = displayPayload[0].payload.growth;
                                                    const total = displayPayload[0].payload.total;
                                                    return (
                                                        <div className="bg-white/95 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-slate-100 min-w-[320px] z-[100] relative">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-50 pb-3">{displayLabel}</p>
                                                            <div className="space-y-4 mb-5">
                                                                {displayPayload.filter((p: any) => p.dataKey !== 'total' && p.dataKey !== 'growth').sort((a: any, b: any) => Number(b.value) - Number(a.value)).map((entry: any) => {
                                                                    const catGrowth = entry.payload.categoryGrowth?.[entry.name];
                                                                    const actualIndex = categories.indexOf(entry.name);
                                                                    const color = entry.name === 'Other' ? MIN_COLOR : getColor(actualIndex, categories.length);
                                                                    return (
                                                                        <div key={entry.name} className="flex justify-between items-center gap-6">
                                                                            <div className="flex-1 flex items-center gap-3 min-w-0">
                                                                                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                                                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tighter truncate">{entry.name}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-4 flex-shrink-0">
                                                                                <span className="text-xs font-black text-[#0C0C0C] w-24 text-right">{formatValue(entry.value, isCurrency)}</span>
                                                                                <div className="w-16 flex justify-end">
                                                                                    {catGrowth !== undefined && (
                                                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${catGrowth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                                                                                            {catGrowth >= 0 ? '+' : ''}{catGrowth.toFixed(2)}%
                                                                                        </span>
                                                                                    )}
                                                                                </div>
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
                                            {Array.isArray(categories) && categories.map((category: string, i: number) => (
                                                <Bar 
                                                    key={category} 
                                                    dataKey={category} 
                                                    stackId="a" 
                                                    fill={category === 'Other' ? MIN_COLOR : getColor(i, categories.length)} 
                                                    radius={i === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                                                    isAnimationActive={true}
                                                    stroke="#fff"
                                                    strokeWidth={2}
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={(data, index, e) => {
                                                        if (e) e.stopPropagation();
                                                        handleChartClick(data);
                                                    }}
                                                />
                                            ))}
                                            <Line 
                                                type="monotone" 
                                                dataKey="total" 
                                                stroke="none" 
                                                dot={false} 
                                                isAnimationActive={false}
                                                style={{ pointerEvents: 'none' }}
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
                            </div>
                        )
                    ) : (
                        <div className="space-y-12">
                            {categories.map((category: string, i: number) => (
                                <div key={category} className="space-y-4 relative">
                                    <div className="flex items-center gap-3 sticky left-0 z-30 bg-white/50 backdrop-blur-sm w-fit pr-4 rounded-r-lg">
                                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: category === 'Other' ? MIN_COLOR : getColor(i, categories.length) }} />
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            {category}
                                        </h3>
                                    </div>
                                    <div className="flex w-max min-w-full" style={{ height: `${chartHeight}px` }}>
                                        {/* Sticky Y-Axis */}
                                        <div className="sticky left-0 z-20 bg-white/95 backdrop-blur-md pr-2 border-r border-slate-100/50 shadow-[8px_0_12px_-6px_rgba(0,0,0,0.03)] flex-shrink-0 h-full" style={{ width: '80px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={data} margin={{ top: 20, right: 0, left: 5, bottom: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <YAxis 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 800 }} 
                                                        tickFormatter={(val) => formatValue(val, isCurrency)}
                                                        width={60}
                                                        domain={['auto', 'auto']}
                                                    />
                                                    {/* Transparent bar for scale */}
                                                    <Bar dataKey={category} fill="transparent" isAnimationActive={false} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Scrollable Chart Content */}
                                        <div style={{ minWidth: `${Math.max(800, data.length * minColWidth)}px` }} className="flex-1 h-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart 
                                                    data={data} 
                                                    barCategoryGap={barCategoryGap} 
                                                    margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                                                    onClick={(state: any) => {
                                                        handleChartClick(state);
                                                    }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" style={{ pointerEvents: 'none' }} />
                                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#cbd5e1', fontSize: 9, fontWeight: 700 }} style={{ pointerEvents: 'none' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={false} width={0} domain={['auto', 'auto']} style={{ pointerEvents: 'none' }} />
                                                    <ReTooltip 
                                                        active={pinnedPoint ? true : undefined}
                                                        position={pinnedPoint ? { x: pinnedPoint.x, y: pinnedPoint.y - 120 } : undefined}
                                                        wrapperStyle={{ 
                                                            pointerEvents: pinnedPoint ? 'auto' : 'none', 
                                                            zIndex: 1000 
                                                        }}
                                                        cursor={pinnedPoint ? false : { fill: '#f8fafc', radius: 12, pointerEvents: 'none' }}
                                                        content={(props: any) => {
                                                            const isPinned = !!pinnedPoint;
                                                            const displayPayload = isPinned ? pinnedPoint.payload : props.payload;
                                                            const displayLabel = isPinned ? pinnedPoint.label : props.label;
                                                            const isActive = isPinned || props.active;

                                                            if (!isActive || !displayPayload || displayPayload.length === 0) return null;

                                                            if (customTooltip) {
                                                                const React = require('react');
                                                                return (
                                                                    <div className="relative">
                                                                        {React.cloneElement(customTooltip, { active: true, payload: displayPayload, label: displayLabel })}
                                                                    </div>
                                                                );
                                                            }
                                                            const entry = displayPayload.find((p: any) => p.dataKey === category);
                                                            if (!entry) return null;
                                                            const catGrowth = entry.payload.categoryGrowth?.[category];
                                                            const color = category === 'Other' ? MIN_COLOR : getColor(i, categories.length);
                                                            return (
                                                                <div className="bg-white/95 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-slate-100 min-w-[280px] z-[100] relative">
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-50 pb-3">{displayLabel}</p>
                                                                    <div className="flex justify-between items-center gap-6">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                                                                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tighter">{category}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-xs font-black text-[#0C0C0C]">{formatValue(Number(entry.value), isCurrency)}</span>
                                                                            {catGrowth !== undefined && (
                                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${catGrowth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                                                                                    {catGrowth >= 0 ? '+' : ''}{catGrowth.toFixed(2)}%
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }}
                                                    />
                                                    <Bar 
                                                        dataKey={category} 
                                                        fill={category === 'Other' ? MIN_COLOR : getColor(i, categories.length)} 
                                                        radius={[4, 4, 0, 0]} 
                                                        isAnimationActive={true}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={(data, index, e) => {
                                                            if (e) e.stopPropagation();
                                                            handleChartClick(data);
                                                        }}
                                                    />
                                                    <Line 
                                                        type="monotone" 
                                                        dataKey={category} 
                                                        stroke="none" 
                                                        dot={false} 
                                                        isAnimationActive={false}
                                                        style={{ pointerEvents: 'none' }}
                                                    >
                                                        <LabelList dataKey="categoryGrowth" position="top" content={(props: any) => {
                                                            const { x, y, value, index } = props;
                                                            const catValue = value?.[category];
                                                            if (index === 0 || catValue === undefined || catValue === null || Math.abs(catValue) < 0.1) return null;
                                                            const isPos = catValue >= 0;
                                                            return (
                                                                <g>
                                                                    <rect x={x - 18} y={y - 25} width={36} height={16} rx={8} fill={isPos ? '#d1fae5' : '#fee2e2'} />
                                                                    <text x={x} y={y - 14} fill={isPos ? '#047857' : '#b91c1c'} textAnchor="middle" className="text-[8px] font-bold leading-none">{isPos ? '+' : ''}{catValue.toFixed(1)}%</text>
                                                                </g>
                                                            );
                                                        }}/>
                                                    </Line>
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
