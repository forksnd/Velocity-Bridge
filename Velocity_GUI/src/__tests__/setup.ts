import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock all Tauri plugins before any component imports
vi.mock('@tauri-apps/plugin-shell', () => ({
    Command: {
        sidecar: vi.fn(() => ({ spawn: vi.fn() })),
        create: vi.fn(() => ({ execute: vi.fn() })),
    },
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
    openUrl: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
    check: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
    relaunch: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-autostart', () => ({
    enable: vi.fn(),
    disable: vi.fn(),
    isEnabled: vi.fn(() => Promise.resolve(false)),
}));

// Mock fetch to prevent real network requests
globalThis.fetch = vi.fn(() =>
    Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
    } as Response)
);
