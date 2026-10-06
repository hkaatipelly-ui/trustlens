import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Activity, Bot, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, FlaskConical, Inbox, LayoutDashboard, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useOperations } from '../../contexts/OperationsContext.jsx';
import { USING_MOCKS } from '../../services/request.js';
import LensLogo from '../LensLogo.jsx';
import PulseDot from '../motion/PulseDot.jsx';

const navigation = [
  { to: '/', label: 'Command Center', icon: LayoutDashboard },
  { to: '/console', label: 'Agent Console', icon: Bot },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { to: '/outbox', label: 'Outbox', icon: Inbox },
  { to: '/audit', label: 'Audit Log', icon: ClipboardList },
  { to: '/policies', label: 'Policies & Agents', icon: Activity },
  { to: '/playground', label: 'Playground', icon: FlaskConical },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { pendingCount } = useOperations();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tl_sidebar') === 'collapsed');
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const drawerRef = useRef(null);
  const drawerButton = useRef(null);
  const reduce = useReducedMotion();
  const location = useLocation();
  const current = navigation.find((item) => item.to === location.pathname)?.label || 'Operations';

  useEffect(() => { setDrawer(false); setMenu(false); }, [location.pathname]);
  useEffect(() => {
    function outside(event) { if (!menuRef.current?.contains(event.target)) setMenu(false); }
    function escape(event) { if (event.key === 'Escape') { setDrawer(false); setMenu(false); } }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);
  useEffect(() => {
    if (!drawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector('button')?.focus();
    function trap(event) {
      if (event.key !== 'Tab') return;
      const items = drawerRef.current?.querySelectorAll('a, button');
      const first = items?.[0]; const last = items?.[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', trap);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', trap); drawerButton.current?.focus(); };
  }, [drawer]);
  useEffect(() => { document.title = `${current} · TrustLens`; }, [current]);

  function toggleSidebar() {
    setCollapsed((value) => { localStorage.setItem('tl_sidebar', value ? 'expanded' : 'collapsed'); return !value; });
  }
  function nav(compact = false) {
    return <nav aria-label="Main navigation" className="space-y-1">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} title={compact ? label : undefined} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${compact ? 'justify-center px-2!' : ''}`}><Icon size={17} className="shrink-0" aria-hidden="true" />{!compact && <span className="flex-1">{label}</span>}{to === '/approvals' && pendingCount > 0 && <span aria-label={`${pendingCount} pending approvals`} className={`rounded bg-suspicious/10 px-1.5 py-0.5 font-mono text-[10px] text-suspicious ${compact ? 'absolute -mt-6 ml-7' : ''}`}>{pendingCount}</span>}{compact && <span className="sr-only">{label}</span>}</NavLink>)}</nav>;
  }

  return <div className="app-background noise min-h-screen">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-ink focus:p-3 focus:text-canvas">Skip to content</a>
    <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface/95 backdrop-blur-xl lg:flex ${collapsed ? 'w-[76px]' : 'w-[228px]'}`}>
      <div className={`flex h-[76px] items-center gap-3 border-b border-line px-5 ${collapsed ? 'px-[19px]!' : ''}`}><LensLogo />{!collapsed && <div><span className="font-heading text-lg font-semibold tracking-tight">TrustLens</span><p className="eyebrow text-[8px]! tracking-[.2em]!">AI ACTION FIREWALL</p></div>}</div>
      <div className="flex-1 px-3 py-7">{!collapsed && <p className="eyebrow mb-4 px-3">Workspace</p>}{nav(collapsed)}</div>
      {!collapsed && <div className="mx-4 mb-5 rounded-control border border-line bg-canvas/60 p-3"><div className="flex items-center gap-2 text-[11px]"><PulseDot /> Protection active</div><p className="mt-2 text-[10px] leading-5 text-muted">Every action passes the trust gate.</p></div>}
      <button onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="flex h-12 items-center justify-center gap-2 border-t border-line text-xs text-muted hover:text-ink">{collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={14} /> Collapse sidebar</>}</button>
    </aside>
    <div className={`relative ${collapsed ? 'lg:ml-[76px]' : 'lg:ml-[228px]'}`}>
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-xl sm:px-7 lg:px-8">
        <div className="flex min-w-0 items-center gap-3"><button ref={drawerButton} aria-label="Open navigation" aria-expanded={drawer} onClick={() => setDrawer(true)} className="icon-button lg:hidden"><Menu size={20} /></button><span className="hidden font-mono text-[11px] text-muted sm:block">Workspace <span className="mx-2 text-white/20">/</span> <span className="text-ink">{current}</span></span><span className="font-heading text-lg sm:hidden">TrustLens</span></div>
        <div className="flex items-center gap-3 sm:gap-5"><span className="eyebrow hidden rounded-md border border-line px-2.5 py-1.5 text-[9px]! md:block">DEMO ORG · acme.in</span>{USING_MOCKS && <span className="badge badge-neutral text-[9px]!">MOCK MODE</span>}<div ref={menuRef} className="relative"><button onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="User menu" className="flex items-center gap-2 rounded-control p-1.5 hover:bg-white/4"><span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-elevated font-heading text-xs">{user?.name?.slice(0, 2).toUpperCase()}</span><span className="hidden text-left md:block"><span className="block text-[11px]">{user?.name}</span><span className="block font-mono text-[9px] text-muted">{user?.role}</span></span><ChevronDown size={12} className="text-muted" /></button>{menu && <div className="absolute right-0 top-12 w-60 rounded-card border border-line bg-elevated p-2 shadow-2xl"><p className="break-all px-3 py-3 text-xs text-muted">{user?.email}</p><button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs hover:bg-white/5"><LogOut size={14} /> Log out</button></div>}</div></div>
      </header>
      <main id="main-content" className="mx-auto max-w-[1560px] p-4 pb-12 sm:p-7 lg:p-8">{children}</main>
      <footer className="mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-line py-5 font-mono text-[9px] text-muted sm:mx-7 lg:mx-8"><span>TRUSTLENS / VERIFIED BEFORE EXECUTION</span><span>SIMULATED TOOLS · {USING_MOCKS ? 'LOCAL DEMO DATA' : 'LIVE API'}</span></footer>
    </div>
    <AnimatePresence>{drawer && <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .2 }}><div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawer(false)} /><motion.aside ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation" initial={{ x: reduce ? 0 : -280 }} animate={{ x: 0 }} exit={{ x: reduce ? 0 : -280 }} transition={{ duration: reduce ? 0 : .25 }} className="relative flex h-full w-[280px] max-w-[85vw] flex-col border-r border-line bg-surface p-5"><div className="mb-8 flex items-center justify-between"><div className="flex items-center gap-3"><LensLogo /><span className="font-heading text-xl">TrustLens</span></div><button aria-label="Close navigation" onClick={() => setDrawer(false)} className="icon-button"><X size={18} /></button></div>{nav()}<p className="eyebrow mt-auto pt-8">DEMO ORG · acme.in</p></motion.aside></motion.div>}</AnimatePresence>
  </div>;
}
