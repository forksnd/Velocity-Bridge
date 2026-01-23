/**
 * glow.ts
 * Ambient floating background orbs that subtly react to mouse movement.
 * Creates a parallax effect - orbs shift slightly as you move the mouse.
 */

// Check system preferences
function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hasCoarsePointer(): boolean {
    return window.matchMedia('(pointer: coarse)').matches;
}

interface Orb {
    element: HTMLElement;
    baseX: number;
    baseY: number;
    parallaxFactor: number;
}

/**
 * Initialize the ambient background effect
 */
export function initGlowEffect(): void {
    // Skip on touch devices or reduced motion
    if (hasCoarsePointer() || prefersReducedMotion()) {
        return;
    }

    // Create container for orbs
    const container = document.createElement('div');
    container.className = 'ambient-bg';
    container.setAttribute('aria-hidden', 'true');
    document.body.appendChild(container);

    // Create multiple orbs at fixed positions
    const orbConfigs = [
        { x: 15, y: 20, size: 400, color: 'primary', parallax: 0.02 },
        { x: 85, y: 70, size: 350, color: 'accent', parallax: 0.015 },
        { x: 50, y: 80, size: 300, color: 'mixed', parallax: 0.01 },
    ];

    const orbs: Orb[] = orbConfigs.map((config) => {
        const orb = document.createElement('div');
        orb.className = `ambient-orb ambient-orb--${config.color}`;
        orb.style.width = `${config.size}px`;
        orb.style.height = `${config.size}px`;
        orb.style.left = `${config.x}%`;
        orb.style.top = `${config.y}%`;
        container.appendChild(orb);

        return {
            element: orb,
            baseX: config.x,
            baseY: config.y,
            parallaxFactor: config.parallax,
        };
    });

    // Track mouse position
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let targetX = mouseX;
    let targetY = mouseY;

    let rafId: number;

    /**
     * Update orb positions with parallax effect
     */
    function updateOrbs(): void {
        // Smooth lerp for mouse tracking
        mouseX += (targetX - mouseX) * 0.03;
        mouseY += (targetY - mouseY) * 0.03;

        // Calculate offset from center
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const offsetX = mouseX - centerX;
        const offsetY = mouseY - centerY;

        // Apply parallax to each orb
        orbs.forEach((orb) => {
            const shiftX = offsetX * orb.parallaxFactor;
            const shiftY = offsetY * orb.parallaxFactor;
            orb.element.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
        });

        rafId = requestAnimationFrame(updateOrbs);
    }

    /**
     * Mouse move handler
     */
    function onMouseMove(e: MouseEvent): void {
        targetX = e.clientX;
        targetY = e.clientY;
    }

    // Bind events
    document.addEventListener('mousemove', onMouseMove, { passive: true });

    // Start animation loop
    rafId = requestAnimationFrame(updateOrbs);

    // Cleanup on navigation
    document.addEventListener('astro:before-swap', () => {
        document.removeEventListener('mousemove', onMouseMove);
        cancelAnimationFrame(rafId);
        container.remove();
    });
}
