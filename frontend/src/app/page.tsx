'use client';

import { useDashboardStore } from '@/store/useDashboardStore';
import { 
    Card, Title, Grid, Table, TableHead, TableRow, TableHeaderCell, 
    TableBody, TableCell, Badge, Flex
} from '@tremor/react';
import { 
    SearchIcon, FilterIcon, UserIcon, XIcon, CheckCircle2Icon
} from 'lucide-react';
import { 
    ComposedChart, Bar, Line, XAxis, YAxis, Tooltip as ReTooltip, 
    ResponsiveContainer, CartesianGrid, LabelList, PieChart, Pie, Cell
} from 'recharts';
import useSWR from 'swr';
import { useEffect, useRef, useState, useMemo } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Synchronized Color Palette Logic (Rank-based)
const RANK_COLORS = ["#8F3F48", "#638994", "#FF843B", "#79783F", "#A68B7A"];
const MIN_COLOR = "#0C0C0C";

const getColor = (index: number, total: number) => {
    if (total <= 1) return RANK_COLORS[0];
    if (index === total - 1) return MIN_COLOR; // Always black for the last item (Min/Other)
    if (index < RANK_COLORS.length) return RANK_COLORS[index];
    return RANK_COLORS[RANK_COLORS.length - 1]; // Fallback if list is long
};

const formatValue = (number: number, includeSymbol: boolean = true) => {
    const symbol = includeSymbol ? '$' : '';
    if (number === undefined || number === null) return `${symbol}0`;
    let valStr = '';
    if (Math.abs(number) >= 1000000) valStr = `${(number / 1000000).toFixed(1)}M`;
    else if (Math.abs(number) >= 1000) valStr = `${(number / 1000).toFixed(1)}K`;
    else valStr = Math.round(number).toLocaleString();
    return `${symbol}${valStr}`;
};

