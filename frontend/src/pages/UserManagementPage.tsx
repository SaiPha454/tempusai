import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Shield, Trash2, UserCog } from 'lucide-react';
import { Card } from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import {
  createAdminUserMock,
  listAdminUsersMock,
  removeAdminUserMock,
} from '../services/auth/mockAuthService';
import { authRoles, type AuthRole, type AuthUser } from '../types/auth';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const roleLabelByValue: Record<AuthRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
};

type NewAdminForm = {
  displayName: string;
  email: string;
  role: AuthRole;
  initialPassword: string;
};

const initialForm: NewAdminForm = {
  displayName: '',
  email: '',
  role: authRoles.ADMIN,
  initialPassword: '',
};

export function UserManagementPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [form, setForm] = useState<NewAdminForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setPageError(null);
      const result = await listAdminUsersMock();
      setUsers(result);
    } catch {
      setPageError('Unable to load admin users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [users],
  );

  const validateForm = (): string | null => {
    if (!form.displayName.trim() || !form.email.trim() || !form.initialPassword.trim()) {
      return 'Name, email, and initial password are required.';
    }

    if (!emailRegex.test(form.email.trim())) {
      return 'Please enter a valid email address.';
    }

    if (form.initialPassword.length < MIN_PASSWORD_LENGTH) {
      return `Initial password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    return null;
  };

  const handleCreateAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setIsCreating(true);
      const created = await createAdminUserMock({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        role: form.role,
        initialPassword: form.initialPassword,
      });
      setUsers((prev) => [...prev, created]);
      setSuccessMessage('Admin user created successfully.');
      setForm(initialForm);
      setIsCreateModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create user.';
      setFormError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (targetUser: AuthUser) => {
    const confirmed = window.confirm(`Remove ${targetUser.displayName} from admin users?`);
    if (!confirmed || !user) {
      return;
    }

    try {
      setPageError(null);
      setSuccessMessage(null);
      setDeletingUserId(targetUser.id);
      await removeAdminUserMock(targetUser.id, user.id);
      setUsers((prev) => prev.filter((entry) => entry.id !== targetUser.id));
      setSuccessMessage('Admin user removed successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove user.';
      setPageError(message);
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">User Management</h1>
          <p className="mt-1 text-sm text-slate-600">Manage administrator accounts and role assignments.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0A64BC] px-4 text-sm font-semibold text-white transition hover:bg-[#0858A6]"
        >
          <Plus size={15} />
          Add admin user
        </button>
      </div>

      {pageError ? <p className="text-sm text-rose-600">{pageError}</p> : null}
      {!pageError && successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

      <Card title="Admin Users" icon={UserCog}>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading users...</p>
        ) : sortedUsers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            No admin users found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedUsers.map((entry) => {
                  const isDeleting = deletingUserId === entry.id;
                  const isCurrentUser = user?.id === entry.id;
                  return (
                    <tr key={entry.id}>
                      <td className="px-3 py-3 text-slate-800">
                        <p className="font-medium">{entry.displayName}</p>
                        {isCurrentUser ? <p className="mt-0.5 text-xs text-slate-500">You</p> : null}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{entry.email}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {roleLabelByValue[entry.role]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          disabled={isDeleting || isCurrentUser}
                          onClick={() => void handleDeleteUser(entry)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                        >
                          <Trash2 size={13} />
                          {isDeleting ? 'Removing...' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A64BC]">Super Admin</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Add New Admin User</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleCreateAdmin} noValidate>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Name</span>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
                  placeholder="Enter display name"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
                  placeholder="new-admin@tempusai.local"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Role</span>
                <div className="relative">
                  <select
                    value={form.role}
                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as AuthRole }))}
                    className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
                  >
                    <option value={authRoles.ADMIN}>Admin</option>
                    <option value={authRoles.SUPER_ADMIN}>Super Admin</option>
                  </select>
                  <Shield size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Initial password</span>
                <input
                  type="password"
                  value={form.initialPassword}
                  onChange={(event) => setForm((prev) => ({ ...prev, initialPassword: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
                  placeholder="At least 8 characters"
                />
              </label>

              {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0A64BC] px-4 text-sm font-semibold text-white transition hover:bg-[#0858A6] disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isCreating ? 'Creating...' : 'Create admin user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
