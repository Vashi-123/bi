'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/sales');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#DDFF55] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
