import { ClipboardList } from 'lucide-react';
import { Card } from '../components/Card';

export function ChatPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Chat</h1>
      <div className="mt-6">
        <Card title="Chat Page" icon={ClipboardList}>
          <p className="text-sm text-slate-600">This page is a placeholder for future chat UI design.</p>
        </Card>
      </div>
    </div>
  );
}
