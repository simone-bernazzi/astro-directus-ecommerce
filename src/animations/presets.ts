// src/animations/presets.ts
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

export type AnimationStyle = 'elegant' | 'bold' | 'premium' | 'editorial'

function getAnimationStyle(): AnimationStyle {
  if (typeof document === 'undefined') return 'elegant'
  const style = getComputedStyle(document.documentElement)
    .getPropertyValue('--animation-style')
    .trim()
  return (style as AnimationStyle) || 'elegant'
}

// Duration and easing per preset
const config: Record<AnimationStyle, { duration: number; ease: string; staggerDelay: number }> = {
  elegant:  { duration: 0.8, ease: 'power2.out',     staggerDelay: 0.12 },
  bold:     { duration: 0.6, ease: 'back.out(1.5)',   staggerDelay: 0.08 },
  premium:  { duration: 1.2, ease: 'expo.out',        staggerDelay: 0.15 },
  editorial:{ duration: 0.5, ease: 'power1.inOut',    staggerDelay: 0.06 },
}

export function fadeUp(element: Element | string, delay = 0) {
  const style = getAnimationStyle()
  const { duration, ease } = config[style]
  return gsap.fromTo(
    element,
    { opacity: 0, y: style === 'bold' ? 50 : 30 },
    {
      opacity: 1,
      y: 0,
      duration,
      ease,
      delay,
      scrollTrigger: {
        trigger: element as Element,
        start: 'top 85%',
        once: true,
      },
    }
  )
}

export function staggerIn(elements: Element[] | string, delay = 0) {
  const style = getAnimationStyle()
  const { duration, ease, staggerDelay } = config[style]
  return gsap.fromTo(
    elements,
    { opacity: 0, y: 25 },
    {
      opacity: 1,
      y: 0,
      duration,
      ease,
      delay,
      stagger: staggerDelay,
      scrollTrigger: {
        trigger: typeof elements === 'string' ? elements : (elements[0] as Element),
        start: 'top 85%',
        once: true,
      },
    }
  )
}

export function splitTitle(element: Element) {
  const style = getAnimationStyle()
  if (style === 'elegant' || style === 'editorial') {
    return fadeUp(element)
  }
  // bold and premium: word-by-word animation
  const split = new SplitText(element, { type: 'words' })
  const { duration, ease } = config[style]
  return gsap.fromTo(
    split.words,
    { opacity: 0, y: 40, rotateX: -15 },
    {
      opacity: 1,
      y: 0,
      rotateX: 0,
      duration,
      ease,
      stagger: 0.06,
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        once: true,
      },
    }
  )
}

export function parallax(element: Element, strength = 0.15) {
  const style = getAnimationStyle()
  if (style === 'editorial') return undefined
  const yAmount = style === 'premium' ? strength * 120 : strength * 60
  return gsap.to(element, {
    yPercent: yAmount,
    ease: 'none',
    scrollTrigger: {
      trigger: element,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  })
}
