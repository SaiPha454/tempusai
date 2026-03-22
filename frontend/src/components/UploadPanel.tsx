import type { ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { Card } from './Card';

export function UploadPanel({
  title,
  description,
  fileName,
  onFileChange,
}: {
  title: string;
  description: string;
  fileName: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Card
      title={title}
      icon={Upload}
      headerRight={
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
          Upload Excel
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
        </label>
      }
    >
      <p className="text-sm text-slate-600">{description}</p>
      <p className="mt-2 text-xs text-slate-500">
        {fileName ? `Latest file: ${fileName}` : 'No file uploaded yet.'}
      </p>
    </Card>
  );
}
