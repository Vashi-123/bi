'use client';

import type { KPICardProps } from '@/lib/types';
import { formatValue } from '@/lib/formatters';

export function KPICard({ 
    title, period, baselinePeriod, value, baseline, growth, 
    active, onClick, isPercent = false, isCurrency = true, hasComparison = true 
}: KPICardProps) {
    const isPos = (growth ?? 0) >= 0;

    return (
        <div 
            onClick={onClick}
            className={`group relative p-8 rounded-2xl transition-all duration-300 cursor-pointer 
                       ${active ? 'bg-white shadow-2xl ring-2 ring-[#0C0C0C] scale-[1.02]' : 'bg-white shadow-md border border-slate-100 hover:shadow-lg'}`}
        >
            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-[#0C0C0C]' : 'text-slate-400'}`}>
                            {title}
                        </p>
                        {period && <p className="text-[9px] font-bold text-slate-400/80 italic">{period}</p>}
                    </div>
                    {active && <div className="w-2 h-2 bg-[#0C0C0C] rounded-full animate-pulse" />}
                </div>
                
                <h3 className="text-4xl font-extrabold tracking-tight text-[#0C0C0C] leading-none">
                    {value ? (isPercent ? `${value.toFixed(2)}%` : formatValue(value, isCurrency)) : '--'}
                </h3>

                {(hasComparison && baselinePeriod) && (
                    <div className="flex items-center gap-4 border-t border-slate-50 pt-5">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{baselinePeriod}</span>
                            <span className="text-xs font-bold text-slate-500">
                                {(baseline !== null && baseline !== undefined) ? (isPercent ? `${baseline.toFixed(2)}%` : formatValue(baseline, isCurrency)) : '--'}
                            </span>
                        </div>
                        <div className="flex-1" />
                        <div className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${isPos ? 'bg-emerald-100/80 text-emerald-700' : 'bg-rose-100/80 text-rose-700'}`}>
                            <span className="text-xs font-extrabold">{isPos ? '+' : ''}{(growth !== null && growth !== undefined) ? `${growth.toFixed(2)}%` : '0.00%'}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
