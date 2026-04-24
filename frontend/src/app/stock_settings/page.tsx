'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { API_BASE, fetcher } from '@/lib/constants';
import { Card, Title, Flex, Badge, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell } from '@tremor/react';
import { ArrowLeft, Plus, Search, Trash2, CheckCircle, Package, ShieldCheck, BellRing, UserCircle } from 'lucide-react';
import Link from 'next/link';

type SettingCategory = 'monitored_skus' | 'authorized_users' | 'notification_recipients';

export default function StockSettingsPage() {
    const [activeCategory, setActiveCategory] = useState<SettingCategory>('monitored_skus');
    
    const { data: itemsData, isLoading: itemsLoading } = useSWR(
        `${API_BASE}/api/stock/items`, 
        fetcher
    );
    const { data: settingsData, isLoading: settingsLoading } = useSWR(
        `${API_BASE}/api/stock/settings`, 
        fetcher
    );

    const [search, setSearch] = useState('');
    const [newItemId, setNewItemId] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const allSourceItems = itemsData?.items || [];
    const currentSettings = settingsData?.[activeCategory] || [];

    const filteredSourceItems = useMemo(() => {
        if (!search) return allSourceItems.slice(0, 500);
        return allSourceItems.filter((item: string) => 
            item.toLowerCase().includes(search.toLowerCase())
        ).slice(0, 500);
    }, [allSourceItems, search]);

    const handleSaveSetting = async (id?: string, name?: string) => {
        const targetId = id || newItemId;
        const targetName = name || newItemName;

        if (!targetId || !targetName) return;
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/stock/settings?category=${activeCategory}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item: { id: targetId, name: targetName } })
            });
            if (res.ok) {
                mutate(`${API_BASE}/api/stock/settings`);
                setNewItemId('');
                setNewItemName('');
                setSearch('');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSetting = async (id: string) => {
        if (!confirm(`Remove entry?`)) return;
        try {
            const res = await fetch(`${API_BASE}/api/stock/settings/${encodeURIComponent(id)}?category=${activeCategory}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                mutate(`${API_BASE}/api/stock/settings`);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#0C0C0C] font-sans selection:bg-blue-100 p-8 md:p-12">
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#E8ECEF] via-[#F8FAFC] to-[#D6EAF8] opacity-100" />
            </div>

            <main className="relative z-10 max-w-6xl mx-auto space-y-10">
                {/* Header */}
                <Flex justifyContent="between" className="items-center">
                    <div className="space-y-1">
                        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-[#0C0C0C] transition-colors mb-4 group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-widest">Back to Dashboard</span>
                        </Link>
                        <h1 className="text-4xl font-black text-[#0C0C0C] tracking-tighter">Stock Controls</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Manage SKUs, Access, and Notifications</p>
                    </div>
                    
                    {/* Tab Switcher */}
                    <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex gap-1">
                        <button 
                            onClick={() => setActiveCategory('monitored_skus')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all
                                ${activeCategory === 'monitored_skus' ? 'bg-[#0C0C0C] text-white shadow-lg' : 'text-slate-400 hover:text-[#0C0C0C]'}`}
                        >
                            <Package className="w-4 h-4" /> SKUs
                        </button>
                        <button 
                            onClick={() => setActiveCategory('authorized_users')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all
                                ${activeCategory === 'authorized_users' ? 'bg-[#0C0C0C] text-white shadow-lg' : 'text-slate-400 hover:text-[#0C0C0C]'}`}
                        >
                            <ShieldCheck className="w-4 h-4" /> Access
                        </button>
                        <button 
                            onClick={() => setActiveCategory('notification_recipients')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all
                                ${activeCategory === 'notification_recipients' ? 'bg-[#0C0C0C] text-white shadow-lg' : 'text-slate-400 hover:text-[#0C0C0C]'}`}
                        >
                            <BellRing className="w-4 h-4" /> Notify
                        </button>
                    </div>
                </Flex>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Form */}
                    <Card className="lg:col-span-1 rounded-3xl border-slate-100 shadow-xl p-8 bg-white h-fit">
                        <Title className="text-xl font-bold mb-6 text-[#0C0C0C]">
                            Add {activeCategory === 'monitored_skus' ? 'SKU' : 'User'}
                        </Title>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {activeCategory === 'monitored_skus' ? 'Item ID' : 'Telegram ID'}
                                </label>
                                <input 
                                    type="text" 
                                    value={newItemId}
                                    onChange={e => setNewItemId(e.target.value)}
                                    placeholder={activeCategory === 'monitored_skus' ? "e.g. 6552" : "e.g. 198799905"}
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-black/5"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {activeCategory === 'monitored_skus' ? 'Display Name' : 'User Name'}
                                </label>
                                <input 
                                    type="text" 
                                    value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                    placeholder={activeCategory === 'monitored_skus' ? "e.g. PUBG 60 UC" : "e.g. Usman G."}
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-black/5"
                                />
                            </div>

                            {activeCategory === 'monitored_skus' && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Quick Select from Data
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                        <input 
                                            type="text" 
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            placeholder="Search items..."
                                            className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold"
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-1 p-1 bg-slate-50/50 rounded-xl border border-slate-100">
                                        {itemsLoading ? (
                                            <div className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase animate-pulse">Loading...</div>
                                        ) : filteredSourceItems.map((item: string) => (
                                            <button 
                                                key={item}
                                                onClick={() => { setNewItemId(item); setNewItemName(item); }}
                                                className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all text-slate-500 hover:bg-white hover:text-[#0C0C0C] truncate"
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={() => handleSaveSetting()}
                                disabled={isSaving || !newItemId || !newItemName}
                                className="w-full py-4 bg-[#0C0C0C] text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                                Add Entry
                            </button>
                        </div>
                    </Card>

                    {/* Entries List */}
                    <Card className="lg:col-span-2 rounded-3xl border-slate-100 shadow-xl p-8 bg-white overflow-hidden">
                        <Title className="text-xl font-bold mb-8 text-[#0C0C0C]">
                            Current {activeCategory.replace('_', ' ')}
                        </Title>
                        <div className="max-h-[450px] overflow-y-auto pr-2">
                            <Table>
                                <TableHead className="bg-white sticky top-0 z-10 shadow-sm">
                                    <TableRow className="border-b border-slate-100">
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">ID</TableHeaderCell>
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Name</TableHeaderCell>
                                        <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Action</TableHeaderCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {currentSettings.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="py-20 text-center text-slate-400 font-bold text-xs uppercase tracking-widest italic">No entries yet</TableCell>
                                        </TableRow>
                                    ) : currentSettings.map((item: any) => (
                                        <TableRow key={item.id} className="hover:bg-slate-50/30 transition-all border-b border-slate-100/50">
                                            <TableCell className="text-xs !text-slate-400 font-mono py-5">{item.id}</TableCell>
                                            <TableCell className="text-sm !text-[#0C0C0C] font-black">{item.name}</TableCell>
                                            <TableCell className="text-right">
                                                <button 
                                                    onClick={() => handleDeleteSetting(item.id)}
                                                    className="p-2.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-xl transition-all"
                                                    title="Remove entry"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
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
