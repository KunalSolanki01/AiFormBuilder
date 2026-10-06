/**
 * App-facing wrappers around the React Bits components in this folder.
 * Each one renders plain, static content when the visitor has asked their system to reduce motion.
 */
import { useSyncExternalStore } from 'react';
import { useTheme } from '../../store/themeStore.js';
import AnimatedContent from './AnimatedContent.jsx';
import BlurText from './BlurText.jsx';
import CountUp from './CountUp.jsx';
import SpotlightCard from './SpotlightCard.jsx';
import TextType from './TextType.jsx';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Fades and slides content in as it scrolls into view. */
export function Reveal({ as: Tag = 'div', className, delay = 0, distance = 28, children, ...props }) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return <Tag className={className} {...props}>{children}</Tag>;
  return (
    <AnimatedContent as={Tag} className={className} delay={delay} distance={distance} duration={0.7} threshold={0.12} {...props}>
      {children}
    </AnimatedContent>
  );
}

/** Heading whose words resolve out of a blur, one after another. */
export function BlurHeading({ as: Tag = 'h2', text, className, delay = 110 }) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return <Tag className={className}>{text}</Tag>;
  return (
    <BlurText as={Tag} text={text} className={className} delay={delay} stepDuration={0.3} direction="top" />
  );
}

/** Types `text` out once. The full text reserves its space so the layout never jumps. */
export function TypedText({ text, className = '', typingSpeed = 24, initialDelay = 500 }) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;
  return (
    <span className="relative block">
      <span className={`invisible ${className}`} aria-hidden>{text}</span>
      <TextType
        as="span"
        text={text}
        loop={false}
        startOnVisible
        typingSpeed={typingSpeed}
        initialDelay={initialDelay}
        cursorCharacter="▍"
        cursorClassName="text-brand-600"
        className={`absolute inset-0 ${className}`}
      />
    </span>
  );
}

/** A flat card with a soft light that follows the cursor. Spotlight colour follows the light/dark theme. */
export function FeatureCard({ className = '', children }) {
  const dark = useTheme((s) => s.theme === 'dark');
  return (
    <SpotlightCard
      spotlightColor={dark ? 'rgba(95, 184, 154, 0.20)' : 'rgba(31, 107, 85, 0.13)'}
      className={`h-full rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-400 ${className}`}
    >
      {children}
    </SpotlightCard>
  );
}

/** Counts up to `to` the first time it is seen. */
export function Counter({ to, duration = 1.6, className }) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return <span className={className}>{to}</span>;
  return <CountUp to={to} duration={duration} className={className} />;
}
