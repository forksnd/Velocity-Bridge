/**
 * particles.ts
 * Floating particle system that reacts to mouse movement.
 * Creates an "alive" feeling background like on premium sites.
 */

interface Particle {
    x: number;
    y: number;
    baseX: number;
    baseY: number;
    size: number;
    speedX: number;
    speedY: number;
    opacity: number;
    brightness: number; // For brightness variation (grayscale)
}

// Check system preferences
function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}


/**
 * Initialize the particle system
 */
export function initParticles(): void {
    // Skip only on reduced motion
    if (prefersReducedMotion()) {
        return;
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'particle-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
    `;
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configuration
    const config = {
        particleCount: window.innerWidth < 768 ? 30 : 60,
        mouseRadius: 150, // Radius of mouse influence
        returnSpeed: 0.02, // How fast particles return to base position
        driftSpeed: 0.3, // Natural drift speed
    };

    // State
    let particles: Particle[] = [];
    let mouseX = -1000;
    let mouseY = -1000;
    let rafId: number;
    let width = 0;
    let height = 0;

    /**
     * Setup canvas size
     */
    function setupCanvas(): void {
        const dpr = window.devicePixelRatio || 1;
        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        ctx!.setTransform(1, 0, 0, 1, 0, 0); // Reset transform matrix
        ctx!.scale(dpr, dpr);
    }

    /**
     * Create particles
     */
    function createParticles(): void {
        particles = [];

        for (let i = 0; i < config.particleCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;

            particles.push({
                x: x,
                y: y,
                baseX: x,
                baseY: y,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * config.driftSpeed,
                speedY: (Math.random() - 0.5) * config.driftSpeed,
                opacity: Math.random() * 0.5 + 0.2,
                brightness: Math.random() * 40 + 60, // 60-100% brightness (grayscale)
            });
        }
    }

    /**
     * Update particle positions
     */
    function update(): void {
        particles.forEach((p) => {
            // Calculate distance from mouse
            const dx = mouseX - p.x;
            const dy = mouseY - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If mouse is close, push particle away
            if (distance < config.mouseRadius && mouseX > 0) {
                const force = (config.mouseRadius - distance) / config.mouseRadius;
                const angle = Math.atan2(dy, dx);
                p.x -= Math.cos(angle) * force * 3;
                p.y -= Math.sin(angle) * force * 3;
            } else {
                // Natural drift
                p.x += p.speedX;
                p.y += p.speedY;

                // Slowly return to base position
                p.x += (p.baseX - p.x) * config.returnSpeed;
                p.y += (p.baseY - p.y) * config.returnSpeed;
            }

            // Wrap around screen edges
            if (p.baseX < 0) p.baseX = width;
            if (p.baseX > width) p.baseX = 0;
            if (p.baseY < 0) p.baseY = height;
            if (p.baseY > height) p.baseY = 0;
        });
    }

    /**
     * Render particles
     */
    function render(): void {
        ctx!.clearRect(0, 0, width, height);

        particles.forEach((p) => {
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx!.fillStyle = `hsla(0, 0%, ${p.brightness}%, ${p.opacity})`;
            ctx!.fill();
        });
    }

    /**
     * Animation loop
     */
    function animate(): void {
        update();
        render();
        rafId = requestAnimationFrame(animate);
    }

    /**
     * Mouse move handler
     */
    function onMouseMove(e: MouseEvent): void {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }

    /**
     * Mouse leave / Touch end handler
     */
    function onEnd(): void {
        mouseX = -1000;
        mouseY = -1000;
    }

    /**
     * Touch move handler
     */
    function onTouchMove(e: TouchEvent): void {
        if (e.touches.length > 0) {
            mouseX = e.touches[0].clientX;
            mouseY = e.touches[0].clientY;
        }
    }

    let lastWidth = window.innerWidth;

    /**
     * Resize handler
     */
    function onResize(): void {
        const newWidth = window.innerWidth;

        // Prevent re-initialization on mobile vertical scroll (URL bar toggle)
        // Only re-create if width changed significantly (orientation change)
        const widthChanged = Math.abs(newWidth - lastWidth) > 50;

        setupCanvas();

        if (widthChanged) {
            createParticles();
            lastWidth = newWidth;
        }
    }

    // Initialize
    setupCanvas();
    createParticles();

    // Bind events
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onEnd);
    document.addEventListener('touchstart', onTouchMove, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onEnd);

    let resizeTimeout: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(onResize, 200);
    });

    // Start animation
    rafId = requestAnimationFrame(animate);

    // Cleanup on navigation
    document.addEventListener('astro:before-swap', () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseleave', onEnd);
        document.removeEventListener('touchstart', onTouchMove);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onEnd);
        cancelAnimationFrame(rafId);
        canvas.remove();
    });
}
