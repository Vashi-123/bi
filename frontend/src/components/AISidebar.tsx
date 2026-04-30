import React from 'react';
import { Flex, Badge, Title } from '@tremor/react';
import { X, Zap, Target, TrendingUp, TrendingDown, LayoutGrid, UserPlus, Package, Lightbulb } from 'lucide-react';

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  data: any;
}

export const AISidebar: React.FC<AISidebarProps> = ({ isOpen, onClose, isLoading, data }) => {
  const formatCompact = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
    return `${sign}$${abs.toLocaleString()}`;
  };

  return (
    <div className={`fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-[150] transition-transform duration-500 ease-in-out border-l border-slate-200 flex flex-col rounded-l-3xl overflow-hidden ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        {/* Header */}
        <Flex className="p-8 border-b border-slate-100 bg-white shrink-0" justifyContent="between" alignItems="center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0C0C0C] rounded-2xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-[#DDFF55]" />
            </div>
            <div>
              <Title className="text-xl font-black text-[#0C0C0C] tracking-tight uppercase">Analytical Window</Title>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Data-Driven Market Intelligence</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400 hover:text-[#0C0C0C] border border-slate-100 shadow-sm">
            <X className="w-5 h-5" />
          </button>
        </Flex>
 
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide bg-slate-50/30">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 border-4 border-slate-100 border-t-[#0C0C0C] rounded-full animate-spin shadow-inner" />
              <div>
                <p className="text-xs font-black text-[#0C0C0C] uppercase tracking-[0.3em] animate-pulse mb-2">Analyzing Performance</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Crunching market data...</p>
              </div>
            </div>
          ) : data ? (
            <>
                <div className="space-y-8">
                  {(() => {
                    return (
                      <>
                        {/* SHELF 1: KEY CLIENTS */}
                        <div className="space-y-6">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-2.5 rounded-2xl bg-[#0C0C0C] text-white shadow-lg">
                              <UserPlus className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#0C0C0C]">Key Market Drivers</span>
                          </div>
                          
                          <div className="space-y-6">
                             {/* Gainers */}
                             {data.payload?.drivers?.top_gainers?.length > 0 && (
                                <div className="space-y-4">
                                   <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 px-1">
                                      <TrendingUp className="w-4 h-4" /> Growth Engine
                                   </p>
                                   <div className="space-y-4">
                                      {data.payload.drivers.top_gainers.map((c: any, idx: number) => (
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
                                   </div>
                                </div>
                             )}
                             {/* Decliners */}
                             {data.payload?.drivers?.top_decliners?.length > 0 && (
                                <div className="space-y-4">
                                   <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2 px-1">
                                      <TrendingDown className="w-4 h-4" /> Performance Declines
                                   </p>
                                   <div className="space-y-4">
                                      {data.payload.drivers.top_decliners.map((c: any, idx: number) => (
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
                                      {/* Other Gainers */}
                                      {data.payload.drivers.other_clients?.gainers && (
                                         <div className="bg-emerald-50/30 p-6 rounded-2xl border border-emerald-100 shadow-sm transition-all hover:shadow-md mt-4">
                                            <div className="flex justify-between items-start mb-4">
                                               <div className="flex flex-col gap-1">
                                                  <span className="text-[13px] font-black text-emerald-700 uppercase leading-tight tracking-tight">{data.payload.drivers.other_clients.gainers.client}</span>
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
                             {/* Decliners */}
                             {data.payload?.drivers?.top_decliners?.length > 0 && (
                                <div className="space-y-4">
                                   <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2 px-1">
                                      <TrendingDown className="w-4 h-4" /> Performance Declines
                                   </p>
                                   <div className="space-y-4">
                                      {data.payload.drivers.top_decliners.map((c: any, idx: number) => (
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
                                      {/* Other Decliners */}
                                      {data.payload.drivers.other_clients?.decliners && (
                                         <div className="bg-rose-50/30 p-6 rounded-2xl border border-rose-100 shadow-sm transition-all hover:shadow-md mt-4">
                                            <div className="flex justify-between items-start mb-4">
                                               <div className="flex flex-col gap-1">
                                                  <span className="text-[13px] font-black text-rose-700 uppercase leading-tight tracking-tight">{data.payload.drivers.other_clients.decliners.client}</span>
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
                            <div className="p-2.5 rounded-2xl bg-[#0C0C0C] text-white shadow-lg">
                              <Target className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#0C0C0C]">New Business Entries</span>
                          </div>
                          
                          <div className="space-y-6">
                            {data.payload?.new_business?.new_clients?.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">First-Time Partnerships</p>
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
                      </>
                    );
                  })()}
                </div>
            </>
          ) : (
            <div className="text-center py-20 text-slate-600 font-bold uppercase text-xs">No analysis data</div>
          )}
        </div>
    </div>
  );
};
