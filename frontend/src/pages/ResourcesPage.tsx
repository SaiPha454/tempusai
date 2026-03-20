import { ClipboardList } from 'lucide-react';
import { Card } from '../components/Card';

export function ResourcesPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Resources</h1>
      <div className="mt-6">
        <Card title="Resources Page" icon={ClipboardList}>
          <p className="text-sm text-slate-600">This page is a placeholder for future resources UI design.</p>
        </Card>
      </div>
    </div>
  );
}
