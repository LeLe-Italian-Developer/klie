// apps/desktop/src/components/ChatInterface.tsx
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export default function ChatInterface({ botId }: { botId: string }) {
  const [userInput, setUserInput] = useState('');
  const [output, setOutput] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let unlistenToken: UnlistenFn | null = null;
    let unlistenWarning: UnlistenFn | null = null;
    let unlistenDone: UnlistenFn | null = null;
    let unlistenError: UnlistenFn | null = null;

    const setupListeners = async () => {
      unlistenToken = await listen('inference_token', (event) => {
        setOutput(prev => prev + ' ' + (event.payload as string));
      });
      unlistenWarning = await listen('inference_warning', (event) => {
        setWarning(event.payload as string);
      });
      unlistenDone = await listen('inference_done', () => {
        setLoading(false);
      });
      unlistenError = await listen('inference_error', (event) => {
        setWarning(event.payload as string);
        setLoading(false);
      });
    };

    setupListeners();

    return () => {
      if (unlistenToken) unlistenToken();
      if (unlistenWarning) unlistenWarning();
      if (unlistenDone) unlistenDone();
      if (unlistenError) unlistenError();
    };
  }, []);

  const handleSend = useCallback(async () => {
    setLoading(true);
    setWarning('');
    try {
      const prompt = await invoke<string>('fetch_bot_prompt', { botId });
      const combined = `${prompt}\nUser: ${userInput}`;
      await invoke('run_inference', { prompt: combined });
    } catch (e) {
      setWarning(e as string);
      setLoading(false);
    }
  }, [botId, userInput]);

  return (
    <div>
      {warning && <p>Warning: {warning}</p>}
      <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} disabled={loading} />
      <button onClick={handleSend} disabled={loading}>{loading ? 'Processing...' : 'Send'}</button>
      <div>{output}</div>
    </div>
  );
}