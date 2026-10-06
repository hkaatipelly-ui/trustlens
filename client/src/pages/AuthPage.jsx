import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext.jsx';
import { validateAuth } from '../lib/authValidation.js';
import { USING_MOCKS } from '../services/request.js';
import LensLogo from '../components/LensLogo.jsx';
import LensVisual from '../components/LensVisual.jsx';
import PageTransition from '../components/motion/PageTransition.jsx';
import { Button } from '../components/ui.jsx';

export default function AuthPage({ register = false }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  const destination = location.state?.from?.startsWith('/') && !location.state.from.startsWith('//') && !['/login', '/register'].includes(location.state.from) ? location.state.from : '/';
  useEffect(() => { document.title = `${register ? 'Create account' : 'Sign in'} · TrustLens`; }, [register]);
  if (auth.user) return <Navigate to={destination} replace />;

  function change(field, value) { setValues((old) => ({ ...old, [field]: value })); setErrors((old) => ({ ...old, [field]: '' })); setFormError(''); }
  async function submit(event) {
    event.preventDefault();
    const validation = validateAuth(values, register);
    setErrors(validation);
    if (Object.keys(validation).length) { document.getElementById(`auth-${Object.keys(validation)[0]}`)?.focus(); return; }
    setPending(true); setFormError('');
    try {
      const body = { email: values.email.trim().toLowerCase(), password: values.password, ...(register ? { name: values.name.trim() } : {}) };
      await auth[register ? 'register' : 'login'](body);
      toast.success(register ? 'Workspace account created' : 'Welcome to TrustLens');
      navigate(destination, { replace: true });
    } catch (error) { setFormError(error.message); toast.error(error.message); }
    finally { setPending(false); }
  }

  return <PageTransition><main className="app-background noise relative min-h-screen lg:grid lg:grid-cols-2">
    <section className="relative flex flex-col justify-between border-b border-line px-6 py-6 sm:px-10 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-14 lg:py-10 xl:px-20">
      <Link to="/login" className="relative flex w-fit items-center gap-3"><LensLogo /><span className="font-heading text-xl font-semibold tracking-tight">TrustLens</span></Link>
      <div className="relative my-10 lg:my-0"><p className="eyebrow mb-5">A FIREWALL FOR AUTONOMOUS AI</p><h1 className="max-w-lg font-heading text-[36px] leading-[1.12] font-medium tracking-[-.05em] sm:text-[46px] xl:text-[54px]">Every AI action,<br /><span className="text-muted">verified before</span><br />it happens.</h1><p className="mt-5 max-w-md text-[13px] leading-7 text-muted">Give your agents room to work. Keep every permission, destination, and piece of sensitive data in sight.</p><div className="hidden lg:block"><LensVisual /></div></div>
      <div className="relative hidden items-center gap-2 font-mono text-[9px] tracking-widest text-muted lg:flex"><ShieldCheck size={13} /> DETERMINISTIC TRUST. HUMAN CONTROL.</div>
    </section>
    <section className="relative flex items-center justify-center px-6 py-12 sm:px-12 lg:py-20">
      <div className="w-full max-w-[360px]">
        <div className="mb-8"><p className="eyebrow">{register ? 'SET UP YOUR WORKSPACE' : 'YOUR OPERATIONS START HERE'}</p><h2 className="mt-3 text-[30px] font-medium tracking-[-.04em]">{register ? 'Create an account' : 'Welcome back.'}</h2><p className="mt-3 text-xs leading-6 text-muted">{register ? 'Bring clarity and control to every agent action.' : 'Sign in to your AI security command center.'}</p></div>
        <form onSubmit={submit} noValidate aria-busy={pending} className="space-y-5">
          {(register ? ['name', 'email', 'password'] : ['email', 'password']).map((field) => <div key={field}><label className="field-label" htmlFor={`auth-${field}`}>{field === 'name' ? 'Full name' : field === 'email' ? 'Email address' : 'Password'}</label><div className="relative"><input id={`auth-${field}`} type={field === 'password' ? visible ? 'text' : 'password' : field === 'email' ? 'email' : 'text'} autoComplete={field === 'password' ? register ? 'new-password' : 'current-password' : field} value={values[field]} onChange={(event) => change(field, event.target.value)} placeholder={field === 'name' ? 'Alex Morgan' : field === 'email' ? 'you@company.com' : 'At least 8 characters'} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${field}-error` : undefined} disabled={pending} className={`field ${field === 'password' ? 'pr-12' : ''}`} />{field === 'password' && <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)} className="icon-button absolute top-1.5 right-1.5">{visible ? <EyeOff size={15} /> : <Eye size={15} />}</button>}</div>{errors[field] && <p id={`${field}-error`} className="mt-2 text-[11px] text-unsafe">{errors[field]}</p>}</div>)}
          {formError && <p role="alert" className="rounded-control border border-unsafe/20 bg-unsafe/5 p-3 text-xs leading-6 text-unsafe">{formError}</p>}
          <Button type="submit" loading={pending || auth.loading} className="btn-primary mt-2 w-full py-3!">{pending ? register ? 'Creating account…' : 'Signing in…' : register ? 'Create account' : 'Sign in'}{!pending && <ArrowRight size={15} />}</Button>
        </form>
        {!register && <><div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="eyebrow text-[8px]!">TAKE A LOOK AROUND</span><span className="h-px flex-1 bg-line" /></div><Button disabled={pending} className="w-full" onClick={() => { setValues({ name: '', email: 'demo@trustlens.app', password: 'Demo@1234' }); setErrors({}); setFormError(''); }}>Use demo account</Button></>}
        <p className="mt-7 text-center text-xs text-muted">{register ? 'Already have an account?' : 'New to TrustLens?'} <Link to={register ? '/login' : '/register'} state={location.state} className="ml-1 text-ink underline decoration-white/20 underline-offset-4 hover:decoration-white/70">{register ? 'Sign in' : 'Create an account'}</Link></p>
        <p className="mt-10 text-center font-mono text-[9px] leading-5 text-muted">{USING_MOCKS ? 'LOCAL MOCK WORKSPACE · NO BACKEND REQUIRED' : 'ACME.IN WORKSPACE · SIMULATED TOOL EXECUTION'}</p>
      </div>
    </section>
  </main></PageTransition>;
}