export default function Dashboard() {
  const { 
    activeMetric, setActiveMetric, 
    legendDimension, setLegendDimension, 
    topN, setTopN, 
    selectedGroup, setSelectedGroup,
    filters, setFilter, clearFilters 
  } = useDashboardStore();

  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const filterParams = useMemo(() => {
    return Object.entries(filters)
      .filter(([_, values]) => values && values.length > 0)
      .map(([col, values]) => `${encodeURIComponent(col)}=${encodeURIComponent(JSON.stringify(values))}`)
      .join('&');
  }, [filters]);

  const kpiUrl = `${API_BASE}/api/kpi?${filterParams ? `${filterParams}` : ''}`;
  const trendsUrl = (interval: string) => `${API_BASE}/api/trends?metric=${encodeURIComponent(activeMetric === 'revenue' ? 'Amount_USD' : activeMetric === 'margin' ? 'Margin_%' : activeMetric === 'qty' ? 'Qty' : 'Profit_USD')}&dimension=${legendDimension}&top_n=${topN}&interval=${interval}${filterParams ? `&${filterParams}` : ''}`;
  const distUrl = `${API_BASE}/api/distribution?metric=${encodeURIComponent(activeMetric === 'revenue' ? 'Amount_USD' : activeMetric === 'margin' ? 'Margin_%' : activeMetric === 'qty' ? 'Qty' : 'Profit_USD')}&dimension=${legendDimension}&top_n=${topN}${filterParams ? `&${filterParams}` : ''}`;
  const masterUrl = `${API_BASE}/api/master?dimension=${legendDimension}${filterParams ? `&${filterParams}` : ''}`;
  const detailUrl = `${API_BASE}/api/detail?dimension=${legendDimension}${selectedGroup ? `&selected_group=${encodeURIComponent(selectedGroup)}` : ''}&top_n=100${filterParams ? `&${filterParams}` : ''}`;

  const { data: kpiData } = useSWR(kpiUrl, fetcher);
  const { data: weeklyRaw } = useSWR(trendsUrl('week'), fetcher);
  const { data: monthlyRaw } = useSWR(trendsUrl('month'), fetcher);
  const { data: dailyRaw } = useSWR(trendsUrl('day'), fetcher);
  const { data: distData } = useSWR(distUrl, fetcher);
  const { data: masterData } = useSWR(masterUrl, fetcher);
  const { data: detailData } = useSWR(detailUrl, fetcher);

  const weeklyData = useMemo(() => formatTrend(weeklyRaw), [weeklyRaw]);
  const monthlyData = useMemo(() => formatTrend(monthlyRaw), [monthlyRaw]);
  const dailyData = useMemo(() => formatTrend(dailyRaw), [dailyRaw]);

  const sharedCategories = useMemo(() => {
      if (!distData || !Array.isArray(distData)) return [];
      const cats = distData.map((d: any) => d.dimension_value).filter(v => v !== 'Other').slice(0, topN);
      return [...cats, 'Other'];
  }, [distData, topN]);

  return (
    <div className="min-h-screen text-[#0C0C0C] font-sans selection:bg-blue-100 selection:text-blue-900 bg-[#F8FAFC]">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E8ECEF] via-[#F8FAFC] to-[#FDF1D6] opacity-100" />
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#638994]/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#79783F]/5 blur-[150px] rounded-full" />
      </div>

      <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex justify-between items-center shadow-sm">
        <Flex className="gap-6 w-auto" justifyContent="start">
          <div className="bg-[#0C0C0C] p-2 rounded-xl shadow-lg shadow-black/20 cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#0C0C0C] leading-none mb-1">Giftery Analytics</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance Intelligence</p>
          </div>
        </Flex>

        <Flex className="w-auto gap-4" justifyContent="end">
          <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all relative group text-[13px] font-bold">
            <FilterIcon className="w-4 h-4 text-[#FF843B]" /> Filters
            {Object.values(filters).some(v => v?.length > 0) && <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#FF843B] rounded-full border-2 border-white" />}
          </button>
          <div className="h-10 w-[1px] bg-slate-100 mx-2" />
          <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-800">Usman Ganaev</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Administrator</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200"><UserIcon className="w-5 h-5 text-slate-400" /></div>
          </div>
        </Flex>
      </nav>

      <main className="relative z-10 max-w-[1600px] mx-auto p-10 space-y-12 pb-24">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard title="Revenue Volume, USD" period={kpiData?.meta?.current_period} baselinePeriod={kpiData?.meta?.prev_period} value={kpiData?.revenue?.value} baseline={kpiData?.revenue?.prev} growth={kpiData?.revenue?.growth} active={activeMetric === 'revenue'} onClick={() => setActiveMetric('revenue')} />
            <KPICard title="Profitability, USD" period={kpiData?.meta?.current_period} baselinePeriod={kpiData?.meta?.prev_period} value={kpiData?.profit?.value} baseline={kpiData?.profit?.prev} growth={kpiData?.profit?.growth} active={activeMetric === 'profit'} onClick={() => setActiveMetric('profit')} />
            <KPICard title="Margin Performance" period={kpiData?.meta?.current_period} baselinePeriod={kpiData?.meta?.prev_period} value={kpiData?.margin?.value} baseline={kpiData?.margin?.prev} growth={kpiData?.margin?.growth} active={activeMetric === 'margin'} onClick={() => setActiveMetric('margin')} isPercent={true} />
            <KPICard title="Quantity Sold" period={kpiData?.meta?.current_period} baselinePeriod={kpiData?.meta?.prev_period} value={kpiData?.qty?.value} baseline={kpiData?.qty?.prev} growth={kpiData?.qty?.growth} active={activeMetric === 'qty'} onClick={() => setActiveMetric('qty')} isCurrency={false} />
        </div>

        {/* Global Controls */}
        <Flex className="gap-6 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/20">
            <div className="flex items-center gap-3 ml-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Show Top:</span>
                <select className="bg-transparent border-none text-sm font-bold text-[#0C0C0C] focus:ring-0 cursor-pointer" value={topN} onChange={e => setTopN(parseInt(e.target.value))}>
                    {[3,5].map(v => <option key={v} value={v}>Top {v}</option>)}
                </select>
            </div>
            <div className="w-px h-5 bg-slate-100" />
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dimension:</span>
                <select className="bg-transparent border-none text-sm font-bold text-[#0C0C0C] focus:ring-0 cursor-pointer" value={legendDimension} onChange={e => setLegendDimension(e.target.value as any)}>
                    <option value="Category">Category</option>
                    <option value="Product name">Product</option>
                    <option value="Item name">SKU</option>
                    <option value="Product country">Country</option>
                    <option value="counterparty">Counterparty</option>
                    <option value="type">Sales Type</option>
                </select>
            </div>
        </Flex>

        {/* Trends Vertical Stack */}
        <section className="space-y-12">
            <ChartSection title="Weekly Trend" label="Weekly Analysis" data={weeklyData} categories={sharedCategories} minColWidth={130} barCategoryGap="20%" isCurrency={activeMetric !== 'qty' && activeMetric !== 'margin'} />
            <ChartSection title="Monthly Trend" label="Monthly Overview" data={monthlyData} categories={sharedCategories} minColWidth={50} barCategoryGap="25%" isCurrency={activeMetric !== 'qty' && activeMetric !== 'margin'} />
            <ChartSection title="Daily Trend" label="Day-by-Day" data={dailyData} categories={sharedCategories} minColWidth={60} barCategoryGap="15%" isCurrency={activeMetric !== 'qty' && activeMetric !== 'margin'} />
        </section>

        {/* Distribution Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white">
                <div className="flex justify-between items-center mb-8">
                    <Title className="text-xl font-bold text-[#0C0C0C]">Market Share Rating</Title>
                    <Badge className="bg-slate-50 text-slate-600 rounded-md border-slate-100 px-3 py-1 font-bold text-[10px] uppercase tracking-wider">{legendDimension}</Badge>
                </div>
                <div className="h-[400px] overflow-y-auto pr-4 space-y-6 scrollbar-hide">
                    {Array.isArray(distData) && distData.map((d: any, i: number) => {
                        const maxValue = Math.max(...(distData.map((x: any) => x.value) || [1]));
                        const color = getColor(i, distData.length);
                        return (
                            <div key={d.dimension_value} className="space-y-2">
                                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                    <span>{d.dimension_value}</span>
                                    <span className="text-[#0C0C0C] font-extrabold">{formatValue(d.value)}</span>
                                </div>
                                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                                        style={{ 
                                            width: `${(d.value / maxValue) * 100}%`,
                                            backgroundColor: color
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white">
                <Title className="text-xl font-bold mb-8 text-[#0C0C0C]">Portfolio Structure</Title>
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="w-full md:w-1/2 flex justify-center">
                        <div className="h-72 w-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={Array.isArray(distData) ? distData : []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        nameKey="dimension_value"
                                    >
                                        {Array.isArray(distData) && distData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={getColor(index, distData.length)} />
                                        ))}
                                    </Pie>
                                    <ReTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="w-full md:w-1/2 space-y-3">
                        {Array.isArray(distData) && distData.map((item: any, i: number) => {
                            const total = distData.reduce((acc: number, curr: any) => acc + curr.value, 0) || 1;
                            const color = getColor(i, distData.length);
                            return (
                                <div key={item.dimension_value} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3.5 h-3.5 rounded-full shadow-md border-2 border-white" style={{ backgroundColor: color }} />
                                        <span className="text-[11px] font-bold text-slate-400 group-hover:text-[#0C0C0C] uppercase tracking-tight transition-colors">{item.dimension_value}</span>
                                    </div>
                                    <div className="text-sm font-extrabold text-[#0C0C0C]">{((item.value / total) * 100).toFixed(1)}%</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>
        </div>

        {/* Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white overflow-hidden">
                <div className="max-h-[450px] overflow-y-auto pr-2 scrollbar-hide">
                    <Table>
                        <TableHead className="bg-slate-50/80">
                            <TableRow className="border-b border-slate-100">
                                <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Group Name</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Revenue</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Profit</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Margin</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Qty</TableHeaderCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Array.isArray(masterData) && masterData.map((item: any) => (
                                <TableRow 
                                    key={item.name} 
                                    className={`cursor-pointer transition-all border-transparent border-l-4 ${selectedGroup === item.name ? 'bg-slate-50/50 border-l-[#0C0C0C]' : 'hover:bg-slate-50/30 border-l-transparent'}`}
                                    onClick={() => setSelectedGroup(item.name === selectedGroup ? null : item.name)}
                                >
                                    <TableCell className="text-sm !text-[#0C0C0C] py-4">{item.name}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.revenue)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.profit)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{item.margin.toFixed(1)}%</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{Math.round(item.qty).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white overflow-hidden">
                <div className="max-h-[450px] overflow-y-auto pr-2 scrollbar-hide">
                    <Table>
                        <TableHead className="bg-slate-50/80">
                            <TableRow className="border-b border-slate-100">
                                <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">SKU Name</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Revenue</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Profit</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Margin</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Qty</TableHeaderCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Array.isArray(detailData) && detailData.map((item: any) => (
                                <TableRow key={item.name} className="hover:bg-slate-50/30 transition-colors">
                                    <TableCell className="text-sm !text-[#0C0C0C] py-4 max-w-[200px] truncate">{item.name}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.revenue)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.profit)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{item.margin?.toFixed(1)}%</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{Math.round(item.qty).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                            {(!detailData || detailData.length === 0) && (
                                <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 italic font-bold">Select a group to see SKU details</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>

        {isSidebarOpen && (
            <div className="fixed inset-0 z-[100] flex justify-end">
                <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)} />
                <FilterSidebar onClose={() => setSidebarOpen(false)} />
            </div>
        )}
      </main>
    </div>
  );
}

// --- SUBCOMPONENTS ---

function KPICard({ title, period, baselinePeriod, value, baseline, growth, active, onClick, isPercent = false, isCurrency = true }: any) {
  const isPos = growth >= 0;
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
                {value ? (isPercent ? `${value.toFixed(1)}%` : formatValue(value, isCurrency)) : '--'}
            </h3>

            <div className="flex items-center gap-4 border-t border-slate-50 pt-5">
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{baselinePeriod}</span>
                    <span className="text-xs font-bold text-slate-500">{baseline ? (isPercent ? `${baseline.toFixed(1)}%` : formatValue(baseline, isCurrency)) : '--'}</span>
                </div>
                <div className="flex-1" />
                <div className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${isPos ? 'bg-emerald-100/80 text-emerald-700' : 'bg-rose-100/80 text-rose-700'}`}>
                    <span className="text-xs font-extrabold">{isPos ? '+' : ''}{growth ? `${growth.toFixed(1)}%` : '0%'}</span>
                </div>
            </div>
        </div>
    </div>
  );
}

function ChartSection({ title, label, data, categories, minColWidth = 60, barCategoryGap = "10%", isCurrency = true }: any) {
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
                {Array.isArray(categories) && categories.map((cat: any, i: number) => (
                    <div key={cat} className="flex items-center gap-2 group cursor-default">
                        <div className="w-3 h-3 rounded-sm shadow-sm border border-white" style={{ backgroundColor: getColor(i, categories.length) }} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-[#0C0C0C] transition-colors">{cat}</span>
                    </div>
                ))}
            </div>
        </Flex>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/30 p-10 border border-slate-50 relative overflow-hidden group transition-all">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#0C0C0C] opacity-0 group-hover:opacity-100 transition-opacity" />
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
                                                                            {catGrowth >= 0 ? '+' : ''}{catGrowth.toFixed(1)}%
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center border border-slate-100">
                                                    <div className="flex items-center gap-3"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">TOTAL</p><p className="text-xl font-bold text-[#0C0C0C]">{formatValue(total, isCurrency)}</p></div>
                                                    <div className={`px-3 py-1 rounded-md text-[11px] font-bold ${growth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
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
                                        const { x, y, width, value, index } = props;
                                        if (index === 0 || value === undefined || value === null || Math.abs(value) < 0.1) return null;
                                        const isPos = value >= 0;
                                        // Offset Y slightly more because Line points are right at the top
                                        return (
                                            <g>
                                                <rect x={x - 22} y={y - 30} width={44} height={20} rx={10} fill={isPos ? '#d1fae5' : '#fee2e2'} />
                                                <text x={x} y={y - 16} fill={isPos ? '#047857' : '#b91c1c'} textAnchor="middle" className="text-[9px] font-bold leading-none">{isPos ? '+' : ''}{value.toFixed(1)}%</text>
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

function FilterSidebar({ onClose }: { onClose: () => void }) {
    const { filters, setFilter, clearFilters } = useDashboardStore();
    return (
        <div className="relative w-full max-w-md bg-white h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 border-l border-slate-100">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center text-[#0C0C0C]">
                <div className="space-y-1">
                    <h2 className="text-xl font-bold text-[#0C0C0C] tracking-tight">Parametrical Filter</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuration Panel</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-all text-slate-400 hover:text-slate-800"><XIcon className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide">
                <FilterGroup title="Category" column="Category" current={filters['Category']} onChange={vals => setFilter('Category', vals)} />
                <FilterGroup title="Product" column="Product name" current={filters['Product name']} onChange={vals => setFilter('Product name', vals)} />
                <FilterGroup title="SKU" column="Item name" current={filters['Item name']} onChange={vals => setFilter('Item name', vals)} />
                <FilterGroup title="Country" column="Product country" current={filters['Product country']} onChange={vals => setFilter('Product country', vals)} />
                <FilterGroup title="Counterparty" column="counterparty" current={filters['counterparty']} onChange={vals => setFilter('counterparty', vals)} />
                <FilterGroup title="Sales Type" column="type" current={filters['type']} onChange={vals => setFilter('type', vals)} />
            </div>
            <div className="p-8 border-t border-slate-100 flex gap-4 bg-slate-50">
                <button onClick={clearFilters} className="flex-1 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">Clear All</button>
                <button onClick={onClose} className="flex-[2] py-3 bg-[#0C0C0C] text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-black/20 hover:bg-black transition-all">Apply Filters</button>
            </div>
        </div>
    );
}

function FilterGroup({ title, column, current = [], onChange }: { title: string, column: string, current: string[], onChange: (vals: string[]) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => { const h = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(h); }, [search]);
    const { data, isValidating } = useSWR(isOpen ? `${API_BASE}/api/filters/options?column=${encodeURIComponent(column)}&search=${encodeURIComponent(debouncedSearch)}` : null, fetcher);
    const options = data?.options || [];
    const toggle = (val: string) => onChange(current.includes(val) ? current.filter(v => v !== val) : [...current, val]);

    return (
        <div className="space-y-4">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center group py-1 border-b border-transparent hover:border-slate-100 transition-all">
                <span className="text-xs font-bold text-slate-400 group-hover:text-slate-800 transition-colors uppercase tracking-widest">{title}</span>
                <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${current.length > 0 ? 'bg-[#FF843B] text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>{current.length}</div>
            </button>
            {isOpen && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="relative group">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-hover:text-[#FF843B] transition-colors" />
                        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-slate-50 border-none rounded-lg pl-9 pr-3 py-2.5 text-xs font-bold placeholder:text-slate-300 focus:ring-1 focus:ring-[#FF843B]/20 transition-all" />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1 pr-2 scrollbar-hide text-[#0C0C0C]">
                        {isValidating && options.length === 0 && <div className="py-8 flex justify-center"><div className="w-4 h-4 border-2 border-[#FF843B] border-t-transparent rounded-full animate-spin" /></div>}
                        {Array.isArray(options) && options.map((opt: string) => (
                            <button key={opt} onClick={() => toggle(opt)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all group ${current.includes(opt) ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${current.includes(opt) ? 'bg-[#FF843B] border-[#FF843B]' : 'border-slate-200 group-hover:border-orange-400'}`}>
                                    {current.includes(opt) && <CheckCircle2Icon className="w-3 h-3 text-white" />}
                                </div>
                                <span className={`text-[11px] font-bold truncate ${current.includes(opt) ? 'text-orange-900 font-bold' : 'text-slate-500 group-hover:text-slate-800'}`}>{opt}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function formatTrend(data: any[]) {
    if (!Array.isArray(data)) return [];
    const grouped = data.reduce((acc: any[], curr: any) => {
        const existing = acc.find((item: any) => item.time === curr.time_label);
        if (existing) { existing[curr.dimension_value] = curr.value; existing.total += curr.value; }
        else { acc.push({ time: curr.time_label, [curr.dimension_value]: curr.value, total: curr.value }); }
        return acc;
    }, []);
    return grouped.map((item: any, index: number, array: any[]) => {
        if (index === 0) return { ...item, growth: 0, categoryGrowth: {} };
        const prev = array[index - 1];
        const categoryGrowth: any = {};
        Object.keys(item).forEach(k => { if (k !== 'time' && k !== 'total') { categoryGrowth[k] = prev[k] > 0 ? ((item[k] - prev[k]) / prev[k]) * 100 : 0; } });
        return { ...item, growth: prev.total > 0 ? ((item.total - prev.total) / prev.total) * 100 : 0, categoryGrowth };
    });
}
