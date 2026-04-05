import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteExamScheduleDraft,
  listExamDraftScheduleSummary,
  type ExamDraftScheduleSummaryDto,
} from '../api/scheduling';

function buildDraftDisplayName(draft: ExamDraftScheduleSummaryDto): string {
  const trimmed = draft.job_name?.trim();
  if (trimmed) {
    return trimmed;
  }
  return `Exam Draft ${draft.id.slice(0, 8)}`;
}

export function DraftSchedulingsPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<ExamDraftScheduleSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDrafts = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const result = await listExamDraftScheduleSummary();
      setDrafts(result);
    } catch {
      setErrorMessage('Unable to load draft schedulings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDrafts();
  }, []);

  const sortedDrafts = useMemo(
    () =>
      [...drafts].sort(
        (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
      ),
    [drafts],
  );

  const handleResume = (snapshotId: string) => {
    navigate(`/exam-scheduling-draft?snapshotId=${snapshotId}`);
  };

  const handleDelete = async (snapshotId: string) => {
    const confirmed = window.confirm('Delete this draft scheduling?');
    if (!confirmed) {
      return;
    }

    try {
      setDeletingDraftId(snapshotId);
      await deleteExamScheduleDraft(snapshotId);
      setDrafts((prev) => prev.filter((draft) => draft.id !== snapshotId));
    } catch {
      setErrorMessage('Failed to delete draft scheduling.');
    } finally {
      setDeletingDraftId(null);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Draft Schedulings</h1>
        <p className="mt-1 text-sm text-slate-600">Resume or delete draft schedulings. Currently supports exam drafts.</p>
      </div>

      {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading draft schedulings...</p>
      ) : sortedDrafts.length === 0 ? (
        <p className="text-sm text-slate-500">No exam draft schedulings found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-slate-700">
                <th className="border border-slate-200 px-3 py-2">Name</th>
                <th className="border border-slate-200 px-3 py-2">Type</th>
                <th className="border border-slate-200 px-3 py-2">Programs</th>
                <th className="border border-slate-200 px-3 py-2">Entries</th>
                <th className="border border-slate-200 px-3 py-2">Last Updated</th>
                <th className="border border-slate-200 px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedDrafts.map((draft) => (
                <tr key={draft.id} className="align-top">
                  <td className="border border-slate-200 px-3 py-2">
                    <p className="font-semibold text-slate-900">{buildDraftDisplayName(draft)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">ID: {draft.id}</p>
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-700">Exam</td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-700">
                    {draft.program_values.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {draft.program_values.map((programValue) => (
                          <span
                            key={`${draft.id}-${programValue}`}
                            className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700"
                          >
                            {programValue}
                          </span>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-700">{draft.entry_count}</td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-700">
                    {new Date(draft.updated_at).toLocaleString()}
                  </td>
                  <td className="border border-slate-200 px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleResume(draft.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Resume
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(draft.id)}
                        disabled={deletingDraftId === draft.id}
                        className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                      >
                        {deletingDraftId === draft.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
