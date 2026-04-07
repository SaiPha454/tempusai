import { KeyRound, UserRound } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { authRoles } from '../types/auth';

const MIN_PASSWORD_LENGTH = 8;

export function ProfilePage() {
  const { user, updateDisplayName, changePassword } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const roleLabel = useMemo(
    () => (user?.role === authRoles.SUPER_ADMIN ? 'Super Admin' : 'Admin'),
    [user?.role],
  );

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!displayName.trim()) {
      setProfileError('Display name is required.');
      return;
    }

    try {
      setIsSavingProfile(true);
      await updateDisplayName({ displayName: displayName.trim() });
      setProfileSuccess('Profile name updated successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update profile.';
      setProfileError(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation must match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      await changePassword({
        currentPassword,
        newPassword,
      });
      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change password.';
      setPasswordError(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Profile</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your account information and password.</p>
      </div>

      <Card title="Account Overview" icon={UserRound}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{user?.email ?? '-'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{roleLabel}</p>
          </div>
        </div>
      </Card>

      <Card title="Profile Information" icon={UserRound}>
        <form className="space-y-4" onSubmit={handleProfileSubmit} noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
              placeholder="Enter your display name"
            />
          </label>

          <div className="min-h-5">
            {profileError ? <p className="text-sm text-rose-600">{profileError}</p> : null}
            {!profileError && profileSuccess ? <p className="text-sm text-emerald-700">{profileSuccess}</p> : null}
          </div>

          <button
            type="submit"
            disabled={isSavingProfile}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0A64BC] px-4 text-sm font-semibold text-white transition hover:bg-[#0858A6] disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSavingProfile ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </Card>

      <Card title="Change Password" icon={KeyRound}>
        <form className="space-y-4" onSubmit={handlePasswordSubmit} noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
              />
            </label>
          </div>

          <p className="text-xs text-slate-500">Password must be at least 8 characters.</p>

          <div className="min-h-5">
            {passwordError ? <p className="text-sm text-rose-600">{passwordError}</p> : null}
            {!passwordError && passwordSuccess ? <p className="text-sm text-emerald-700">{passwordSuccess}</p> : null}
          </div>

          <button
            type="submit"
            disabled={isChangingPassword}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {isChangingPassword ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </Card>
    </div>
  );
}
