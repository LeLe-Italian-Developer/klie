// apps/desktop/src/components/LoginScreen.tsx
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const deviceId = await invoke<string>('get_device_id');
      await invoke('login', { email, password, deviceId });
      onLogin();
    } catch (e) {
      setError(e as string);
    } finally {
      setLoading(false);
    }
  }, [email, password, onLogin]);

  return (
    <div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
      <button onClick={handleLogin} disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
      {error && <p>{error}</p>}
    </div>
  );
}