'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';
import { API_BASE } from '@/lib/constants';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('auth_token', data.token);
                router.push('/access');
            } else {
                setError(data.message || 'Invalid credentials');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Background Decorations */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-50" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-50 rounded-full blur-[120px] opacity-50" />
            </div>

            <main className="relative z-10 w-full max-w-[420px]">
                <div className="bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-10 space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
                            <ShieldCheck className="w-8 h-8 text-[#0C0C0C]" />
                        </div>
                        <h1 className="text-3xl font-black text-[#0C0C0C] tracking-tighter uppercase">Admin Panel</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Secure Access Control</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-black transition-colors">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        placeholder="Enter your login"
                                        className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-black/5 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-black transition-colors">
                                        <Lock className="w-4 h-4" />
                                    </div>
                                    <input 
                                        type="password" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-black/5 transition-all outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-2xl border border-rose-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                <p className="text-[11px] font-bold text-rose-600 leading-tight">{error}</p>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full py-5 bg-[#0C0C0C] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-black/10 hover:bg-black hover:shadow-black/20 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:translate-y-0"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Authorize Access
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="text-center pt-4">
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Giftery Analytics Engine v2.0</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
