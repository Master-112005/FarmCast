# Frontend Source Structure

This `src` folder is organized so you can quickly know where to put code.

## Main Folders

- `app/`
  - App bootstrapping, top-level providers, and routing shell.
- `pages/`
  - Screen-level views (one file per major screen).
- `components/`
  - Reusable UI pieces grouped by feature.
- `context/`
  - React context providers/hooks for app-wide state.
- `services/`
  - API and backend communication logic.
- `styles/`
  - Global and component CSS files.
- `utils/`
  - Constants and helper utilities.

## Components Folder (Feature-Based)

- `components/admin/`
- `components/buttons/`
- `components/chat/`
- `components/device/`
- `components/inputs/`
- `components/layout/`
- `components/navigation/`
- `components/notifications/`
- `components/profile/`
- `components/results/`

Rule: keep JSX/logic in `components/*` and keep CSS in `styles/components/*`.

## Styles Folder

- `styles/components.css`
  - Central CSS manifest that imports all component styles.
- `styles/components/shared/`
  - Shared style primitives (buttons, cards, forms, helpers, etc.).
- `styles/components/<feature>/`
  - Feature-specific component styles (`admin`, `device`, `profile`, etc.).

## Naming Rules

- Use lowercase folder names.
- Use `PascalCase` for React component files.
- Use kebab-case for CSS files.
- Keep related files grouped by feature.
