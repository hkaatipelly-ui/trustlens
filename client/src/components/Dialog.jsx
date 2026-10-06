import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

export default function Dialog({ title, onClose, children }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector('button')?.focus();
    function key(event) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = ref.current?.querySelectorAll('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]');
      const first = elements?.[0]; const last = elements?.[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', key); previousFocus?.focus(); };
  }, [onClose]);
  return <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .2 }}><div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} /><motion.section ref={ref} role="dialog" aria-modal="true" aria-labelledby="detail-title" initial={{ x: reduce ? 0 : 40 }} animate={{ x: 0 }} transition={{ duration: reduce ? 0 : .25 }} className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-line bg-surface shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-4 backdrop-blur-xl"><h2 id="detail-title" className="text-lg">{title}</h2><button onClick={onClose} aria-label="Close detail" className="icon-button"><X size={18} /></button></header><div className="p-5 sm:p-7">{children}</div></motion.section></motion.div>;
}
