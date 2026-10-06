import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlurHeading, Counter, FeatureCard, Reveal, TypedText } from '../src/components/reactbits/index.jsx';

function mockReducedMotion(reduce) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('FeatureCard (SpotlightCard)', () => {
  beforeEach(() => mockReducedMotion(false));

  it('renders its content and lights up only while the pointer is over it', () => {
    const { container } = render(<FeatureCard><h3>Payments</h3></FeatureCard>);
    expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    const card = container.firstElementChild;
    const glow = card.firstElementChild;
    expect(glow.style.opacity).toBe('0');
    fireEvent.mouseEnter(card);
    expect(glow.style.opacity).toBe('0.6');
    fireEvent.mouseLeave(card);
    expect(glow.style.opacity).toBe('0');
  });
});

describe('React Bits wrappers with "reduce motion" on', () => {
  beforeEach(() => mockReducedMotion(true));

  it('renders headings as real, static elements', () => {
    render(<BlurHeading as="h1" text="Say what you need to ask." className="big" />);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Say what you need to ask.' });
    expect(h1).toHaveClass('big');
    expect(h1.children).toHaveLength(0); // not split into animated word spans
  });

  it('shows typed text immediately and in full', () => {
    render(<TypedText text="Event registration for a hackathon." />);
    expect(screen.getByText('Event registration for a hackathon.')).toBeVisible();
  });

  it('shows the final count with no animation', () => {
    render(<Counter to={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('does not hide revealed content, and keeps the requested element type', () => {
    const { container } = render(
      <ol>
        <Reveal as="li" className="step" delay={0.2}>First step</Reveal>
      </ol>,
    );
    const li = screen.getByText('First step');
    expect(li.tagName).toBe('LI');
    expect(li).toHaveClass('step');
    expect(li).not.toHaveClass('invisible');
    expect(container.querySelector('ol > li')).toBe(li);
  });
});
