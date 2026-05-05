'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { API_BASE, fetcher } from '@/lib/constants';
import { Card, Title, Flex, Badge, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell } from '@tremor/react';
import { ArrowLeft, Plus, Search, Trash2, CheckCircle, Users, Globe, UserIcon, Pencil, ShieldCheck, Package, Zap } from 'lucide-react';
import Link from 'next/link';

type GroupType = 'counterparties' | 'countries';

export default function GroupsPage() {
    const [activeType, setActiveType] = useState<GroupType>('counterparties');
    
    const { data: itemsData, isLoading: itemsLoading } = useSWR(
        `${API_BASE}/api/groups/${activeType}`, 
        fetcher
    );
    const { data: groupsData, isLoading: groupsLoading } = useSWR(
        `${API_BASE}/api/groups`, 
        fetcher
    );

    const [search, setSearch] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const allItems = (activeType === 'counterparties' ? itemsData?.counterparties : itemsData?.countries) || [];
    const allGroups = groupsData?.[activeType] || {};

    const filteredItems = useMemo(() => {
        if (!search) return allItems.slice(0, 5000);
        return allItems.filter((item: string) => 
            item.toLowerCase().includes(search.toLowerCase())
        ).slice(0, 5000);
    }, [allItems, search]);

    const handleToggleItem = (item: string) => {
        setSelectedItems(prev => prev.includes(item) ? prev.filter(v => v !== item) : [...prev, item]);
    };

    const handleSaveGroup = async () => {
        if (!newGroupName || selectedItems.length === 0) return;
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/groups?group_type=${activeType}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newGroupName, items: selectedItems })
            });
            if (res.ok) {
                mutate(`${API_BASE}/api/groups`);
                setNewGroupName('');
                setSelectedItems([]);
                setSearch('');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteGroup = async (name: string) => {
        if (!confirm(`Delete group "${name}"?`)) return;
        try {
            const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(name)}?group_type=${activeType}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                mutate(`${API_BASE}/api/groups`);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#0C0C0C] font-sans selection:bg-blue-100 p-8 md:p-12">
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#E8ECEF] via-[#F8FAFC] to-[#FDF1D6] opacity-100" />
            </div>

            <main className="relative z-10 max-w-6xl mx-auto space-y-10">
                {/* Header */}
                <Flex justifyContent="between" className="items-center">
                    <div className="space-y-1">
                        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-[#0C0C0C] transition-colors mb-4 group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-widest">Back to Dashboard</span>
                        </Link>
                        <h1 className="text-4xl font-black text-[#0C0C0C] tracking-tighter">Data Grouping</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Configure custom mappings for clients and regions</p>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex gap-2 bg-white/50 p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                            <Link href="/access" className="flex items-center gap-2 px-4 py-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group">
                                <ShieldCheck className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0C0C0C]" />
                                Access
                            </Link>
                            <Link href="/stock_settings" className="flex items-center gap-2 px-4 py-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group">
                                <Package className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0C0C0C]" />
                                Stock
                            </Link>
                            <Link href="/daily_report" className="flex items-center gap-2 px-4 py-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group">
                                <Zap className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0C0C0C]" />
                                Reports
                            </Link>
                            <Link href="/groups" className="flex items-center gap-2 px-4 py-2 bg-[#0C0C0C] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg group">
                                <Users className="w-3.5 h-3.5 text-[#DDFF55]" />
                                Groups
                            </Link>
                        </div>

                        {/* Tab Switcher */}
                        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex gap-1">
                            <button 
                                onClick={() => { setActiveType('counterparties'); setSelectedItems([]); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all
                                    ${activeType === 'counterparties' ? 'bg-[#0C0C0C] text-white shadow-lg' : 'text-slate-400 hover:text-[#0C0C0C]'}`}
                            >
                                <Users className="w-4 h-4" /> Clients
                            </button>
                            <button 
                                onClick={() => { setActiveType('countries'); setSelectedItems([]); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all
                                    ${activeType === 'countries' ? 'bg-[#0C0C0C] text-white shadow-lg' : 'text-slate-400 hover:text-[#0C0C0C]'}`}
                            >
                                <Globe className="w-4 h-4" /> Countries
                            </button>
                        </div>
                    </div>
                </Flex>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Form */}
                    <Card className="lg:col-span-1 rounded-3xl border-slate-100 shadow-xl p-8 bg-white h-fit">
                        <Title className="text-xl font-bold mb-6 text-[#0C0C0C]">
                            Create {activeType === 'counterparties' ? 'Client' : 'Country'} Group
                        </Title>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Group Name</label>
                                <input 
                                    type="text" 
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    placeholder={activeType === 'counterparties' ? "e.g. Major Retailers" : "e.g. Western Europe"}
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-black/5"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Select Items ({selectedItems.length})
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input 
                                        type="text" 
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Search..."
                                        className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold"
                                    />
                                </div>
                                <div className="max-h-64 overflow-y-auto space-y-1 p-1 bg-slate-50/50 rounded-xl border border-slate-100">
                                    {itemsLoading ? (
                                        <div className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase animate-pulse">Loading...</div>
                                    ) : filteredItems.map((item: string) => (
                                        <button 
                                            key={item}
                                            onClick={() => handleToggleItem(item)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-3 group
                                                ${selectedItems.includes(item) ? 'bg-orange-50 text-[#FF843B]' : 'hover:bg-white text-slate-500 hover:text-[#0C0C0C]'}`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedItems.includes(item) ? 'bg-[#FF843B] border-[#FF843B]' : 'border-slate-200 group-hover:border-orange-400'}`}>
                                                {selectedItems.includes(item) && <CheckCircle className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="truncate flex-1">{item}</span>
                                        </button>
                                    ))}
                                    {filteredItems.length === 0 && <div className="py-8 text-center text-[10px] font-bold text-slate-300">No matches found</div>}
                                </div>
                            </div>

                            <button 
                                onClick={handleSaveGroup}
                                disabled={isSaving || !newGroupName || selectedItems.length === 0}
                                className="w-full py-4 bg-[#0C0C0C] text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                                Save Group
                            </button>
                        </div>
                    </Card>

                    {/* Groups List */}
                    <Card className="lg:col-span-2 rounded-3xl border-slate-100 shadow-xl p-8 bg-white overflow-hidden">
                        <Title className="text-xl font-bold mb-8 text-[#0C0C0C]">
                            {activeType === 'counterparties' ? 'Client' : 'Country'} Mappings
                        </Title>
                        <div className="max-h-[450px] overflow-y-auto pr-2">
                            <Table>
                                <TableHead className="bg-white sticky top-0 z-10 shadow-sm">
                                    <TableRow className="border-b border-slate-100">
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Group Name</TableHeaderCell>
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Count</TableHeaderCell>
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Members</TableHeaderCell>
                                        <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Action</TableHeaderCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Object.entries(allGroups).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="py-20 text-center text-slate-400 font-bold text-xs uppercase tracking-widest italic">No groups defined yet</TableCell>
                                        </TableRow>
                                    ) : Object.entries(allGroups).map(([name, items]: [string, any]) => (
                                        <TableRow key={name} className="hover:bg-slate-50/30 transition-all border-b border-slate-100/50">
                                            <TableCell className="text-sm !text-[#0C0C0C] py-5 font-black">{name}</TableCell>
                                            <TableCell>
                                                <Badge className="bg-slate-100 text-slate-600 rounded-md px-2 py-0.5 text-[10px] font-bold">{items.length}</Badge>
                                            </TableCell>
                                            <TableCell className="max-w-md">
                                                <div className="flex flex-wrap gap-1">
                                                    {items.slice(0, 5).map((item: string) => (
                                                        <span key={item} className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[9px] font-bold text-slate-400 truncate max-w-[120px]">{item}</span>
                                                    ))}
                                                    {items.length > 5 && <span className="text-[9px] font-bold text-slate-300">+{items.length - 5} more</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button 
                                                        onClick={() => {
                                                            setNewGroupName(name);
                                                            setSelectedItems(items);
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                        className="p-2.5 hover:bg-indigo-50 text-slate-300 hover:text-indigo-500 rounded-xl transition-all"
                                                        title="Edit group"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteGroup(name)}
                                                        className="p-2.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-xl transition-all"
                                                        title="Delete group"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}
