import { motion, useReducedMotion } from 'motion/react';

export function Stagger({ children, className = '' }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: reduce ? 0 : .06 } } }}>{children}</motion.div>;
}

export function StaggerItem({ children, className = '' }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} variants={{ hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 8 }, visible: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : .25 } } }}>{children}</motion.div>;
}
