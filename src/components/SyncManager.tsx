'use client';

import { useEffect } from 'react';
import { syncPendingData } from '@/lib/sync';

export default function SyncManager() {
  useEffect(() => {
    // Sync immediately on app load if online
    syncPendingData();

    const handleOnline = () => {
      console.log('Internet reconnected. Processing offline sync queue...');
      syncPendingData();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return null; // Runs silently in the background
}