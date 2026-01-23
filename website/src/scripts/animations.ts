/**
 * animations.ts
 * GSAP animation controller for Velocity Bridge.
 * SIMPLIFIED: No scroll-tied animations to avoid resize issues.
 * Just simple entrance animations that run once on page load.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Check if user prefers reduced motion
function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Check if device is mobile
function isMobile(): boolean {
    return window.matchMedia('(max-width: 768px)').matches;
}

/**
 * Initialize all animations
 */
export function initAnimations(): void {
    // Skip all animations if reduced motion is preferred
    if (prefersReducedMotion()) {
        makeEverythingVisible();
        return;
    }

    // Simple entrance animations - no scroll-tied effects
    initHeroAnimations();
    initScrollAnimations();
}

/**
 * Make everything visible immediately (for reduced motion / fallback)
 */
function makeEverythingVisible(): void {
    gsap.set('.hero__island, .hero__headline-text, .hero__subheadline, .hero__cta, .feature-card, .step-card', {
        opacity: 1,
        y: 0,
        x: 0,
    });
}

/**
 * Hero section entrance animations - simple fade in, NO parallax
 */
function initHeroAnimations(): void {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const mobile = isMobile();
    const duration = mobile ? 0.5 : 0.7;

    const timeline = gsap.timeline({
        defaults: {
            ease: 'power2.out',
            duration: duration,
        },
    });

    // Simple staggered entrance - no transforms that persist
    const islands = document.querySelectorAll('.hero__island');
    const headline = document.querySelector('.hero__headline-text');
    const subheadline = document.querySelector('.hero__subheadline');
    const cta = document.querySelector('.hero__cta');

    if (islands.length > 0) {
        gsap.set(islands, { opacity: 0, y: 30 });
        timeline.to(islands, {
            y: 0,
            opacity: 1,
            stagger: 0.15,
            clearProps: 'transform', // Clear transform after animation
        });
    }

    if (headline) {
        gsap.set(headline, { opacity: 0, y: 20 });
        timeline.to(headline, {
            y: 0,
            opacity: 1,
            clearProps: 'transform',
        }, '-=0.3');
    }

    if (subheadline) {
        gsap.set(subheadline, { opacity: 0, y: 15 });
        timeline.to(subheadline, {
            y: 0,
            opacity: 1,
            clearProps: 'transform',
        }, '-=0.2');
    }

    if (cta) {
        gsap.set(cta, { opacity: 0, y: 10 });
        timeline.to(cta, {
            y: 0,
            opacity: 1,
            clearProps: 'transform',
        }, '-=0.1');
    }
}

/**
 * Scroll-triggered animations - simple fade in only
 */
function initScrollAnimations(): void {
    const mobile = isMobile();

    // Feature cards - simple fade in
    const featureCards = document.querySelectorAll('.feature-card');
    if (featureCards.length > 0) {
        gsap.set(featureCards, { opacity: 0, y: 30 });

        ScrollTrigger.create({
            trigger: '.features__grid',
            start: 'top 85%',
            once: true,
            onEnter: () => {
                gsap.to(featureCards, {
                    y: 0,
                    opacity: 1,
                    duration: mobile ? 0.4 : 0.6,
                    stagger: 0.08,
                    ease: 'power2.out',
                    clearProps: 'transform',
                });
            },
        });
    }

    // Step cards - simple fade in
    const stepCards = document.querySelectorAll('.step-card');
    if (stepCards.length > 0) {
        gsap.set(stepCards, { opacity: 0, y: 20 });

        ScrollTrigger.create({
            trigger: '.timeline__steps',
            start: 'top 85%',
            once: true,
            onEnter: () => {
                gsap.to(stepCards, {
                    y: 0,
                    opacity: 1,
                    duration: mobile ? 0.4 : 0.5,
                    stagger: 0.1,
                    ease: 'power2.out',
                    clearProps: 'transform',
                });
            },
        });
    }

    // Install section - simple fade in
    const installContainer = document.querySelector('.install__container');
    if (installContainer && installContainer.children.length > 0) {
        gsap.set(installContainer.children, { opacity: 0, y: 20 });

        ScrollTrigger.create({
            trigger: '.install',
            start: 'top 85%',
            once: true,
            onEnter: () => {
                gsap.to(installContainer.children, {
                    y: 0,
                    opacity: 1,
                    duration: mobile ? 0.3 : 0.5,
                    stagger: 0.05,
                    ease: 'power2.out',
                    clearProps: 'transform',
                });
            },
        });
    }
}
