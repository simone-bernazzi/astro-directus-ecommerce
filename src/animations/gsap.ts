// src/animations/gsap.ts
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { fadeUp, staggerIn, splitTitle } from './presets'

export function initAnimations(): void {
  if (typeof window === 'undefined') return

  gsap.registerPlugin(ScrollTrigger)

  // Lenis smooth scroll
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  })

  // Connect Lenis to GSAP ticker
  gsap.ticker.add((time: number) => {
    lenis.raf(time * 1000)
  })
  gsap.ticker.lagSmoothing(0)

  // Keep ScrollTrigger in sync with Lenis scroll position
  lenis.on('scroll', () => ScrollTrigger.update())

  // Apply animations to elements with data-animate attributes
  document.querySelectorAll<Element>('[data-animate="fade-up"]').forEach((el) => {
    fadeUp(el)
  })

  document.querySelectorAll<Element>('[data-animate="stagger"]').forEach((container) => {
    const children = Array.from(container.children)
    if (children.length > 0) staggerIn(children)
  })

  document.querySelectorAll<Element>('[data-animate="split-title"]').forEach((el) => {
    splitTitle(el)
  })

  document.querySelectorAll<Element>('[data-animate="fade-in"]').forEach((el) => {
    gsap.fromTo(el,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 1,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      }
    )
  })
}
