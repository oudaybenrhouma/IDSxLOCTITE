/**
 * IDS mascot — single source of truth for the character's appearances.
 *
 * The artwork is used as supplied: never redrawn, recoloured, cropped or stretched.
 * Transparent PNGs are placed directly on the surface (no frames or white plates).
 */
import React from 'react';
import neutral from '../assets/mascots/01-neutral.png';
import success from '../assets/mascots/02-success.png';
import error from '../assets/mascots/03-error.png';
import loading from '../assets/mascots/04-loading.png';
import empty from '../assets/mascots/05-empty.png';

const POSES = {
  neutral: {
    src: neutral,
    alt: 'IDS robot mascot waving hello',
    // Poses that carry meaning are announced; decorative repeats are silent.
  },
  success: { src: success, alt: 'IDS robot mascot jumping with both fists raised' },
  error: { src: error, alt: 'IDS robot mascot scratching its head with a snapped spanner' },
  loading: { src: loading, alt: 'IDS robot mascot tightening a nut with a spanner' },
  empty: { src: empty, alt: 'IDS robot mascot holding an empty box' },
};

/**
 * @param {object} props
 * @param {'neutral'|'success'|'error'|'loading'|'empty'} props.pose
 * @param {number} props.size rendered height in px (width follows the 1:1 ratio)
 * @param {boolean} props.decorative hide from assistive tech when the surrounding
 *        text already conveys the message (avoids duplicate announcements)
 * @param {string} props.className
 * @param {boolean} props.animate subtle motion for loading poses only; automatically
 *        disabled when the user prefers reduced motion
 */
export function Mascot({ pose = 'neutral', size = 96, decorative = false, className = '', animate = false, alt }) {
  const spec = POSES[pose] || POSES.neutral;
  const isAnimated = animate || pose === 'loading';
  return (
    <img
      src={spec.src}
      alt={decorative ? '' : alt || spec.alt}
      aria-hidden={decorative ? 'true' : undefined}
      width={size}
      height={size}
      loading={size > 160 ? 'eager' : 'lazy'}
      decoding="async"
      className={`mascot ${isAnimated ? 'mascot--animated' : ''} ${className}`.trim()}
      style={{ height: size, width: size }}
      data-pose={pose}
    />
  );
}

export const MASCOT_POSES = Object.keys(POSES);
export default Mascot;
