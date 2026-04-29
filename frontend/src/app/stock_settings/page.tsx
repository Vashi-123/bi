'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { API_BASE, SETTINGS_API_BASE, fetcher } from '@/lib/constants';
import { Card, Title, Flex, Badge, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, TextInput } from '@tremor/react';
import { ArrowLeft, Plus, Search, Trash2, CheckCircle, Package, ShieldCheck, BellRing, UserCircle, Edit3, XCircle, Zap, ChevronDown, ChevronRight, Check } from 'lucide-react';
import Link from 'next/link';

type SettingCategory = 'monitored_skus' | 'notification_recipients';

interface SKU {
    sku_id: string;
    name: string;
    group?: string;
}

interface InventoryItem {
    sku_id: string;
    name: string;
    group?: string;
}

export default function StockSettingsPage() {
    const [activeCategory, setActiveCategory] = useState<SettingCategory>('monitored_skus');
    
    // Fetch currently monitored SKUs
    const { data: settingsData, isLoading: settingsLoading } = useSWR(
        `${SETTINGS_API_BASE}/api/settings/${activeCategory === 'monitored_skus' ? 'skus' : 'recipients'}`, 
        fetcher
    );

    // Fetch full inventory for catalog search
    const { data: inventoryData } = useSWR(
        activeCategory === 'monitored_skus' ? `${SETTINGS_API_BASE}/api/inventory` : null, 
        fetcher
    );

    const [newItemId, setNewItemId] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [newItemGroup, setNewItemGroup] = useState('General');
    const [catalogSearch, setCatalogSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    // Grouping State for SKUs
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [editingId, setEditingId] = useState<string | null>(null);

    const currentSettings = settingsData || [];
    const monitoredIds = useMemo(() => new Set((currentSettings as SKU[]).map(s => s.sku_id)), [currentSettings]);

    // Catalog Search Results
    const catalogResults = useMemo(() => {
        if (!inventoryData || !catalogSearch) return [];
        const query = catalogSearch.toLowerCase();
        return (inventoryData as InventoryItem[])
            .filter(item => 
                item.name.toLowerCase().includes(query) || 
                item.sku_id.toString().includes(query)
            )
            .slice(0, 10); // Limit results
    }, [inventoryData, catalogSearch]);

    // Grouping Logic for Monitored List
    const groupedSKUs = useMemo(() => {
        if (activeCategory !== 'monitored_skus') return null;
        const groups: Record<string, SKU[]> = {};
        (currentSettings as SKU[]).forEach(sku => {
            const groupName = sku.group || 'General';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(sku);
        });
        return groups;
    }, [currentSettings, activeCategory]);

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const handleSaveSingle = async (manualPayload?: any) => {
        setIsSaving(true);
        try {
            const payload = manualPayload || (activeCategory === 'monitored_skus' 
                ? { sku_id: newItemId, name: newItemName, group: newItemGroup }
                : { telegram_id: parseInt(newItemId), name: newItemName });
            
            const endpoint = activeCategory === 'monitored_skus' ? 'skus' : 'recipients';
            
            const res = await fetch(`${SETTINGS_API_BASE}/api/settings/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': 'admin_mock' },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                mutate(`${SETTINGS_API_BASE}/api/settings/${endpoint}`);
                if (!manualPayload) {
                    setNewItemId('');
                    setNewItemName('');
                    setNewItemGroup('General');
                    setEditingId(null);
                }
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
            const endpoint = activeCategory === 'monitored_skus' ? 'skus' : 'recipients';
            const res = await fetch(`${SETTINGS_API_BASE}/api/settings/${endpoint}/${id}`, {
                method: 'DELETE',
                headers: { 'x-telegram-init-data': 'admin_mock' }
            });
            if (res.ok) {
                mutate(`${SETTINGS_API_BASE}/api/settings/${endpoint}`);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const selectFromCatalog = (item: InventoryItem) => {
        setNewItemId(item.sku_id);
        setNewItemName(item.name);
        setNewItemGroup(item.group || 'General');
        setCatalogSearch('');
    };

    const startEditing = (item: any) => {
        const id = (item.sku_id || item.telegram_id || item.id).toString();
        setEditingId(id);
        setNewItemId(id);
        setNewItemName(item.name);
        if (item.group) setNewItemGroup(item.group);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setNewItemId('');
        setNewItemName('');
        setNewItemGroup('General');
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#0C0C0C] font-sans selection:bg-blue-100 p-8 md:p-12">
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#E1E7EC] via-[#F8FAFC] to-[#FFF9F5] opacity-100" />
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
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Configure Monitored Products</p>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex gap-2 bg-white/50 p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                            <Link href="/access" className="flex items-center gap-2 px-4 py-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group">
                                <ShieldCheck className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0C0C0C]" />
                                Access
                            </Link>
                            <Link href="/stock_settings" className="flex items-center gap-2 px-4 py-2 bg-[#0C0C0C] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg group">
                                <Package className="w-3.5 h-3.5 text-[#DDFF55]" />
                                Stock
                            </Link>
                            <Link href="/daily_report" className="flex items-center gap-2 px-4 py-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group">
                                <Zap className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0C0C0C]" />
                                Reports
                            </Link>
                        </div>
                        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex gap-1">
                            <button onClick={() => setActiveCategory('monitored_skus')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeCategory === 'monitored_skus' ? 'bg-[#0C0C0C] text-white shadow-lg' : 'text-slate-400 hover:text-black'}`}><Package className="w-4 h-4" /> SKUs</button>
                            <button onClick={() => setActiveCategory('notification_recipients')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeCategory === 'notification_recipients' ? 'bg-[#0C0C0C] text-white shadow-lg' : 'text-slate-400 hover:text-black'}`}><BellRing className="w-4 h-4" /> Notify</button>
                        </div>
                    </div>
                </Flex>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel: Catalog Search & Form */}
                    <div className="lg:col-span-1 space-y-8">
                        {activeCategory === 'monitored_skus' && (
                            <Card className="rounded-3xl border-slate-100 shadow-xl p-8 bg-white overflow-visible z-50">
                                <Title className="text-xl font-bold mb-6 text-[#0C0C0C]">Quick Search</Title>
                                <div className="relative">
                                    <TextInput 
                                        icon={Search} 
                                        placeholder="Search by SKU ID or Name..." 
                                        value={catalogSearch}
                                        onChange={e => setCatalogSearch(e.target.value)}
                                        className="rounded-xl border-none bg-slate-50 font-bold"
                                    />
                                    {catalogResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden z-[100]">
                                            {catalogResults.map(item => (
                                                <button 
                                                    key={item.sku_id}
                                                    onClick={() => selectFromCatalog(item)}
                                                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none"
                                                >
                                                    <div className="text-left">
                                                        <div className="text-sm font-black text-slate-900">{item.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">ID: {item.sku_id} // {item.group}</div>
                                                    </div>
                                                    {monitoredIds.has(item.sku_id) ? <Check className="w-4 h-4 text-emerald-500" /> : <Plus className="w-4 h-4 text-slate-300" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )}

                        <Card className="rounded-3xl border-slate-100 shadow-xl p-8 bg-white h-fit relative">
                            {editingId && <button onClick={cancelEditing} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-colors"><XCircle className="w-5 h-5" /></button>}
                            <Title className="text-xl font-bold mb-6 text-[#0C0C0C]">{editingId ? 'Edit' : 'Manual Entry'}</Title>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name / Label</label>
                                    <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-black/5" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeCategory === 'monitored_skus' ? 'SKU ID' : 'Telegram ID'}</label>
                                    <input type="text" value={newItemId} disabled={!!editingId} onChange={e => setNewItemId(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-black/5 disabled:opacity-50" />
                                </div>
                                {activeCategory === 'monitored_skus' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Group / Category</label>
                                        <input type="text" value={newItemGroup} onChange={e => setNewItemGroup(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-black/5" />
                                    </div>
                                )}
                                <button onClick={() => handleSaveSingle()} disabled={isSaving || !newItemId || !newItemName} className="w-full py-4 bg-[#0C0C0C] text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2">
                                    {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                                    {editingId ? 'Update' : 'Add to Monitoring'}
                                </button>
                            </div>
                        </Card>
                    </div>

                    {/* Right Panel: Active List */}
                    <Card className="lg:col-span-2 rounded-3xl border-slate-100 shadow-xl p-8 bg-white overflow-hidden">
                        <Title className="text-xl font-bold mb-8 text-[#0C0C0C]">{activeCategory === 'monitored_skus' ? 'Active Monitoring' : 'Notification List'}</Title>
                        <div className="max-h-[700px] overflow-y-auto pr-2 no-scrollbar">
                            {settingsLoading ? (
                                <div className="py-20 text-center animate-pulse text-slate-300 font-bold text-xs uppercase tracking-widest">Loading...</div>
                            ) : activeCategory === 'monitored_skus' ? (
                                Object.entries(groupedSKUs || {}).map(([group, skus]) => (
                                    <div key={group} className="mb-4 border border-slate-50 rounded-2xl overflow-hidden shadow-sm">
                                        <button onClick={() => toggleGroup(group)} className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Badge color="slate" size="xs" className="text-[9px] uppercase font-bold px-2.5 py-1 rounded-lg">{group}</Badge>
                                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{skus.length} items</span>
                                            </div>
                                            {expandedGroups[group] ? <ChevronDown className="w-4 h-4 text-slate-300" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
                                        </button>
                                        {!expandedGroups[group] && (
                                            <div className="p-2 space-y-1">
                                                {skus.map(sku => (
                                                    <div key={sku.sku_id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-all group/item">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover/item:bg-black group-hover/item:text-white transition-all">{sku.sku_id.slice(-2)}</div>
                                                            <div>
                                                                <div className="text-sm font-black text-[#0C0C0C]">{sku.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-mono uppercase">ID: {sku.sku_id}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                            <button onClick={() => startEditing(sku)} className="p-2 hover:bg-white text-slate-300 hover:text-black rounded-lg transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                                                            <button onClick={() => handleDeleteSetting(sku.sku_id)} className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <Table>
                                    <TableHead className="bg-white sticky top-0 z-10 shadow-sm"><TableRow className="border-b border-slate-100"><TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">User Details</TableHeaderCell><TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Action</TableHeaderCell></TableRow></TableHead>
                                    <TableBody>
                                        {currentSettings.map((item: any) => (
                                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-all border-b border-slate-100/50 group/row">
                                                <TableCell className="py-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover/row:bg-black group-hover/row:text-white transition-all"><UserCircle className="w-6 h-6" /></div><div><div className="text-sm font-black text-[#0C0C0C]">{item.name}</div><div className="text-[10px] text-slate-400 font-mono uppercase">ID: {item.telegram_id || item.id}</div></div></div></TableCell>
                                                <TableCell className="text-right"><div className="flex justify-end gap-1"><button onClick={() => startEditing(item)} className="p-2.5 hover:bg-slate-100 text-slate-300 hover:text-slate-600 rounded-xl transition-all"><Edit3 className="w-4 h-4" /></button><button onClick={() => handleDeleteSetting(item.id)} className="p-2.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button></div></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}
