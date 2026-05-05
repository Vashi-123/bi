'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { API_BASE, SETTINGS_API_BASE, fetcher } from '@/lib/constants';
import { Card, Title, Flex, Badge, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell } from '@tremor/react';
import { ArrowLeft, Plus, Trash2, UserCircle, Edit3, XCircle, ShieldCheck, Package, Zap, Users } from 'lucide-react';
import Link from 'next/link';

export default function AccessManagementPage() {
    const { data: admins, isLoading } = useSWR(`${SETTINGS_API_BASE}/api/settings/admins`, fetcher);

    const [newItemId, setNewItemId] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [stockAccess, setStockAccess] = useState('view');
    const [reportAccess, setReportAccess] = useState('none');
    const [isSaving, setIsSaving] = useState(false);
    
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleSave = async () => {
        if (!newItemId || !newItemName) return;
        setIsSaving(true);
        try {
            const payload = { 
                telegram_id: parseInt(newItemId), 
                name: newItemName,
                stock_access: stockAccess,
                report_access: reportAccess
            };
            
            const res = await fetch(`${SETTINGS_API_BASE}/api/settings/admins`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': 'admin_mock' },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                mutate(`${SETTINGS_API_BASE}/api/settings/admins`);
                setNewItemId('');
                setNewItemName('');
                setStockAccess('view');
                setReportAccess('none');
                setEditingId(null);
            }
        } catch (e) { console.error(e); } finally { setIsSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(`Revoke all access for this user?`)) return;
        try {
            const res = await fetch(`${SETTINGS_API_BASE}/api/settings/admins/${id}`, {
                method: 'DELETE',
                headers: { 'x-telegram-init-data': 'admin_mock' }
            });
            if (res.ok) mutate(`${SETTINGS_API_BASE}/api/settings/admins`);
        } catch (e) { console.error(e); }
    };

    const startEditing = (item: any) => {
        const id = (item.telegram_id || item.id).toString();
        setEditingId(id);
        setNewItemId(id);
        setNewItemName(item.name);
        setStockAccess(item.stock_access || 'none');
        setReportAccess(item.report_access || 'none');
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#0C0C0C] font-sans selection:bg-blue-100 p-8 md:p-12">
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#E1E7EC] via-[#F8FAFC] to-[#E8F8F5] opacity-100" />
            </div>

            <main className="relative z-10 max-w-6xl mx-auto space-y-10">
                {/* Header */}
                <Flex justifyContent="between" className="items-center">
                    <div className="space-y-1">
                        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-[#0C0C0C] transition-colors mb-4 group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-widest">Back to Dashboard</span>
                        </Link>
                        <h1 className="text-4xl font-black text-[#0C0C0C] tracking-tighter">Access Management</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Centralized User Permissions Control</p>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex gap-2 bg-white/50 p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                            <Link href="/access" className="flex items-center gap-2 px-4 py-2 bg-[#0C0C0C] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg group">
                                <ShieldCheck className="w-3.5 h-3.5 text-[#DDFF55]" />
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
                            <Link href="/groups" className="flex items-center gap-2 px-4 py-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group">
                                <Users className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0C0C0C]" />
                                Groups
                            </Link>
                        </div>
                    </div>
                </Flex>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Admin Form */}
                    <Card className="lg:col-span-1 rounded-3xl border-slate-100 shadow-xl p-8 bg-white h-[550px] relative flex flex-col">
                        {editingId && <button onClick={() => { setEditingId(null); setNewItemId(''); setNewItemName(''); }} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-colors z-10"><XCircle className="w-5 h-5" /></button>}
                        <Title className="text-xl font-bold mb-6 text-[#0C0C0C] shrink-0">{editingId ? 'Edit Permissions' : 'Authorize New Admin'}</Title>
                        
                        <div className="space-y-6 flex-1 overflow-y-auto pr-1 custom-scrollbar pb-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                                <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="e.g. Usman G." className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-black/5" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telegram ID</label>
                                <input type="text" value={newItemId} disabled={!!editingId} onChange={e => setNewItemId(e.target.value)} placeholder="e.g. 198799905" className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-black/5 disabled:opacity-50" />
                            </div>

                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Controls Access</label>
                                    <select value={stockAccess} onChange={e => setStockAccess(e.target.value)} className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-black/5">
                                        <option value="none">No Access</option>
                                        <option value="view">View Only</option>
                                        <option value="all">Full (Edit Statuses)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Reports Access</label>
                                    <select value={reportAccess} onChange={e => setReportAccess(e.target.value)} className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-black/5">
                                        <option value="none">No Access</option>
                                        <option value="view">View Only</option>
                                        <option value="all">Full (Manage Distribution)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-50 shrink-0">
                            <button onClick={handleSave} disabled={isSaving || !newItemId || !newItemName} className="w-full py-4 bg-[#0C0C0C] text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-black transition-all flex items-center justify-center gap-2">
                                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                {editingId ? 'Update Permissions' : 'Grant Admin Access'}
                            </button>
                        </div>
                    </Card>

                    {/* Admin List */}
                    <Card className="lg:col-span-2 rounded-3xl border-slate-100 shadow-xl p-8 bg-white flex flex-col h-[550px]">
                        <Title className="text-xl font-bold mb-8 text-[#0C0C0C] shrink-0">Authorized System Admins</Title>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <Table>
                                <TableHead className="bg-white sticky top-0 z-10 shadow-sm border-b border-slate-100">
                                    <TableRow>
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">User</TableHeaderCell>
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4 text-center">Stock</TableHeaderCell>
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4 text-center">Reports</TableHeaderCell>
                                        <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Action</TableHeaderCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={4} className="py-20 text-center animate-pulse text-slate-300 font-bold text-xs uppercase">Loading registry...</TableCell></TableRow>
                                    ) : (admins || []).map((admin: any) => (
                                        <TableRow key={admin.telegram_id || admin.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-50 group">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-black group-hover:text-white transition-all"><UserCircle className="w-6 h-6" /></div>
                                                    <div>
                                                        <p className="text-sm font-black text-[#0C0C0C]">{admin.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono">ID: {admin.telegram_id || admin.id}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge size="xs" color={admin.stock_access === 'all' ? 'emerald' : admin.stock_access === 'view' ? 'blue' : 'slate'} className="text-[9px] uppercase font-bold px-2 py-0.5">
                                                    {admin.stock_access || 'none'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge size="xs" color={admin.report_access === 'all' ? 'emerald' : admin.report_access === 'view' ? 'blue' : 'slate'} className="text-[9px] uppercase font-bold px-2 py-0.5">
                                                    {admin.report_access || 'none'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => startEditing(admin)} className="p-2 hover:bg-slate-100 text-slate-300 hover:text-slate-600 rounded-xl transition-all"><Edit3 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(admin.telegram_id || admin.id)} className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
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

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
}
