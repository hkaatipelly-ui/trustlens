import { motion, useReducedMotion } from 'motion/react';

export default function PageTransition({ children }) {
  const reduce = useReducedMotion();
  return <motion.div initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : -4 }} transition={{ duration: reduce ? 0 : .25 }} className="min-w-0">{children}</motion.div>;
}
