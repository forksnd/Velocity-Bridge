import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    // GitHub Pages deployment config
    site: 'https://trex099.github.io',
    base: '/Velocity-Bridge',

    // Output config
    output: 'static',

    build: {
        // Avoid underscore-prefix issues with Jekyll
        assets: '_assets',
        // Inline small assets for performance
        inlineStylesheets: 'auto'
    },

    // Integrations
    integrations: [
        sitemap()
    ],

    // Vite config for SCSS
    vite: {
        css: {
            preprocessorOptions: {
                scss: {
                    // Make variables available in all SCSS files
                    additionalData: `@use "src/styles/_variables" as *;`
                }
            }
        },
        build: {
            // Target modern browsers only
            target: 'esnext'
        }
    },

    // Prefetch for instant navigation
    prefetch: {
        prefetchAll: true,
        defaultStrategy: 'viewport'
    }
});
