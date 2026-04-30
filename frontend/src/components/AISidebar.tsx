'use client';

import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Package, 
  Zap, 
  UserPlus, 
  ShoppingCart,
  LayoutGrid,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface AISidebarProps {
  data: any;
  loading: boolean;
  error: any;
}

const formatCompact = (val: number) => {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

export const AISidebar: React.FC<AISidebarProps> = ({ data, loading, error }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 p-8 text-slate-400">
        <div className="animate-spin">
          <Sparkles className="w-8 h-8 text-blue-500" />
        </div>
        <p className="text-xs font-black uppercase tracking-widest animate-pulse">Analyzing Market Trends...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-slate-600 uppercase">Analysis Engine Offline</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC]">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-600 rounded-xl shadow-blue-200 shadow-lg">
                <Zap className="w-5 h-5 text-white" />
             </div>
             <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none">Market Intelligence</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time driver analysis</p>
             </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {!data?.payload ? (
            <div className="text-center py-20 text-slate-600 font-bold uppercase text-xs">No analysis data</div>
          ) : (
            <div className="space-y-8">
                {(() => {
                  return (
                    <div className="space-y-8">
                        {/* SHELF 1: KEY CLIENTS */}
                        <div className="space-y-6">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-2.5 rounded-2xl bg-[#0C0C0C] text-white shadow-lg">
                              <UserPlus className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#0C0C0C]">Key Market Drivers</span>
                          </div>
                          
                          <div className="space-y-6">
                              {/* Gainers Section */}
                              {(data.payload?.drivers?.top_gainers?.length > 0 || data.payload?.drivers?.other_clients?.gainers) && (
                                 <div className="space-y-4">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 px-1">
                                       <TrendingUp className="w-4 h-4" /> Growth Engine
                                    </p>
                                    <div className="space-y-4">
                                       {data.payload.drivers.top_gainers?.map((c: any, idx: number) => (
                                          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                             <div className="flex justify-between items-start mb-4">
                                                <div className="flex flex-col gap-1">
                                                   <span className="text-[13px] font-black text-slate-900 uppercase leading-tight tracking-tight">{c.client}</span>
                                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">WAS: {formatCompact(c.rev_a)} → NOW: {formatCompact(c.rev_b)}</span>
                                                </div>
                                                <span className="text-base font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl">+{formatCompact(c.delta)}</span>
                                             </div>
                                             <div className="space-y-2.5 border-t border-slate-100 pt-4">
                                                {c.products?.map((p: any, pi: number) => (
                                                   <div key={pi} className={`flex justify-between items-center text-[11px] ${p.is_summary ? 'italic text-slate-400 mt-2' : 'text-slate-600'}`}>
                                                      <span className="font-bold truncate max-w-[240px]">{p.name}</span>
                                                      <span className={`font-black tracking-tighter ${p.is_summary ? 'text-slate-400' : 'text-slate-900'}`}>
                                                         {formatCompact(p.rev_a)} → {formatCompact(p.rev_b)}
                                                      </span>
                                                   </div>
                                                ))}
                                             </div>
                                          </div>
                                       ))}

                                       {/* Aggregate Other Gainers */}
                                       {data.payload.drivers.other_clients?.gainers && (
                                          <div className="bg-emerald-50/30 p-6 rounded-2xl border border-emerald-100 shadow-sm transition-all hover:shadow-md">
                                             <div className="flex justify-between items-start mb-4">
                                                <div className="flex flex-col gap-1">
                                                   <span className="text-[13px] font-black text-emerald-700 uppercase leading-tight tracking-tight">Other {data.payload.drivers.other_clients.gainers.count} Drivers</span>
                                                   <span className="text-[10px] font-black text-emerald-600/60 uppercase tracking-tighter">WAS: {formatCompact(data.payload.drivers.other_clients.gainers.rev_a)} → NOW: {formatCompact(data.payload.drivers.other_clients.gainers.rev_b)}</span>
                                                </div>
                                                <span className="text-base font-black text-emerald-600 bg-white px-3 py-1 rounded-xl shadow-sm">
                                                   +{formatCompact(data.payload.drivers.other_clients.gainers.delta)}
                                                </span>
                                             </div>
                                             <div className="space-y-2.5 border-t border-emerald-100/50 pt-4">
                                                {data.payload.drivers.other_clients.gainers.products?.map((p: any, pi: number) => (
                                                   <div key={pi} className={`flex justify-between items-center text-[11px] ${p.is_summary ? 'italic text-emerald-600/50 mt-2' : 'text-emerald-800/70'}`}>
                                                      <span className="font-bold truncate max-w-[240px]">{p.name}</span>
                                                      <span className={`font-black tracking-tighter ${p.is_summary ? 'text-emerald-600/40' : 'text-emerald-900'}`}>
                                                         {formatCompact(p.rev_a)} → {formatCompact(p.rev_b)}
                                                      </span>
                                                   </div>
                                                ))}
                                             </div>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              )}

                              {/* Decliners Section */}
                              {(data.payload?.drivers?.top_decliners?.length > 0 || data.payload?.drivers?.other_clients?.decliners) && (
                                 <div className="space-y-4">
                                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2 px-1">
                                       <TrendingDown className="w-4 h-4" /> Performance Declines
                                    </p>
                                    <div className="space-y-4">
                                       {data.payload.drivers.top_decliners?.map((c: any, idx: number) => (
                                          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                             <div className="flex justify-between items-start mb-4">
                                                <div className="flex flex-col gap-1">
                                                   <span className="text-[13px] font-black text-slate-900 uppercase leading-tight tracking-tight">{c.client}</span>
                                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">WAS: {formatCompact(c.rev_a)} → NOW: {formatCompact(c.rev_b)}</span>
                                                </div>
                                                <span className="text-base font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-xl">{formatCompact(c.delta)}</span>
                                             </div>
                                             <div className="space-y-2.5 border-t border-slate-100 pt-4">
                                                {c.products?.map((p: any, pi: number) => (
                                                   <div key={pi} className={`flex justify-between items-center text-[11px] ${p.is_summary ? 'italic text-slate-400 mt-2' : 'text-slate-600'}`}>
                                                      <span className="font-bold truncate max-w-[240px]">{p.name}</span>
                                                      <span className={`font-black tracking-tighter ${p.is_summary ? 'text-slate-400' : 'text-slate-900'}`}>
                                                         {formatCompact(p.rev_a)} → {formatCompact(p.rev_b)}
                                                      </span>
                                                   </div>
                                                ))}
                                             </div>
                                          </div>
                                       ))}

                                       {/* Aggregate Other Decliners */}
                                       {data.payload.drivers.other_clients?.decliners && (
                                          <div className="bg-rose-50/30 p-6 rounded-2xl border border-rose-100 shadow-sm transition-all hover:shadow-md">
                                             <div className="flex justify-between items-start mb-4">
                                                <div className="flex flex-col gap-1">
                                                   <span className="text-[13px] font-black text-rose-700 uppercase leading-tight tracking-tight">Other {data.payload.drivers.other_clients.decliners.count} Drivers</span>
                                                   <span className="text-[10px] font-black text-rose-600/60 uppercase tracking-tighter">WAS: {formatCompact(data.payload.drivers.other_clients.decliners.rev_a)} → NOW: {formatCompact(data.payload.drivers.other_clients.decliners.rev_b)}</span>
                                                </div>
                                                <span className="text-base font-black text-rose-600 bg-white px-3 py-1 rounded-xl shadow-sm">
                                                   {formatCompact(data.payload.drivers.other_clients.decliners.delta)}
                                                </span>
                                             </div>
                                             <div className="space-y-2.5 border-t border-rose-100/50 pt-4">
                                                {data.payload.drivers.other_clients.decliners.products?.map((p: any, pi: number) => (
                                                   <div key={pi} className={`flex justify-between items-center text-[11px] ${p.is_summary ? 'italic text-rose-600/50 mt-2' : 'text-rose-800/70'}`}>
                                                      <span className="font-bold truncate max-w-[240px]">{p.name}</span>
                                                      <span className={`font-black tracking-tighter ${p.is_summary ? 'text-rose-600/40' : 'text-rose-900'}`}>
                                                         {formatCompact(p.rev_a)} → {formatCompact(p.rev_b)}
                                                      </span>
                                                   </div>
                                                ))}
                                             </div>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              )}
                          </div>
                        </div>

                        {/* SHELF 2: PRODUCT HEALTH */}
                        <div className="space-y-6 pt-4">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-2.5 rounded-2xl bg-[#0C0C0C] text-white shadow-lg">
                              <Package className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#0C0C0C]">Market-Wide Trends</span>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                             {data.payload?.global_product_health?.top_gainers?.map((p: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                   <div className="flex flex-col gap-1">
                                      <span className="text-[12px] font-black text-slate-900 truncate max-w-[260px] uppercase tracking-tight">{p.product}</span>
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">WAS: {formatCompact(p.rev_a)}</span>
                                   </div>
                                   <div className="text-right">
                                      <span className="text-[13px] font-black text-emerald-600 block">{formatCompact(p.rev_b)}</span>
                                      <span className="text-[10px] font-black text-emerald-600/60 uppercase">+{((p.delta / (p.rev_a || 1)) * 100).toFixed(1)}%</span>
                                   </div>
                                </div>
                             ))}
                             {data.payload?.global_product_health?.top_decliners?.map((p: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                   <div className="flex flex-col gap-1">
                                      <span className="text-[12px] font-black text-slate-500 truncate max-w-[260px] uppercase tracking-tight">{p.product}</span>
                                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">WAS: {formatCompact(p.rev_a)}</span>
                                   </div>
                                   <div className="text-right">
                                      <span className="text-[13px] font-black text-rose-600 block">{formatCompact(p.rev_b)}</span>
                                      <span className="text-[10px] font-black text-rose-600/60 uppercase">{((p.delta / (p.rev_a || 1)) * 100).toFixed(1)}%</span>
                                   </div>
                                </div>
                             ))}
                          </div>
                        </div>

                        {/* SHELF 3: NEW BUSINESS */}
                        <div className="space-y-6 pt-4">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-lg">
                              <ShoppingCart className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">New Business</span>
                          </div>
                          
                          <div className="space-y-6">
                            {data.payload?.new_business?.new_clients?.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">First-Time Counterparties</p>
                                <div className="grid grid-cols-1 gap-3">
                                  {data.payload.new_business.new_clients.map((c: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                      <span className="text-[12px] font-black text-slate-900 uppercase tracking-tight">{c.name}</span>
                                      <span className="text-[12px] font-black text-emerald-600 tracking-tighter bg-emerald-50 px-2 py-1 rounded-lg">
                                        NEW → {formatCompact(c.rev_b)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {data.payload?.new_business?.new_products_sold?.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Newly Added Inventory</p>
                                <div className="grid grid-cols-1 gap-3">
                                  {data.payload.new_business.new_products_sold.map((p: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                      <span className="text-[12px] font-black text-slate-900 truncate max-w-[260px] uppercase tracking-tight">{p.name}</span>
                                      <span className="text-[12px] font-black text-blue-600 tracking-tighter bg-blue-50 px-2 py-1 rounded-lg">
                                        NEW → {formatCompact(p.rev_b)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* SHELF 4: CHURN */}
                        <div className="space-y-6 pt-4">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-2.5 rounded-2xl bg-rose-600 text-white shadow-lg">
                              <TrendingDown className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">Churn & Inactivity</span>
                          </div>
                          
                          <div className="space-y-6">
                            {data.payload?.churn?.churned_clients?.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lost Counterparties</p>
                                <div className="grid grid-cols-1 gap-3">
                                  {data.payload.churn.churned_clients.map((c: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                      <span className="text-[12px] font-black text-slate-900 uppercase tracking-tight">{c.name}</span>
                                      <span className="text-[12px] font-black text-rose-600 tracking-tighter bg-rose-50 px-2 py-1 rounded-lg">
                                        {formatCompact(c.rev_a)} → LOST
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {data.payload?.churn?.churned_products?.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Discontinued SKUs</p>
                                <div className="grid grid-cols-1 gap-3">
                                  {data.payload.churn.churned_products.map((p: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                      <span className="text-[12px] font-black text-slate-400 truncate max-w-[260px] uppercase tracking-tight">{p.name}</span>
                                      <span className="text-[12px] font-black text-rose-400 tracking-tighter border border-rose-100 px-2 py-1 rounded-lg">
                                        {formatCompact(p.rev_a)} → $0
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                  );
                })()}
            </div>
          )}
        </div>
    </div>
  );
};
