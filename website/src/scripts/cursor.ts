/**
 * cursor.ts
 * Custom cursor with magnetic effect on buttons.
 * OPTIMIZED: Uses CSS variables and transforms for better performance.
 * Desktop only (fine pointer), respects reduced motion.
 */

// Check system preferences
function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hasCoarsePointer(): boolean {
    return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Initialize custom cursor
 */
export function initCursor(): void {
    // Skip on touch devices or reduced motion
    if (hasCoarsePointer() || prefersReducedMotion()) {
        return;
    }

    const cursor = document.querySelector('.custom-cursor') as HTMLElement;
    const cursorRing = document.querySelector('.custom-cursor__ring') as HTMLElement;

    if (!cursor || !cursorRing) {
        return;
    }

    // Mouse position
    let mouseX = 0;
    let mouseY = 0;

    // Lerped cursor position (for smooth following)
    let cursorX = 0;
    let cursorY = 0;

    // Ring position (follows with more delay)
    let ringX = 0;
    let ringY = 0;

    // Visibility state
    let isVisible = false;

    // Hover state
    let isHovering = false;

    // Animation frame id
    let rafId: number;

    /**
     * Update cursor position with lerping - optimized for 60fps
     */
    function updateCursor(): void {
        // Higher lerp = snappier movement
        const cursorLerp = isHovering ? 0.25 : 0.2;
        const ringLerp = isHovering ? 0.15 : 0.1;

        cursorX += (mouseX - cursorX) * cursorLerp;
        cursorY += (mouseY - cursorY) * cursorLerp;

        ringX += (mouseX - ringX) * ringLerp;
        ringY += (mouseY - ringY) * ringLerp;

        // Use CSS custom properties for GPU-accelerated transforms
        cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
        cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;

        rafId = requestAnimationFrame(updateCursor);
    }

    /**
     * Mouse move handler
     */
    function onMouseMove(e: MouseEvent): void {
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (!isVisible) {
            isVisible = true;
            cursor.style.opacity = '1';
            cursorRing.style.opacity = '1';

            // Snap to position immediately on first move
            cursorX = mouseX;
            cursorY = mouseY;
            ringX = mouseX;
            ringY = mouseY;
        }
    }

    /**
     * Mouse leave handler
     */
    function onMouseLeave(): void {
        isVisible = false;
        cursor.style.opacity = '0';
        cursorRing.style.opacity = '0';
    }

    /**
     * Setup button hover effects - simplified, no GSAP overhead
     */
    function setupButtonEffects(): void {
        const buttons = document.querySelectorAll('.btn-primary, .btn-secondary, .magnetic');

        buttons.forEach((el) => {
            const element = el as HTMLElement;

            // Hover enter - use CSS classes for transitions (GPU accelerated)
            element.addEventListener('mouseenter', () => {
                isHovering = true;
                cursor.classList.add('custom-cursor--hover');
                cursorRing.classList.add('custom-cursor__ring--hover');
            });

            // Hover leave - reset
            element.addEventListener('mouseleave', () => {
                isHovering = false;
                cursor.classList.remove('custom-cursor--hover');
                cursorRing.classList.remove('custom-cursor__ring--hover');
            });
        });
    }

    /**
     * Link hover effects - lightweight
     */
    function setupLinkEffects(): void {
        const links = document.querySelectorAll('a:not(.btn-primary):not(.btn-secondary):not(.magnetic)');

        links.forEach((link) => {
            link.addEventListener('mouseenter', () => {
                cursorRing.classList.add('custom-cursor__ring--link');
            });

            link.addEventListener('mouseleave', () => {
                cursorRing.classList.remove('custom-cursor__ring--link');
            });
        });
    }

    // Bind events with passive flag for better scroll performance
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    // Setup hover effects
    setupButtonEffects();
    setupLinkEffects();

    // Start animation loop
    rafId = requestAnimationFrame(updateCursor);

    // Cleanup on navigation
    document.addEventListener('astro:before-swap', () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseleave', onMouseLeave);
        cancelAnimationFrame(rafId);
    });
}
