import React from 'react';
import { Flex, Badge } from '@tremor/react';
import { XCircle, Zap, Target, TrendingUp, TrendingDown, LayoutGrid, UserPlus, Package, Lightbulb } from 'lucide-react';

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
    <div className={`fixed inset-y-0 right-0 z-[1001] w-full md:w-[500px] bg-white border-l border-slate-200 shadow-[-20px_0_60px_rgba(0,0,0,0.05)] transform transition-transform duration-500 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-full flex flex-col p-12">
        <Flex justifyContent="between" className="mb-12">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-[#0C0C0C] rounded-[1.25rem] shadow-2xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-[#DDFF55]" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-[#0C0C0C] italic uppercase tracking-tighter leading-none">AI <span className="text-slate-300">Analyst</span></h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Business Intelligence v2.0</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-300 hover:text-rose-500 transition-all">
            <XCircle className="w-10 h-10" />
          </button>
        </Flex>

        <div className="flex-1 overflow-y-auto pr-2 space-y-10 scrollbar-hide">
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
              {/* Scenario Badge */}
              <div className="p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#DDFF55]/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-[#DDFF55]/10 transition-colors" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Zap className="w-3 h-3 text-[#DDFF55]" /> Market Scenario
                </p>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="text-2xl font-black italic uppercase tracking-tighter text-[#0C0C0C]">
                    {data.payload?.scenario?.replace('_', ' ')}
                  </div>
                  {data.payload?.analysis_metadata?.is_systemic_trend && (
                    <Badge className="bg-blue-50 text-blue-600 border-none text-[10px] font-black px-3 py-1 rounded-full">SYSTEMIC</Badge>
                  )}
                </div>
              </div>

              {/* AI Interpretation Blocks */}
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-[#0C0C0C] uppercase tracking-[0.2em] flex items-center gap-2">
                    <Target className="w-3 h-3" /> Intelligence Report
                  </p>
                  <div className="h-px flex-1 bg-slate-100 mx-6" />
                </div>
                
                <div className="space-y-6">
                  {(() => {
                    const text = data.ai_summary || "";
                    
                    const extract = (key: string) => {
                      const regex = new RegExp(`(?:📊|🏢|📦|🌱|\\*\\*|#|^)\\s*(?:\\d\\.\\s*)?${key}[^\\n]*\\n?([\\s\\S]*?)(?=(?:📊|🏢|📦|🌱|\\*\\*|#|^)\\s*(?:\\d\\.\\s*)?(?:Общая|Поведение|Глобальное|Новые|Суть|Drivers|Аномалии):?|$)`, 'im');
                      const match = text.match(regex);
                      if (!match) return null;
                      return match[1].replace(/[#*]/g, '').trim();
                    };

                    const sections = [
                      { id: 1, key: 'Общая', title: 'Trend Dynamics', icon: <Zap className="w-4 h-4 text-[#DDFF55]" />, color: 'bg-[#0C0C0C] border-[#1a1a1a] text-white' },
                      { id: 2, key: 'Поведение', title: 'Key Clients', icon: <UserPlus className="w-4 h-4 text-emerald-500" />, color: 'bg-white border-slate-100 text-slate-600 shadow-sm' },
                      { id: 3, key: 'Глобальное', title: 'Product Health', icon: <Package className="w-4 h-4 text-blue-500" />, color: 'bg-white border-slate-100 text-slate-600 shadow-sm' },
                      { id: 4, key: 'Новые', title: 'New Business', icon: <Target className="w-4 h-4 text-[#FF843B]" />, color: 'bg-white border-slate-100 text-slate-600 shadow-sm' }
                    ];

                    return sections.map((sec) => {
                      const content = extract(sec.key);
                      if (!content && sec.id !== 4) return null;

                      return (
                        <div key={sec.id} className={`p-8 rounded-[2rem] border ${sec.color} transition-all hover:shadow-lg duration-500 relative overflow-hidden group`}>
                          <div className="flex items-center gap-4 mb-6 opacity-90">
                            <div className={`p-2.5 rounded-xl ${sec.id === 1 ? 'bg-white/10' : 'bg-slate-50'} backdrop-blur-md border border-white/10`}>
                              {sec.icon}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{sec.title}</span>
                          </div>

                          <div className="space-y-4">
                            {sec.id === 4 ? (
                              <div className="space-y-6">
                                {data.payload?.new_business?.new_clients?.length > 0 && (
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">First-Time Clients</p>
                                    <div className="space-y-2">
                                      {data.payload.new_business.new_clients.map((c: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/30">
                                          <span className="text-[11px] font-bold text-slate-700">{c.name}</span>
                                          <span className="text-[11px] font-black text-emerald-600 tracking-tighter">
                                            $0 → {formatCompact(c.revenue)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {data.payload?.new_business?.new_products_sold?.length > 0 && (
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">New Products Sold</p>
                                    <div className="space-y-2">
                                      {data.payload.new_business.new_products_sold.map((p: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center bg-blue-50/50 p-3 rounded-xl border border-blue-100/30">
                                          <span className="text-[11px] font-bold text-slate-700 truncate max-w-[180px]">{p.name}</span>
                                          <span className="text-[11px] font-black text-blue-600 tracking-tighter">
                                            $0 → {formatCompact(p.revenue)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {(!data.payload?.new_business?.new_clients?.length && !data.payload?.new_business?.new_products_sold?.length) && (
                                  <p className="text-xs font-bold text-slate-400 italic">No new business sources detected in this period.</p>
                                )}
                              </div>
                            ) : (
                              <p className={`text-[13px] leading-relaxed whitespace-pre-line ${sec.id === 1 ? 'font-bold' : 'font-medium opacity-80'}`}>
                                {content}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Meta Stats Shelf */}
              <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner space-y-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                  <LayoutGrid className="w-3 h-3" /> Intensity Dashboard
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Growth Concentration</p>
                    <p className="text-2xl font-black text-[#0C0C0C] italic tracking-tighter">
                      {(data.payload?.analysis_metadata?.positive_concentration * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Systemic Trend</p>
                    <p className={`text-2xl font-black tracking-tighter ${data.payload?.analysis_metadata?.is_systemic_trend ? 'text-blue-600' : 'text-slate-400'}`}>
                      {data.payload?.analysis_metadata?.is_systemic_trend ? 'TRUE' : 'FALSE'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-slate-600 font-bold uppercase text-xs">No analysis data</div>
          )}
        </div>
      </div>
    </div>
  );
};
