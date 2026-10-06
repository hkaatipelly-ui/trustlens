import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext.jsx';
import { resetDemo } from '../services/operations.js';
import { Button } from './ui.jsx';

export default function DemoResetButton() {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  if (user?.role !== 'admin') return null;
  async function reset() {
    setPending(true);
    try {
      await resetDemo();
      toast.success('Demo reset. History cleared and catalogs reseeded.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPending(false);
    }
  }
  return <Button onClick={reset} loading={pending} title="Clear action, outbox, and audit history and reseed the demo catalogs">{!pending && <RotateCcw size={13} />} {pending ? 'Resetting demo…' : 'Reset demo'}</Button>;
}
