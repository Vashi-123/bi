'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        const expiry = localStorage.getItem('auth_expiry');
        
        // Check if token exists and hasn't expired
        if (token !== 'authenticated_session_token_2024' || !expiry || Date.now() > parseInt(expiry)) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_expiry');
            router.push('/login');
        } else {
            setIsAuthorized(true);
        }
    }, [router]);

    if (!isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="w-8 h-8 border-4 border-[#0C0C0C] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return <>{children}</>;
}
