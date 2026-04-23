'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { API_BASE, fetcher } from '@/lib/constants';
import { Card, Title, Flex, Badge, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell } from '@tremor/react';
import { ArrowLeft, Plus, Search, Trash2, CheckCircle, UserGroupIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';

export default function GroupsPage() {
    const { data: counterpartiesData, isLoading: cpLoading } = useSWR(`${API_BASE}/api/groups/counterparties`, fetcher);
    const { data: groupsData, isLoading: groupsLoading } = useSWR(`${API_BASE}/api/groups`, fetcher);

    const [search, setSearch] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedCPs, setSelectedCPs] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const counterparties = counterpartiesData?.counterparties || [];
    const groups = groupsData || {};

    const filteredCPs = useMemo(() => {
        if (!search) return counterparties.slice(0, 50);
        return counterparties.filter((cp: string) => 
            cp.toLowerCase().includes(search.toLowerCase())
        ).slice(0, 100);
    }, [counterparties, search]);

    const handleToggleCP = (cp: string) => {
        setSelectedCPs(prev => prev.includes(cp) ? prev.filter(v => v !== cp) : [...prev, cp]);
    };

    const handleSaveGroup = async () => {
        if (!newGroupName || selectedCPs.length === 0) return;
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newGroupName, counterparties: selectedCPs })
            });
            if (res.ok) {
                mutate(`${API_BASE}/api/groups`);
                setNewGroupName('');
                setSelectedCPs([]);
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
            const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(name)}`, {
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
                        <h1 className="text-4xl font-black text-[#0C0C0C] tracking-tighter">Client Grouping</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Configure custom counterparty mappings</p>
                    </div>
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Active Groups</p>
                            <p className="text-xl font-black">{Object.keys(groups).length}</p>
                        </div>
                        <div className="w-10 h-10 bg-[#0C0C0C] rounded-xl flex items-center justify-center text-white">
                            <UserGroupIcon className="w-5 h-5" />
                        </div>
                    </div>
                </Flex>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Form */}
                    <Card className="lg:col-span-1 rounded-3xl border-slate-100 shadow-xl p-8 bg-white h-fit">
                        <Title className="text-xl font-bold mb-6 text-[#0C0C0C]">Create New Group</Title>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Group Name</label>
                                <input 
                                    type="text" 
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    placeholder="e.g. Major Retailers"
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-black/5"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Counterparties ({selectedCPs.length})</label>
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
                                    {cpLoading ? (
                                        <div className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase animate-pulse">Loading...</div>
                                    ) : filteredCPs.map((cp: string) => (
                                        <button 
                                            key={cp}
                                            onClick={() => handleToggleCP(cp)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between group
                                                ${selectedCPs.includes(cp) ? 'bg-orange-50 text-[#FF843B]' : 'hover:bg-white text-slate-500 hover:text-[#0C0C0C]'}`}
                                        >
                                            <span className="truncate pr-2">{cp}</span>
                                            {selectedCPs.includes(cp) && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
                                        </button>
                                    ))}
                                    {filteredCPs.length === 0 && <div className="py-8 text-center text-[10px] font-bold text-slate-300">No matches found</div>}
                                </div>
                            </div>

                            <button 
                                onClick={handleSaveGroup}
                                disabled={isSaving || !newGroupName || selectedCPs.length === 0}
                                className="w-full py-4 bg-[#0C0C0C] text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                                Save Group
                            </button>
                        </div>
                    </Card>

                    {/* Groups List */}
                    <Card className="lg:col-span-2 rounded-3xl border-slate-100 shadow-xl p-8 bg-white overflow-hidden">
                        <Title className="text-xl font-bold mb-8 text-[#0C0C0C]">Existing Mappings</Title>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHead className="bg-slate-50/80 sticky top-0 z-10">
                                    <TableRow className="border-b border-slate-100">
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Group Name</TableHeaderCell>
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Count</TableHeaderCell>
                                        <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Counterparties</TableHeaderCell>
                                        <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Action</TableHeaderCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Object.entries(groups).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="py-20 text-center text-slate-400 font-bold text-xs uppercase tracking-widest italic">No groups defined yet</TableCell>
                                        </TableRow>
                                    ) : Object.entries(groups).map(([name, cps]: [string, any]) => (
                                        <TableRow key={name} className="hover:bg-slate-50/30 transition-all border-b border-slate-100/50">
                                            <TableCell className="text-sm !text-[#0C0C0C] py-5 font-black">{name}</TableCell>
                                            <TableCell>
                                                <Badge className="bg-slate-100 text-slate-600 rounded-md px-2 py-0.5 text-[10px] font-bold">{cps.length}</Badge>
                                            </TableCell>
                                            <TableCell className="max-w-md">
                                                <div className="flex flex-wrap gap-1">
                                                    {cps.slice(0, 3).map((cp: string) => (
                                                        <span key={cp} className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[9px] font-bold text-slate-400 truncate max-w-[120px]">{cp}</span>
                                                    ))}
                                                    {cps.length > 3 && <span className="text-[9px] font-bold text-slate-300">+{cps.length - 3} more</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <button 
                                                    onClick={() => handleDeleteGroup(name)}
                                                    className="p-2.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-xl transition-all"
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
