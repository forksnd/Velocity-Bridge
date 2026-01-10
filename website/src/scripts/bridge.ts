/**
 * bridge.ts
 * Canvas-based particle system for the hero bridge animation.
 * Visualizes data flowing between iOS and Linux islands.
 */

interface Particle {
    x: number;
    y: number;
    vx: number;
    progress: number; // 0 to 1, position along the bridge
    radius: number;
    alpha: number;
    color: string;
    speed: number;
}

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if device is mobile
 */
function isMobile(): boolean {
    return window.matchMedia('(max-width: 768px)').matches;
}

/**
 * Initialize the bridge canvas animation
 */
export function initBridgeCanvas(): void {
    const canvas = document.getElementById('bridge-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Colors from design system
    const primaryColor = '#ffffff';
    const accentColor = '#888888';
    const colors = [primaryColor, accentColor];

    // Animation state
    let particles: Particle[] = [];
    let animationId: number | null = null;
    let isRunning = false;

    // Configuration
    const config = {
        particleCount: isMobile() ? 15 : 30,
        baseSpeed: 0.003,
        minRadius: 2,
        maxRadius: 4,
    };

    /**
     * Set up canvas size with device pixel ratio
     */
    function setupCanvas(): void {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        ctx!.scale(dpr, dpr);

        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
    }

    /**
     * Create initial particles
     */
    function createParticles(): void {
        particles = [];

        // Reduce particles if reduced motion
        const count = prefersReducedMotion() ? 8 : config.particleCount;

        for (let i = 0; i < count; i++) {
            particles.push(createParticle());
        }
    }

    /**
     * Create a single particle
     */
    function createParticle(): Particle {
        return {
            x: 0,
            y: 0,
            vx: 0,
            progress: Math.random(), // Random start position along bridge
            radius: config.minRadius + Math.random() * (config.maxRadius - config.minRadius),
            alpha: 0.4 + Math.random() * 0.4,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: config.baseSpeed * (0.7 + Math.random() * 0.6), // Vary speed
        };
    }

    /**
     * Update particle positions - ALWAYS horizontal
     */
    function update(): void {
        const rect = canvas.getBoundingClientRect();

        particles.forEach((p) => {
            // Move along the bridge
            p.progress += p.speed;

            // Reset when reaching the end
            if (p.progress > 1) {
                p.progress = 0;
                p.alpha = 0.4 + Math.random() * 0.4;
                p.speed = config.baseSpeed * (0.7 + Math.random() * 0.6);
            }

            // Calculate position - always horizontal
            p.x = p.progress * rect.width;
            p.y = rect.height / 2 + Math.sin(p.progress * Math.PI * 4) * 8;

            // Fade at edges
            const edgeFade = Math.min(p.progress * 5, (1 - p.progress) * 5, 1);
            p.alpha = (0.4 + Math.random() * 0.1) * edgeFade;
        });
    }

    /**
     * Render particles
     */
    function render(): void {
        const rect = canvas.getBoundingClientRect();

        // Clear canvas
        ctx!.clearRect(0, 0, rect.width, rect.height);

        // Draw bridge line (subtle gradient) - always horizontal
        const gradient = ctx!.createLinearGradient(0, 0, rect.width, 0);

        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.2, `${primaryColor}20`);
        gradient.addColorStop(0.5, `${primaryColor}40`);
        gradient.addColorStop(0.8, `${accentColor}20`);
        gradient.addColorStop(1, 'transparent');

        ctx!.beginPath();
        ctx!.moveTo(0, rect.height / 2);
        ctx!.lineTo(rect.width, rect.height / 2);
        ctx!.strokeStyle = gradient;
        ctx!.lineWidth = 2;
        ctx!.stroke();

        // Draw particles
        particles.forEach((p) => {
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx!.fillStyle = p.color;
            ctx!.globalAlpha = p.alpha;
            ctx!.fill();

            // Glow effect
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
            ctx!.fillStyle = p.color;
            ctx!.globalAlpha = p.alpha * 0.2;
            ctx!.fill();
        });

        ctx!.globalAlpha = 1;
    }

    /**
     * Animation loop
     */
    function animate(): void {
        if (!isRunning) return;

        update();
        render();

        animationId = requestAnimationFrame(animate);
    }

    /**
     * Start animation
     */
    function start(): void {
        if (isRunning) return;
        isRunning = true;

        // If reduced motion, just render static particles
        if (prefersReducedMotion()) {
            render();
            return;
        }

        animate();
    }

    /**
     * Stop animation
     */
    function stop(): void {
        isRunning = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    /**
     * Handle resize
     */
    function onResize(): void {
        setupCanvas();
        createParticles();
        if (!isRunning) {
            render();
        }
    }

    // Initialize
    setupCanvas();
    createParticles();
    start();

    // Handle resize with debounce
    let resizeTimeout: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(onResize, 150);
    });

    // Pause when not visible (performance)
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    start();
                } else {
                    stop();
                }
            });
        },
        { threshold: 0.1 }
    );

    observer.observe(canvas);

    // Cleanup on navigation
    document.addEventListener('astro:before-swap', () => {
        stop();
        observer.disconnect();
        window.removeEventListener('resize', onResize);
    });
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initBridgeCanvas);
    document.addEventListener('astro:after-swap', initBridgeCanvas);
}
