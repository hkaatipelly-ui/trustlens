import { useEffect, useRef } from 'react';
import { useSpring, useReducedMotion } from 'motion/react';

export default function AnimatedNumber({ value = 0, decimals = 0, className = '' }) {
  const element = useRef(null);
  const reduce = useReducedMotion();
  const spring = useSpring(0, { stiffness: 90, damping: 22 });
  useEffect(() => {
    const format = (number) => Number(number).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (reduce) {
      if (element.current) element.current.textContent = format(value);
      return;
    }
    const unsubscribe = spring.on('change', (number) => {
      if (element.current) element.current.textContent = format(number);
    });
    spring.set(value);
    return unsubscribe;
  }, [value, decimals, reduce, spring]);
  return <span ref={element} className={className} aria-label={String(value)}>{reduce ? value.toLocaleString('en-US', { maximumFractionDigits: decimals }) : '0'}</span>;
}
