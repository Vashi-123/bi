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
  PieChart as PieIcon, ChevronUp, ChevronDown, Target
} from 'lucide-react';
import Link from 'next/link';
import { API_BASE, fetcher } from '@/lib/constants';

function formatCompact(val: number) {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

const CustomTooltip = ({ payload, active }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-xl">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{data.range} Days</p>
      <div className="space-y-1">
        <Flex className="gap-4">
          <Text className="text-xs font-bold text-slate-600">Count:</Text>
          <Text className="text-xs font-black text-[#0C0C0C]">{data.SKUs} SKUs</Text>
        </Flex>
        <Flex className="gap-4">
          <Text className="text-xs font-bold text-slate-600">Share:</Text>
          <Text className="text-xs font-black text-blue-600">{data['Share %']}%</Text>
        </Flex>
      </div>
    </div>
  );
};

interface TurnoverItem {
  item_id: string;
  item_name: string;
  product_name: string;
  avg_stock: number;
  current_stock: number;
  total_sales: number;
  turnover_ratio: number;
  turnover_days: number;
}

type SortCol = 'item_name' | 'avg_stock' | 'current_stock' | 'total_sales' | 'turnover_ratio' | 'turnover_days' | 'target_15d';

export default function InventoryTurnoverPage() {
  const { data, isLoading, error, mutate } = useSWR<TurnoverItem[]>(
    `${API_BASE}/api/inventory/turnover`, 
    fetcher
  );

  const [sortCol, setSortCol] = useState<SortCol>('total_sales');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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
    const headers = ['SKU ID', 'SKU Name', 'Product', 'Median Stock', 'Current Stock', 'Sales (30d)', 'Ratio', 'Days', 'Target Stock (15d)'];
    const rows = processedData.map(item => [
      item.item_id,
      `"${item.item_name.replace(/"/g, '""')}"`,
      `"${item.product_name.replace(/"/g, '""')}"`,
      item.avg_stock,
      item.current_stock,
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
      .sort((a, b) => b.turnover_ratio - a.turnover_ratio);
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

    const result = buckets.map(b => {
      const count = data.filter(i => {
        if (b.min === 0) {
           return i.turnover_days >= 0 && i.turnover_days <= 1;
        }
        return i.turnover_days > b.min && i.turnover_days <= b.max;
      }).length;
      
      const share = (count / totalSKUs) * 100;
      
      return { 
        range: b.label, 
        'SKUs': count, 
        'Share %': parseFloat(share.toFixed(1))
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
                <Title className="text-xl font-bold text-[#0C0C0C]">SKU Leaderboard</Title>
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Top SKUs by Turnover Ratio</Text>
              </div>
              <Badge className="rounded-md font-bold uppercase text-[9px] bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-500/20">Ratio</Badge>
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
                const maxRatio = skuLeaderboard[0].turnover_ratio;
                const percentage = (item.turnover_ratio / maxRatio) * 100;
                const colors = ['#8F3F48', '#638994', '#FF843B', '#79783F', '#A68B7A'];
                const color = colors[idx % colors.length];

                return (
                  <div key={item.item_id} className="space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                      <span className="truncate pr-4">{item.item_name}</span>
                      <span className="text-[#0C0C0C] font-extrabold shrink-0">{item.turnover_ratio.toFixed(2)}x</span>
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
              <div className="flex-1">
                <BarChart
                  className="h-full"
                  data={distributionData}
                  index="range"
                  categories={["SKUs"]}
                  colors={["blue"]}
                  valueFormatter={(number) => number.toLocaleString()}
                  showAnimation={true}
                  yAxisWidth={48}
                  showLegend={false}
                  customTooltip={CustomTooltip}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 shrink-0">
                {distributionData.slice(0, 3).map((item, idx) => (
                  <div key={item.range} className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100/50">
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">{item.range} Days</p>
                    <p className="text-sm font-black text-[#0C0C0C]">{item['Share %']}%</p>
                    <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5 truncate">{item.SKUs} SKUs</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-6 bg-white flex flex-col h-[700px] overflow-hidden">
          <div className="flex-1 overflow-auto scrollbar-hide relative">
            <Table>
              <TableHead className="sticky top-0 bg-white z-20">
                <TableRow className="border-b border-slate-100 bg-white">
                  <TableHeaderCell 
                    className="sticky top-0 z-30 text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4 bg-white cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('item_name')}
                  >
                    <Flex justifyContent="start" className="gap-1">
                      SKU Name {sortCol === 'item_name' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </TableHeaderCell>
                  <TableHeaderCell 
                    className="sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4 bg-white cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('avg_stock')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Median Stock {sortCol === 'avg_stock' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </TableHeaderCell>
                  <TableHeaderCell 
                    className="sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4 bg-white cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('current_stock')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Current Stock {sortCol === 'current_stock' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </TableHeaderCell>
                  <TableHeaderCell 
                    className="sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4 bg-white cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('target_15d')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Stock for 15D {sortCol === 'target_15d' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </TableHeaderCell>
                  <TableHeaderCell 
                    className="sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4 bg-white cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('total_sales')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Sales (30d) {sortCol === 'total_sales' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </TableHeaderCell>
                  <TableHeaderCell 
                    className="sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4 bg-white cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('turnover_ratio')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Ratio {sortCol === 'turnover_ratio' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </TableHeaderCell>
                  <TableHeaderCell 
                    className="sticky top-0 z-30 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4 bg-white cursor-pointer hover:text-[#0C0C0C] transition-colors"
                    onClick={() => handleSort('turnover_days')}
                  >
                    <Flex justifyContent="end" className="gap-1">
                      Days {sortCol === 'turnover_days' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </Flex>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({length: 8}).map((_, i) => (
                    <TableRow key={i} className="animate-pulse border-b border-slate-50">
                      <TableCell><div className="h-4 bg-slate-100 rounded w-48" /></TableCell>
                      <TableCell><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></TableCell>
                      <TableCell><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></TableCell>
                      <TableCell><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></TableCell>
                      <TableCell><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></TableCell>
                      <TableCell><div className="h-4 bg-slate-100 rounded w-12 ml-auto" /></TableCell>
                      <TableCell><div className="h-4 bg-slate-100 rounded w-12 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : sortedData?.map((item) => (
                  <TableRow key={item.item_id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/50">
                    <TableCell className="text-xs font-bold text-[#0C0C0C] py-4 max-w-[300px] truncate">
                      {item.item_name}
                      <p className="text-[9px] text-slate-400 font-normal uppercase tracking-tight mt-0.5">{item.product_name}</p>
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-slate-600">{item.avg_stock.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-blue-600">{item.current_stock.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-slate-400">
                      {item.target_15d ? item.target_15d.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-[#0C0C0C]">{item.total_sales.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 px-2.5 py-0.5 rounded-md font-bold text-[10px]">
                        {item.turnover_ratio.toFixed(2)}x
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-xs font-black ${item.turnover_days < 7 ? 'text-emerald-600' : item.turnover_days > 60 ? 'text-rose-600' : 'text-[#0C0C0C]'}`}>
                        {item.turnover_days === 999 ? '∞' : item.turnover_days}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>
    </div>
  );
}
