import React, { useEffect } from 'react';
import { animate, m, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

export const MOTION_EASE = [0.16, 1, 0.3, 1];

export function PageMotion({ children, className }) {
  const reduceMotion = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: MOTION_EASE }}
    >
      {children}
    </m.div>
  );
}

export function Reveal({ children, className, delay = 0, amount = 0.2, as = 'div' }) {
  const reduceMotion = useReducedMotion();
  const Component = m[as] || m.div;
  return (
    <Component
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: reduceMotion ? 0 : 0.52, delay: reduceMotion ? 0 : delay, ease: MOTION_EASE }}
    >
      {children}
    </Component>
  );
}

export function MotionItem({ children, className, index = 0, as = 'div', layout = false }) {
  const reduceMotion = useReducedMotion();
  const Component = m[as] || m.div;
  return (
    <Component
      layout={layout && !reduceMotion}
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reduceMotion ? 0 : 0.46, delay: reduceMotion ? 0 : Math.min(index, 6) * 0.055, ease: MOTION_EASE }}
    >
      {children}
    </Component>
  );
}

export function AnimatedNumber({ value, className }) {
  const reduceMotion = useReducedMotion();
  const numericValue = Number(value) || 0;
  const count = useMotionValue(reduceMotion ? numericValue : 0);
  const display = useTransform(count, (latest) => String(Math.round(latest)).padStart(2, '0'));

  useEffect(() => {
    if (reduceMotion) {
      count.set(numericValue);
      return undefined;
    }
    const controls = animate(count, numericValue, { duration: 0.7, ease: MOTION_EASE });
    return () => controls.stop();
  }, [count, numericValue, reduceMotion]);

  return <m.span className={cn('tabular-nums', className)}>{display}</m.span>;
}
