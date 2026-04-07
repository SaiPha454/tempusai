import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type LocationState = {
  from?: {
    pathname?: string;
  };
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetPath = useMemo(() => {
    const state = location.state as LocationState | undefined;
    return state?.from?.pathname ?? '/scheduling-manager';
  }, [location.state]);

  const validateForm = (): string | null => {
    if (!email.trim() || !password.trim()) {
      return 'Email and password are required.';
    }

    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address.';
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      await signIn({ email: email.trim(), password });
      navigate(targetPath, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in with provided credentials.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[1.05fr_1fr]">
          <section className="hidden border-r border-slate-200 bg-[#0A64BC]/[0.04] p-10 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A64BC]">TempusAI Admin</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Sign in to your scheduling workspace</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Continue with your admin account to access project features. Permissions are applied automatically based on
              your role.
            </p>
          </section>

          <section className="p-6 sm:p-8 lg:p-10">
            <div className="mx-auto w-full max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A64BC] lg:hidden">TempusAI Admin</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Sign In</h2>
              <p className="mt-1 text-sm text-slate-600">Use your admin credentials to continue.</p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
                  <div className="relative">
                    <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
                      autoComplete="email"
                      placeholder="you@company.com"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
                  <div className="relative">
                    <LockKeyhole
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 text-sm text-slate-800 outline-none transition focus:border-[#0A64BC] focus:ring-2 focus:ring-[#0A64BC]/20"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>

                <div className="min-h-5">
                  {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#0A64BC] px-4 text-sm font-semibold text-white transition hover:bg-[#0858A6] disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
