'use client';

import { useDashboardStore } from '@/store/useDashboardStore';
import { Card, Title, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Badge, Flex } from '@tremor/react';
import { FilterIcon, UserIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip } from 'recharts';
import useSWR from 'swr';
import { useEffect, useState, useMemo } from 'react';

// --- Modular Imports ---
import { API_BASE, fetcher, getColor, METRIC_DB_MAP } from '@/lib/constants';
import { formatValue, formatTrend } from '@/lib/formatters';
import { KPICard } from '@/components/KPICard';
import { ChartSection } from '@/components/ChartSection';
import { FilterSidebar } from '@/components/FilterSidebar';
import { KPICardSkeleton, ChartSkeleton, DistributionSkeleton, TableSkeleton } from '@/components/Skeletons';

export default function Dashboard() {
  const { 
    activeMetric, setActiveMetric, 
    legendDimension, setLegendDimension, 
    topN, setTopN, 
    selectedGroup, setSelectedGroup,
    dateFilter, setDateFilter,
    filters
  } = useDashboardStore();

  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Initialize date filter with default 6-month window (max - 6 months to max)
  const { data: globalRange } = useSWR(`${API_BASE}/api/filters/date-range`, fetcher);
  useEffect(() => {
    if (globalRange?.max && !dateFilter.value?.start) {
      const maxDate = new Date(globalRange.max);
      const startDate = new Date(maxDate);
      startDate.setMonth(startDate.getMonth() - 6);
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = globalRange.max;
      setDateFilter({
        mode: 'between',
        value: { start: startStr, end: endStr },
        unit: 'day'
      });
    }
  }, [globalRange, dateFilter.value?.start, setDateFilter]);

  // --- URL Building ---
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([col, values]) => {
      if (values && values.length > 0) {
        params.append(col, JSON.stringify(values));
      }
    });

    params.append('dateMode', dateFilter.mode);
    if (dateFilter.mode === 'between' && dateFilter.value?.start && dateFilter.value?.end) {
      params.append('startDate', dateFilter.value.start);
      params.append('endDate', dateFilter.value.end);
    } else if (dateFilter.mode === 'relative' && dateFilter.value) {
      params.append('relativeValue', dateFilter.value.toString());
      params.append('relativeUnit', dateFilter.unit || 'day');
    } else if (dateFilter.mode === 'before' && dateFilter.value) {
      params.append('endDate', dateFilter.value);
    } else if (dateFilter.mode === 'after' && dateFilter.value) {
      params.append('startDate', dateFilter.value);
    }

    return params.toString();
  }, [filters, dateFilter]);

  const metricParam = encodeURIComponent(METRIC_DB_MAP[activeMetric] || 'Amount_USD');
  const kpiUrl = `${API_BASE}/api/kpi?${filterParams}`;
  const trendsUrl = (interval: string) => `${API_BASE}/api/trends?metric=${metricParam}&dimension=${legendDimension}&top_n=${topN}&interval=${interval}&${filterParams}`;
  // Single distribution fetch with top_n=100 — used for both rating (full) and donut (sliced)
  const fullDistUrl = `${API_BASE}/api/distribution?metric=${metricParam}&dimension=${legendDimension}&top_n=100&${filterParams}`;
  const masterUrl = `${API_BASE}/api/master?dimension=${legendDimension}&${filterParams}`;
  const detailUrl = `${API_BASE}/api/detail?dimension=${legendDimension}${selectedGroup ? `&selected_group=${encodeURIComponent(selectedGroup)}` : ''}&top_n=100&${filterParams}`;

  // --- Smart Comparison Detection ---
  const isFullRange = useMemo(() => {
    if (dateFilter.mode === 'all') return true;
    if (dateFilter.mode === 'between' && dateFilter.value?.start && dateFilter.value?.end) {
        const s = new Date(dateFilter.value.start);
        const e = new Date(dateFilter.value.end);
        const diffDays = (e.getTime() - s.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 170 && dateFilter.value.end === globalRange?.max;
    }
    return false;
  }, [dateFilter, globalRange]);

  // --- Data Fetching ---
  const { data: kpiData, isLoading: kpiLoading } = useSWR(kpiUrl, fetcher);
  const { data: weeklyRaw, isLoading: weeklyLoading } = useSWR(trendsUrl('week'), fetcher);
  const { data: monthlyRaw, isLoading: monthlyLoading } = useSWR(trendsUrl('month'), fetcher);
  const { data: dailyRaw, isLoading: dailyLoading } = useSWR(trendsUrl('day'), fetcher);
  const { data: fullDistData, isLoading: distLoading } = useSWR(fullDistUrl, fetcher);
  const { data: masterData, isLoading: masterLoading } = useSWR(masterUrl, fetcher);
  const { data: detailData, isLoading: detailLoading } = useSWR(detailUrl, fetcher);

  // Derive donut data (top N + Other) from full distribution
  const ratingData = fullDistData;
  const distData = useMemo(() => {
    if (!Array.isArray(fullDistData)) return [];
    const topItems = fullDistData.filter((d: any) => d.dimension_value !== 'Other').slice(0, topN);
    const otherItem = fullDistData.find((d: any) => d.dimension_value === 'Other');
    return otherItem ? [...topItems, otherItem] : topItems;
  }, [fullDistData, topN]);

  // --- Data Transforms ---
  const weeklyData = useMemo(() => formatTrend(weeklyRaw), [weeklyRaw]);
  const monthlyData = useMemo(() => formatTrend(monthlyRaw), [monthlyRaw]);
  const dailyData = useMemo(() => formatTrend(dailyRaw), [dailyRaw]);

  const sharedCategories = useMemo(() => {
      if (!distData || !Array.isArray(distData)) return [];
      const cats = distData.map((d: any) => d.dimension_value).filter((v: string) => v !== 'Other').slice(0, topN);
      return [...cats, 'Other'];
  }, [distData, topN]);

  const isCurrencyMetric = activeMetric !== 'qty' && activeMetric !== 'margin';

  return (
    <div className="min-h-screen text-[#0C0C0C] font-sans selection:bg-blue-100 selection:text-blue-900 bg-[#F8FAFC]">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E8ECEF] via-[#F8FAFC] to-[#FDF1D6] opacity-100" />
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#638994]/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#79783F]/5 blur-[150px] rounded-full" />
      </div>

      {/* Navigation */}
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
            {kpiLoading ? (
                <>{Array.from({length: 4}).map((_, i) => <KPICardSkeleton key={i} />)}</>
            ) : (
                <>
                    <KPICard title="Revenue Volume, USD" period={kpiData?.meta?.current_period} baselinePeriod={kpiData?.meta?.prev_period} value={kpiData?.revenue?.value} baseline={kpiData?.revenue?.prev} growth={kpiData?.revenue?.growth} active={activeMetric === 'revenue'} onClick={() => setActiveMetric('revenue')} hasComparison={isFullRange} />
                    <KPICard title="Gross Profit, USD" period={kpiData?.meta?.current_period} baselinePeriod={kpiData?.meta?.prev_period} value={kpiData?.profit?.value} baseline={kpiData?.profit?.prev} growth={kpiData?.profit?.growth} active={activeMetric === 'profit'} onClick={() => setActiveMetric('profit')} hasComparison={isFullRange} />
                    <KPICard title="Profit Margin, %" period={kpiData?.meta?.current_period} baselinePeriod={kpiData?.meta?.prev_period} value={kpiData?.margin?.value} baseline={kpiData?.margin?.prev} growth={kpiData?.margin?.growth} active={activeMetric === 'margin'} onClick={() => setActiveMetric('margin')} isPercent={true} isCurrency={false} hasComparison={isFullRange} />
                    <KPICard title="Qty of Items Sold" period={kpiData?.meta?.current_period} baselinePeriod={kpiData?.meta?.prev_period} value={kpiData?.qty?.value} baseline={kpiData?.qty?.prev} growth={kpiData?.qty?.growth} active={activeMetric === 'qty'} onClick={() => setActiveMetric('qty')} isCurrency={false} hasComparison={isFullRange} />
                </>
            )}
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

        {/* Trends */}
        <section className="space-y-12">
            <ChartSection title="Weekly Trend" label="Weekly Analysis" data={weeklyData} categories={sharedCategories} minColWidth={130} barCategoryGap="20%" isCurrency={isCurrencyMetric} />
            <ChartSection title="Monthly Trend" label="Monthly Overview" data={monthlyData} categories={sharedCategories} minColWidth={50} barCategoryGap="25%" isCurrency={isCurrencyMetric} />
            <ChartSection title="Daily Trend" label="Day-by-Day" data={dailyData} categories={sharedCategories} minColWidth={60} barCategoryGap="15%" isCurrency={isCurrencyMetric} />
        </section>

        {/* Distribution Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Market Share Rating */}
            <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[580px] flex flex-col">
                <div className="flex justify-between items-center mb-8 shrink-0">
                    <Title className="text-xl font-bold text-[#0C0C0C]">Market Share Rating</Title>
                    <Badge className="bg-slate-50 text-slate-600 rounded-md border-slate-100 px-3 py-1 font-bold text-[10px] uppercase tracking-wider">{legendDimension}</Badge>
                </div>
                <div className="flex-1 overflow-y-auto pr-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {Array.isArray(ratingData) && ratingData.filter((d: any) => d.dimension_value !== 'Other').map((d: any, i: number) => {
                        const maxValue = Math.max(...(ratingData.filter((x: any) => x.dimension_value !== 'Other').map((x: any) => x.value) || [1]));
                        const color = getColor(i, ratingData.length);
                        return (
                            <div key={d.dimension_value} className="space-y-2">
                                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                    <span className="truncate pr-4">{d.dimension_value}</span>
                                    <span className="text-[#0C0C0C] font-extrabold shrink-0">{formatValue(d.value)}</span>
                                </div>
                                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                                        style={{ width: `${(d.value / maxValue) * 100}%`, backgroundColor: color }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Portfolio Structure */}
            <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[580px] flex flex-col">
                <Title className="text-xl font-bold mb-8 text-[#0C0C0C] shrink-0">Portfolio Structure</Title>
                <div className="flex-1 flex flex-col md:flex-row items-center gap-8 min-h-0">
                    <div className="w-full md:w-1/2 flex justify-center">
                        <div className="h-72 w-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={Array.isArray(distData) ? distData : []} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" nameKey="dimension_value">
                                        {Array.isArray(distData) && distData.map((_: any, index: number) => (
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
                                    <div className="text-sm font-extrabold text-[#0C0C0C]">{((item.value / total) * 100).toFixed(2)}%</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>
        </div>

        {/* Details Tables */}
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
                                    className={`cursor-pointer transition-all border-b border-slate-100/50 border-l-4 ${selectedGroup === item.name ? 'bg-slate-50/50 border-l-slate-400' : 'hover:bg-slate-50/30 border-l-transparent'}`}
                                    onClick={() => setSelectedGroup(item.name === selectedGroup ? null : item.name)}
                                >
                                    <TableCell className="text-sm !text-[#0C0C0C] py-4">{item.name}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.revenue)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.profit)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{item.margin?.toFixed(2) ?? '0.00'}%</TableCell>
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
                                <TableRow key={item.name} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50">
                                    <TableCell className="text-sm !text-[#0C0C0C] py-4 max-w-[200px] truncate">{item.name}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.revenue)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.profit)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{item.margin?.toFixed(2) ?? '0.00'}%</TableCell>
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

        {/* Filter Sidebar */}
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
