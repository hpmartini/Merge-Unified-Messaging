# PRD-004: Testing Foundation

## 1. Overview
As part of Phase 2 (Architecture Cleanup), we need a robust testing foundation for the frontend. Currently, we lack automated unit and component tests. This PRD outlines the setup of Vitest and React Testing Library to ensure future features do not break existing functionality.

## 2. Goals
- Introduce a modern, fast testing framework (Vitest) compatible with our Vite setup.
- Configure DOM testing capabilities (jsdom/happy-dom) and React Testing Library.
- Provide a basic test suite as a blueprint for future development.
- Ensure tests can run seamlessly in CI/CD environments.

## 3. Phases
### Phase 1: Tooling & Configuration
- Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, and a DOM environment (`jsdom` or `happy-dom`).
- Update `vite.config.ts` (or add `vitest.config.ts`) to support testing.
- Add test scripts to `package.json` (`test`, `test:ui`, `test:coverage`).

### Phase 2: Blueprint Tests
- Write a test for the newly created `useAppStore` (state management).
- Write a basic component test (e.g., verifying `Profile.tsx` or `Sidebar.tsx` renders without crashing).

### Phase 3: Validation
- Ensure `npm run test` executes perfectly.
- Provide documentation (e.g., in README) on how to run tests.

## 4. Success Criteria
- Test runner executes successfully via CLI.
- At least two passing tests (one logic, one component) exist.
- No disruptions to the existing `npm run dev` or `npm run build` workflows.
