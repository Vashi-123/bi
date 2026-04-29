'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { API_BASE, SETTINGS_API_BASE, fetcher } from '@/lib/constants';
import { Card, Title, Flex, Badge, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell } from '@tremor/react';
import { ArrowLeft, Plus, Trash2, Send, ShieldCheck, UserCircle, Edit3, XCircle, Package, Zap, BellRing } from 'lucide-react';
import Link from 'next/link';

type SettingCategory = 'report_recipients';

export default function DailyReportPage() {
    const [activeCategory, setActiveCategory] = useState<SettingCategory>('report_recipients');
    
    const { data: settingsData, isLoading: settingsLoading } = useSWR(
        `${SETTINGS_API_BASE}/api/settings/report_recipients`, 
        fetcher
    );

    const [newItemId, setNewItemId] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);

    const currentSettings = settingsData || [];

    const handleSaveSingle = async () => {
        if (!newItemId || !newItemName) return;
        setIsSaving(true);
        try {
            const payload = { telegram_id: parseInt(newItemId), name: newItemName };
            
            const res = await fetch(`${SETTINGS_API_BASE}/api/settings/report_recipients`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-telegram-init-data': 'admin_mock' 
                },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                mutate(`${SETTINGS_API_BASE}/api/settings/report_recipients`);
                setNewItemId('');
                setNewItemName('');
                setEditingId(null);
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
            const res = await fetch(`${SETTINGS_API_BASE}/api/settings/report_recipients/${id}`, {
                method: 'DELETE',
                headers: { 'x-telegram-init-data': 'admin_mock' }
            });
            if (res.ok) {
                mutate(`${SETTINGS_API_BASE}/api/settings/report_recipients`);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const startEditing = (item: any) => {
        const id = (item.telegram_id || item.id).toString();
        setEditingId(id);
        setNewItemId(id);
        setNewItemName(item.name);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setNewItemId('');
        setNewItemName('');
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#0C0C0C] font-sans selection:bg-blue-100 p-8 md:p-12">
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#E8ECEF] via-[#F8FAFC] to-[#FDEBD0] opacity-100" />
            </div>

            <main className="relative z-10 max-w-6xl mx-auto space-y-10">
                {/* Header */}
                <Flex justifyContent="between" className="items-center">
                    <div className="space-y-1">
                        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-[#0C0C0C] transition-colors mb-4 group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-widest">Back to Dashboard</span>
                        </Link>
                        <h1 className="text-4xl font-black text-[#0C0C0C] tracking-tighter">Report Controls</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Manage Distribution List</p>
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
                            <Link href="/daily_report" className="flex items-center gap-2 px-4 py-2 bg-[#0C0C0C] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg group">
                                <Zap className="w-3.5 h-3.5 text-[#DDFF55]" />
                                Reports
                            </Link>
                        </div>
                    </div>
                </Flex>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Form */}
                    <Card className="lg:col-span-1 rounded-3xl border-slate-100 shadow-xl p-8 bg-white h-fit relative">
                        {editingId && (
                            <button onClick={cancelEditing} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-colors">
                                <XCircle className="w-5 h-5" />
                            </button>
                        )}
                        <Title className="text-xl font-bold mb-6 text-[#0C0C0C]">
                            {editingId ? 'Edit Entry' : 'Add Recipient'}
                        </Title>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                                <input 
                                    type="text" 
                                    value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                    placeholder="e.g. Usman G."
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-black/5"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telegram ID</label>
                                <input 
                                    type="text" 
                                    value={newItemId}
                                    disabled={!!editingId}
                                    onChange={e => setNewItemId(e.target.value)}
                                    placeholder="e.g. 198799905"
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-black/5 disabled:opacity-50"
                                />
                            </div>

                            <button 
                                onClick={handleSaveSingle}
                                disabled={isSaving || !newItemId || !newItemName}
                                className="w-full py-4 bg-[#0C0C0C] text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (editingId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                                {editingId ? 'Update Entry' : 'Add to Distribution'}
                            </button>
                        </div>
                    </Card>

                    {/* Entries List */}
                    <Card className="lg:col-span-2 rounded-3xl border-slate-100 shadow-xl p-8 bg-white overflow-hidden">
                        <Title className="text-xl font-bold mb-8 text-[#0C0C0C]">
                            Notification List
                        </Title>
                        <div className="max-h-[500px] overflow-y-auto pr-2">
                            <Table>
                                <TableHead className="bg-white sticky top-0 z-10 shadow-sm">
                                    <TableRow className="border-b border-slate-100">
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">User Details</TableHeaderCell>
                                        <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Action</TableHeaderCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {settingsLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={2} className="py-20 text-center text-slate-300 font-bold text-xs animate-pulse">Loading settings...</TableCell>
                                        </TableRow>
                                    ) : currentSettings.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={2} className="py-20 text-center text-slate-400 font-bold text-xs uppercase tracking-widest italic">No entries yet</TableCell>
                                        </TableRow>
                                    ) : currentSettings.map((item: any) => (
                                        <TableRow key={item.telegram_id || item.id} className="hover:bg-slate-50/30 transition-all border-b border-slate-100/50 group/row">
                                            <TableCell className="py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover/row:bg-black group-hover/row:text-white transition-all">
                                                        <UserCircle className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-[#0C0C0C]">{item.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono uppercase">ID: {item.telegram_id || item.id}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button 
                                                        onClick={() => startEditing(item)}
                                                        className="p-2.5 hover:bg-slate-100 text-slate-300 hover:text-slate-600 rounded-xl transition-all"
                                                        title="Edit"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteSetting(item.telegram_id || item.id)}
                                                        className="p-2.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-xl transition-all"
                                                        title="Remove"
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
