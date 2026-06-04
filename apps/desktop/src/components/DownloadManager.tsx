// apps/desktop/src/components/DownloadManager.tsx
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export default function DownloadManager() {
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setError('');
    setProgress(0);
    try {
      const expectedHash = await invoke<string>('fetch_expected_hash');
      await invoke('download_model', { expectedHash });
    } catch (e) {
      setError(e as string);
    } finally {
      setDownloading(false);
    }
  }, []);

  useEffect(() => {
    let unlistenProgress: UnlistenFn | null = null;
    let unlistenComplete: UnlistenFn | null = null;

    const setupListeners = async () => {
      unlistenProgress = await listen('download_progress', (event) => {
        setProgress(event.payload as number);
      });
      unlistenComplete = await listen('download_complete', () => {
        setProgress(100);
        setDownloading(false);
      });
    };

    setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
    };
  }, []);

  return (
    <div>
      <button onClick={handleDownload} disabled={downloading}>
        {downloading ? 'Downloading...' : 'Download Model'}
      </button>
      {downloading && <progress value={progress} max={100} />}
      {error && <p>Error: {error}</p>}
    </div>
  );
}