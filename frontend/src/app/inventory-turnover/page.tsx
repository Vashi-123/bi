'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { 
  Card, Title, Text, Table, TableHead, TableRow, 
  TableHeaderCell, TableBody, TableCell, Badge, Flex,
  BarChart
} from '@tremor/react';
import { 
  Activity, Package, ArrowLeft, Download, RefreshCcw,
  PieChart as PieIcon, ChevronUp, ChevronDown, DollarSign
} from 'lucide-react';
import Link from 'next/link';
import { API_BASE, fetcher, getColor } from '../../lib/constants';

function formatCurrency(val: number) {
  if (val === 0) return '$0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Tailwind Safelist for Tremor dynamic colors:
// fill-brand1-500 bg-brand1-500 text-brand1-500 ring-brand1-500
// fill-brand2-500 bg-brand2-500 text-brand2-500 ring-brand2-500
// fill-brand3-500 bg-brand3-500 text-brand3-500 ring-brand3-500
// fill-brand4-500 bg-brand4-500 text-brand4-500 ring-brand4-500
// fill-brand5-500 bg-brand5-500 text-brand5-500 ring-brand5-500
// fill-brand6-500 bg-brand6-500 text-brand6-500 ring-brand6-500

const CustomTooltip = ({ payload, active }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  // In a multi-category chart, find the payload item that has a value
  const activePayload = payload.find((p: any) => p.value !== undefined && p.value !== null) || payload[0];
  const data = activePayload.payload;
  const bar_color = getColor(data.index, 1);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-2xl min-w-[200px]">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">
        {data.range} Days Turnover
      </p>
      <div className="space-y-3">
        <div>
          <Flex justifyContent="between">
            <Text className="text-[9px] font-bold text-slate-500 uppercase">Count</Text>
            <Text className="text-[10px] font-black text-[#0C0C0C]">{data.SKUs} SKUs</Text>
          </Flex>
          <div className="h-1 bg-slate-50 rounded-full mt-1 overflow-hidden">
            <div className="h-full rounded-full opacity-60" style={{ width: `${data['Share count']}%`, backgroundColor: bar_color }} />
          </div>
          <Text className="text-[9px] font-bold text-slate-400 mt-0.5">{data['Share count']}% share</Text>
        </div>

        <div>
          <Flex justifyContent="between">
            <Text className="text-[9px] font-bold text-slate-500 uppercase">Sales (Qty)</Text>
            <Text className="text-[10px] font-black text-emerald-600">{data.Sales.toLocaleString()}</Text>
          </Flex>
          <div className="h-1 bg-slate-50 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${data['Share sales']}%` }} />
          </div>
          <Text className="text-[9px] font-bold text-slate-400 mt-0.5">{data['Share sales']}% share</Text>
        </div>

        <div>
          <Flex justifyContent="between">
            <Text className="text-[9px] font-bold text-slate-500 uppercase">Stock Value</Text>
            <Text className="text-[10px] font-black text-blue-600">{formatCurrency(data.Stock)}</Text>
          </Flex>
          <div className="h-1 bg-slate-50 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${data['Share stock']}%` }} />
          </div>
          <Text className="text-[9px] font-bold text-slate-400 mt-0.5">{data['Share stock']}% share</Text>
        </div>
      </div>
    </div>
  );
};

interface TurnoverItem {
  item_id: string;
  item_name: string;
  product_name: string;
  group_key: string | null;
  is_group: boolean;
  avg_stock: number;
  current_stock: number;
  stock_value_usd: number;
  total_sales: number;
  turnover_ratio: number;
  turnover_days: number;
}

type SortCol = 'item_name' | 'avg_stock' | 'current_stock' | 'stock_value_usd' | 'total_sales' | 'turnover_ratio' | 'turnover_days' | 'target_15d';

