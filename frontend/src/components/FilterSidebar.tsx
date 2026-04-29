'use client';

import { useState, useEffect } from 'react';
import { SearchIcon, XIcon, CheckCircle2Icon, CalendarIcon, ArrowRightIcon, ChevronRightIcon, CalendarDaysIcon } from 'lucide-react';
import useSWR from 'swr';
import { useDashboardStore } from '@/store/useDashboardStore';
import { API_BASE, fetcher } from '@/lib/constants';

// --- Filter Group (per-dimension) ---

function FilterGroup({ title, column, current = [], onChange, source = 'sales' }: { title: string, column: string, current: string[], onChange: (vals: string[]) => void, source?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => { const h = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(h); }, [search]);
    const { data, isValidating } = useSWR(isOpen ? `${API_BASE}/api/filters/options?column=${encodeURIComponent(column)}&search=${encodeURIComponent(debouncedSearch)}&source=${source}` : null, fetcher);
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
                    {options.length > 0 && (
                        <div className="flex justify-between items-center px-1">
                            <button onClick={() => onChange(options)} className="text-[10px] font-bold text-slate-400 hover:text-[#0C0C0C] uppercase tracking-wider transition-colors">Select All</button>
                            <button onClick={() => onChange([])} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-wider transition-colors">Clear</button>
                        </div>
                    )}
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

// --- Date Filter Group ---

function DateFilterGroup() {
    const { dateFilter, setDateFilter } = useDashboardStore();
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    
    const modes = [
        { id: 'between', label: 'Between', icon: CalendarIcon },
        { id: 'relative', label: 'Last X Days', icon: CalendarDaysIcon },
        { id: 'before', label: 'Before', icon: ChevronRightIcon },
        { id: 'after', label: 'After', icon: ArrowRightIcon },
    ];

    const currentMode = modes.find(m => m.id === dateFilter.mode) || modes[0];

    const setMode = (mode: any) => {
        let defaultValue = null;
        if (mode === 'relative') defaultValue = 30;
        if (mode === 'between') defaultValue = { start: '', end: '' };
        if (mode === 'before' || mode === 'after') defaultValue = '';
        setDateFilter({ mode, value: defaultValue });
        setIsSelectorOpen(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div 
                    onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                    className="flex items-center gap-2 cursor-pointer group"
                >
                    <div className="p-1.5 bg-slate-900 rounded-md group-hover:bg-[#0C0C0C] transition-colors">
                        <currentMode.icon className="w-3 h-3 text-white" />
                    </div>
                    <div>
                        <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Date Filter</h3>
                        <p className="text-[11px] font-extrabold text-[#0C0C0C] flex items-center gap-1.5">
                            {currentMode.label}
                            <ChevronRightIcon className={`w-3 h-3 transition-transform duration-300 ${isSelectorOpen ? 'rotate-90' : ''}`} />
                        </p>
                    </div>
                </div>
            </div>

            {isSelectorOpen && (
                <div className="grid grid-cols-1 gap-1 p-1 bg-slate-50 rounded-xl border border-slate-100">
                    {modes.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setMode(m.id)}
                            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[10px] font-bold transition-all
                                       ${dateFilter.mode === m.id 
                                         ? 'bg-white text-[#0C0C0C] shadow-sm' 
                                         : 'text-slate-500 hover:bg-white hover:text-[#0C0C0C]'}`}
                        >
                            <m.icon className={`w-3 h-3 ${dateFilter.mode === m.id ? 'text-[#0C0C0C]' : 'text-slate-400'}`} />
                            {m.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
                {dateFilter.mode === 'relative' && (
                    <div className="space-y-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Last Period</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={dateFilter.value || ''} 
                                onChange={e => setDateFilter({ ...dateFilter, value: parseInt(e.target.value) })}
                                className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-[#0C0C0C] outline-none"
                                placeholder="30"
                            />
                            <select 
                                value={dateFilter.unit || 'day'} 
                                onChange={e => setDateFilter({ ...dateFilter, unit: e.target.value })}
                                className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:ring-1 focus:ring-[#0C0C0C] outline-none appearance-none"
                            >
                                <option value="day">Days</option>
                                <option value="week">Weeks</option>
                                <option value="month">Months</option>
                            </select>
                        </div>
                    </div>
                )}

                {dateFilter.mode === 'between' && (
                    <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">From</label>
                            <input 
                                type="date" 
                                value={dateFilter.value?.start || ''} 
                                onChange={e => setDateFilter({ ...dateFilter, value: { ...dateFilter.value, start: e.target.value } })}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-[#0C0C0C] outline-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">To</label>
                            <input 
                                type="date" 
                                value={dateFilter.value?.end || ''} 
                                onChange={e => setDateFilter({ ...dateFilter, value: { ...dateFilter.value, end: e.target.value } })}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-[#0C0C0C] outline-none"
                            />
                        </div>
                    </div>
                )}

                {(dateFilter.mode === 'before' || dateFilter.mode === 'after') && (
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Date</label>
                        <input 
                            type="date" 
                            value={dateFilter.value || ''} 
                            onChange={e => setDateFilter({ ...dateFilter, value: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-[#0C0C0C] outline-none"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Main Sidebar ---

export function FilterSidebar({ isOpen, onClose, source = 'sales' }: { isOpen: boolean, onClose: () => void, source?: string }) {
    const { filters, setFilter, clearFilters } = useDashboardStore();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-y-0 right-0 z-[100] w-full max-w-md bg-white h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 border-l border-slate-100">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center text-[#0C0C0C]">
                <div className="space-y-1">
                    <h2 className="text-xl font-bold text-[#0C0C0C] tracking-tight">Parametrical Filter</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuration Panel</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-all text-slate-400 hover:text-slate-800"><XIcon className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide">
                <FilterGroup title="Category" column="Category" current={filters['Category']} onChange={vals => setFilter('Category', vals)} source={source} />
                <FilterGroup title="Product" column="Product name" current={filters['Product name']} onChange={vals => setFilter('Product name', vals)} source={source} />
                <FilterGroup title="SKU" column="Item name" current={filters['Item name']} onChange={vals => setFilter('Item name', vals)} source={source} />
                <FilterGroup title="Country" column="Product country" current={filters['Product country']} onChange={vals => setFilter('Product country', vals)} source={source} />
                <FilterGroup title={source === 'purchase' ? "Vendor" : "Client"} column="counterparty" current={filters['counterparty']} onChange={vals => setFilter('counterparty', vals)} source={source} />
                <FilterGroup title="Sales Type" column="type" current={filters['type']} onChange={vals => setFilter('type', vals)} source={source} />
                <div className="h-px bg-slate-50 mx-[-32px]" />
                <FilterGroup title="Client Group" column="Groupclient" current={filters['Groupclient']} onChange={vals => setFilter('Groupclient', vals)} source={source} />
                <FilterGroup title="Country Group" column="CountryGroup" current={filters['CountryGroup']} onChange={vals => setFilter('CountryGroup', vals)} source={source} />
                
                <div className="h-px bg-slate-50 mx-[-32px]" />
                <DateFilterGroup />
            </div>
            <div className="p-8 border-t border-slate-100 flex gap-4 bg-slate-50">
                <button onClick={clearFilters} className="flex-1 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">Clear All</button>
                <button onClick={onClose} className="flex-[2] py-3 bg-[#0C0C0C] text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-black/20 hover:bg-black transition-all">Apply Filters</button>
            </div>
        </div>
    );
}