export default function InventoryTurnoverPage() {
  const { data, isLoading, error, mutate } = useSWR<TurnoverItem[]>(
    `${API_BASE}/api/inventory/turnover`, 
    fetcher
  );

  const [sortCol, setSortCol] = useState<SortCol>('stock_value_usd');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const processedData = useMemo(() => {
    if (!data) return [];
    return data.map(item => ({
      ...item,
      target_15d: item.turnover_days >= 15 ? Math.round((item.total_sales / 30) * 15) : null
    }));
  }, [data]);

  const sortedData = useMemo(() => {
    return [...processedData].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      
      if (aVal === null || aVal === undefined) return sortDir === 'asc' ? -1 : 1;
      if (bVal === null || bVal === undefined) return sortDir === 'asc' ? 1 : -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [processedData, sortCol, sortDir]);

  const handleExport = () => {
    if (!data || data.length === 0) return;
    const headers = ['SKU ID', 'SKU Name', 'Product', 'Median Stock', 'Current Stock', 'Stock Value (USD)', 'Sales (30d)', 'Ratio', 'Days', 'Target Stock (15d)'];
    const rows = processedData.map(item => [
      item.item_id,
      `"${item.item_name.replace(/"/g, '""')}"`,
      `"${item.product_name.replace(/"/g, '""')}"`,
      item.avg_stock,
      item.current_stock,
      item.stock_value_usd,
      item.total_sales,
      item.turnover_ratio,
      item.turnover_days,
      item.target_15d ?? '-'
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_turnover_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const skuLeaderboard = useMemo(() => {
    if (!data) return [];
    return [...data]
      .sort((a, b) => b.stock_value_usd - a.stock_value_usd);
  }, [data]);

  const distributionData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const buckets = [
      { label: '0-1', min: 0, max: 1 },
      { label: '1-5', min: 1, max: 5 },
      { label: '5-15', min: 5, max: 15 },
      { label: '15-30', min: 15, max: 30 },
      { label: '30-60', min: 30, max: 60 },
      { label: '60+', min: 60, max: Infinity }
    ];

    const totalSKUs = data.length;
    const totalSales = data.reduce((sum, item) => sum + (item.total_sales || 0), 0) || 1;
    const totalStock = data.reduce((sum, item) => sum + (item.stock_value_usd || 0), 0) || 1;

    const result = buckets.map((b, idx) => {
      const filtered = data.filter(i => {
        if (b.min === 0) {
           return i.turnover_days >= 0 && i.turnover_days <= 1;
        }
        return i.turnover_days > b.min && i.turnover_days <= b.max;
      });
      
      const count = filtered.length;
      const sales = filtered.reduce((sum, item) => sum + (item.total_sales || 0), 0);
      const stockValue = filtered.reduce((sum, item) => sum + (item.stock_value_usd || 0), 0);
      
      return { 
        range: b.label, 
        [b.label]: count, // Use label as the key for multi-color bars
        'SKUs': count, 
        'Sales': sales,
        'Stock': stockValue,
        'Share count': parseFloat(((count / totalSKUs) * 100).toFixed(1)),
        'Share sales': parseFloat(((sales / totalSales) * 100).toFixed(1)),
        'Share stock': parseFloat(((stockValue / totalStock) * 100).toFixed(1)),
        'index': idx
      };
    });

    return result;
  }, [data]);

  if (error) return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <Card className="max-w-md p-8 text-center rounded-3xl">
        <Title className="text-rose-600 mb-2">Error Loading Data</Title>
        <Text>Failed to connect to the analytics engine.</Text>
        <button 
          onClick={() => mutate()}
          className="mt-6 px-6 py-2 bg-[#0C0C0C] text-white rounded-xl font-bold uppercase text-[10px] tracking-widest"
        >
          Retry
        </button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0C0C0C] font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#E8ECEF] via-[#F8FAFC] to-[#FDF1D6] opacity-100" />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#638994]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#79783F]/5 blur-[150px] rounded-full" />
      </div>

      <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex justify-between items-center shadow-sm">
        <Flex className="gap-6 w-auto" justifyContent="start">
          <Link href="/sales" className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-[#0C0C0C]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <Title className="text-xl font-black uppercase tracking-tighter italic">
            Inventory <span className="text-[#FF843B]">Turnover</span>
          </Title>
        </Flex>

        <Flex className="w-auto gap-4" justifyContent="end">
          <button 
            onClick={handleExport}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all text-slate-400 hover:text-[#0C0C0C]"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={() => mutate()}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all text-slate-400 hover:text-[#0C0C0C]"
            title="Refresh Data"
          >
            <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800">Usman Ganaev</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Administrator</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
              <Activity className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        </Flex>
      </nav>

      <main className="relative z-10 max-w-[1600px] mx-auto p-10 space-y-10 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[650px] flex flex-col overflow-hidden">
            <Flex className="mb-8 shrink-0" justifyContent="between" alignItems="center">
              <div>
                <Title className="text-xl font-bold text-[#0C0C0C]">SKU Value Leaderboard</Title>
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Top SKUs by Stock Value (USD)</Text>
              </div>
              <Badge className="rounded-md font-bold uppercase text-[9px] bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-500/20">Capital</Badge>
            </Flex>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
              {isLoading ? (
                Array.from({length: 6}).map((_, i) => (
                  <div key={i} className="space-y-2 animate-pulse">
                    <div className="flex justify-between h-4 bg-slate-50 rounded w-full" />
                    <div className="h-2 bg-slate-50 rounded-full" />
                  </div>
                ))
              ) : skuLeaderboard.map((item, idx) => {
                const maxValue = skuLeaderboard[0].stock_value_usd || 1;
                const percentage = ((item.stock_value_usd || 0) / maxValue) * 100;
                const color = getColor(idx, skuLeaderboard.length);

                return (
                  <div key={item.item_id} className="space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                      <Flex justifyContent="start" alignItems="center" className="gap-2 truncate pr-4">
                        <span className="truncate">{item.item_name}</span>
                        {item.is_group && (
                          <span className="px-1 py-0.5 rounded-md bg-amber-50 text-amber-600 ring-1 ring-amber-500/10 text-[7px] font-black shrink-0">
                            #{item.group_key?.replace('g_', '')}
                          </span>
                        )}
                      </Flex>
                      <span className="text-[#0C0C0C] font-extrabold shrink-0">{formatCurrency(item.stock_value_usd)}</span>
                    </div>
                    <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm" 
                        style={{ width: `${percentage}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[650px] flex flex-col overflow-hidden">
            <Flex className="mb-2 shrink-0" justifyContent="between" alignItems="start">
              <div>
                <Title className="text-xl font-bold text-[#0C0C0C]">Inventory Distribution</Title>
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">SKU Count & Share by Turnover Days</Text>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl">
                <PieIcon className="w-5 h-5 text-slate-400" />
              </div>
            </Flex>
            
            <div className="flex-1 min-h-0 w-full mt-4 flex flex-col overflow-hidden">
              <div className="flex-1 distribution-chart-container relative">
                <style>{`
                  .distribution-chart-container .recharts-bar:nth-child(1) path { fill: #8C3E4A !important; }
                  .distribution-chart-container .recharts-bar:nth-child(2) path { fill: #A18B7D !important; }
                  .distribution-chart-container .recharts-bar:nth-child(3) path { fill: #7B8147 !important; }
                  .distribution-chart-container .recharts-bar:nth-child(4) path { fill: #FA823A !important; }
                  .distribution-chart-container .recharts-bar:nth-child(5) path { fill: #658D9C !important; }
                  .distribution-chart-container .recharts-bar:nth-child(6) path { fill: #111111 !important; }
                `}</style>
                <BarChart
                  className="h-full"
                  data={distributionData}
                  index="range"
                  categories={['0-1', '1-5', '5-15', '15-30', '30-60', '60+']}
                  colors={['rose', 'cyan', 'orange', 'emerald', 'indigo', 'slate']}
                  valueFormatter={(number) => number?.toLocaleString() ?? '0'}
                  showAnimation={true}
                  yAxisWidth={48}
                  showLegend={false}
                  stack={true}
                  customTooltip={CustomTooltip}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 shrink-0">
                {distributionData.slice(0, 3).map((item, idx) => {
                  const color = getColor(idx, 6);
                  return (
                    <div key={item.range} className="p-3 rounded-2xl bg-slate-50 border border-slate-100/50 space-y-2">
                      <Flex justifyContent="between" alignItems="center" className="border-b border-slate-100 pb-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">{item.range} Days</p>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                      </Flex>
                      <div className="space-y-1">
                        <Flex justifyContent="between">
                          <p className="text-[7px] font-bold text-slate-400 uppercase">Count</p>
                          <p className="text-[9px] font-black text-[#0C0C0C]">{item['Share count']}%</p>
                        </Flex>
                        <Flex justifyContent="between">
                          <p className="text-[7px] font-bold text-slate-400 uppercase">Sales (Qty)</p>
                          <p className="text-[9px] font-black text-emerald-600">{item['Share sales']}%</p>
                        </Flex>
                        <Flex justifyContent="between">
                          <p className="text-[7px] font-bold text-slate-400 uppercase">Stock</p>
                          <p className="text-[9px] font-black text-blue-600">{item['Share stock']}%</p>
                        </Flex>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-0 bg-white flex flex-col h-[700px] overflow-hidden">
          <div className="p-6 pb-2 border-b border-slate-100 shrink-0">
            <Title className="text-xl font-bold text-[#0C0C0C]">Inventory Details</Title>
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Full SKU metrics and stock values</Text>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-hide relative">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-30 shadow-sm">
                <tr className="bg-white">
                  <th 
                    className="p-4 sticky top-0 z-30 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/95 backdrop-blur-sm border-b border-slate-100 cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('item_name')}
                  >
                    <Flex justifyContent="start" className="gap-1">
                      SKU Name {sortCol === 'item_name' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </th>
                  <th 
                    className="p-4 sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/95 backdrop-blur-sm border-b border-slate-100 cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('avg_stock')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Median Stock {sortCol === 'avg_stock' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </th>
                  <th 
                    className="p-4 sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/95 backdrop-blur-sm border-b border-slate-100 cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('current_stock')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Current Stock {sortCol === 'current_stock' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </th>
                  <th 
                    className="p-4 sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/95 backdrop-blur-sm border-b border-slate-100 cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('stock_value_usd')}
                  >
                    <Flex justifyContent="end" className="gap-1 text-blue-600">
                      Stock Value {sortCol === 'stock_value_usd' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </th>
                  <th 
                    className="p-4 sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/95 backdrop-blur-sm border-b border-slate-100 cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('target_15d')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Stock for 15D {sortCol === 'target_15d' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </th>
                  <th 
                    className="p-4 sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/95 backdrop-blur-sm border-b border-slate-100 cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('total_sales')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Sales (30d) {sortCol === 'total_sales' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </th>
                  <th 
                    className="p-4 sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/95 backdrop-blur-sm border-b border-slate-100 cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('turnover_ratio')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Ratio {sortCol === 'turnover_ratio' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </th>
                  <th 
                    className="p-4 sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/95 backdrop-blur-sm border-b border-slate-100 cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('turnover_days')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Days {sortCol === 'turnover_days' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {isLoading ? (
                  Array.from({length: 8}).map((_, i) => (
                    <tr key={i} className="animate-pulse border-b border-slate-50">
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-48" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-20 ml-auto" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-12 ml-auto" /></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-12 ml-auto" /></td>
                    </tr>
                  ))
                ) : sortedData?.map((item) => (
                  <tr key={item.item_id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/50">
                    <td className="p-4 text-xs font-bold text-[#0C0C0C] max-w-[300px]">
                      <Flex justifyContent="start" alignItems="center" className="gap-2">
                        <span className="truncate">{item.item_name}</span>
                        {item.is_group && (
                          <Badge size="xs" color="amber" className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter shrink-0 ring-1 ring-amber-500/20 bg-amber-50 text-amber-600">
                            Group {item.group_key?.replace('g_', '#')}
                          </Badge>
                        )}
                      </Flex>
                      <p className="text-[9px] text-slate-400 font-normal uppercase tracking-tight mt-0.5">{item.product_name}</p>
                    </td>
                    <td className="p-4 text-right text-xs font-bold text-slate-600">{item.avg_stock.toLocaleString()}</td>
                    <td className="p-4 text-right text-xs font-bold text-[#0C0C0C]">{item.current_stock.toLocaleString()}</td>
                    <td className="p-4 text-right text-xs font-black text-blue-600">
                      {formatCurrency(item.stock_value_usd)}
                    </td>
                    <td className="p-4 text-right text-xs font-bold text-slate-400">
                      {item.target_15d ? item.target_15d.toLocaleString() : '-'}
                    </td>
                    <td className="p-4 text-right text-xs font-bold text-[#0C0C0C]">{item.total_sales.toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <span className="inline-flex items-center bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 px-2.5 py-0.5 rounded-md font-bold text-[10px]">
                        {item.turnover_ratio.toFixed(2)}x
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`text-xs font-black ${item.turnover_days < 7 ? 'text-emerald-600' : item.turnover_days > 60 ? 'text-rose-600' : 'text-[#0C0C0C]'}`}>
                        {item.turnover_days === 999 ? '∞' : item.turnover_days}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
