# UI coding standards

## Required UI library

**Only shadcn/ui components may be used for UI throughout this project. Absolutely no custom UI components may be created.**

This rule applies to every route, layout, form, navigation area, authentication screen, dashboard, dialog, and loading, empty, error, or success state. It applies to new work and changes to existing UI.

- Use official shadcn/ui components directly from `@/components/ui/*`.
- If a required component is missing, add the official shadcn/ui component using the project's installed shadcn CLI and existing `components.json` configuration.
- Do not create handwritten UI primitives, custom feature components, wrappers, forks, or replacement components. Names such as `MealCard`, `AppButton`, or `CustomDialog` do not make custom UI acceptable.
- Do not introduce another UI library, third-party registry components, or prebuilt vendor UI, including authentication widgets. Use service SDKs for logic and compose the visible interface with shadcn/ui.
- Do not use Base UI or other underlying primitives directly in application UI. Those dependencies belong inside official shadcn/ui implementations.
- If shadcn/ui does not support a requirement, adjust the design to its available components. Do not implement a custom substitute.

Existing noncompliant UI is not a precedent or an exception. Bring affected UI into compliance when modifying it. This document defines the standard; it does not indicate that all existing screens already comply.

## Component source and organization

- `components/ui/` is reserved for official shadcn/ui component source added through the configured CLI. Its checked-in React implementations are permitted because they are official shadcn/ui components, not custom project components.
- Keep generated component APIs, variants, behavior, and accessibility intact. Do not add project-specific variants or logic to these files or rewrite their internals into custom components.
- Compose installed components directly in Next.js pages and layouts. Framework-required route files, providers, and rendering boundaries are permitted infrastructure; they must not become a separate custom UI library.
- Do not extract visual compositions into custom reusable components, even when they consist entirely of shadcn/ui components. Reuse hooks, data functions, validation, and other nonvisual logic instead.
- Use TypeScript and the components' existing prop types. Avoid `any`, casts that bypass prop validation, and unsupported props.
- Before changing Next.js rendering or component boundaries, read the relevant documentation in `node_modules/next/dist/docs/` as required by `AGENTS.md`.

## Project configuration

Use `components.json` as the source of truth for component generation. The current configuration uses:

- The `base-nova` style and neutral base color.
- CSS variables and Tailwind styles in `app/globals.css`.
- The `@/components/ui` import alias.
- Lucide icons.

Do not mix component styles or change generator settings to introduce a second design system. Use the configured implementation's API rather than copying examples intended for another shadcn/ui style or primitive library.

## Composition and styling

- Prefer the components' existing props, variants, sizes, and documented composition patterns.
- Use Tailwind utilities for layout, spacing, responsive sizing, and alignment. Do not use utility classes, inline styles, CSS modules, or global selectors to build custom controls or imitate missing components.
- Use semantic theme tokens such as `bg-background`, `text-foreground`, `text-muted-foreground`, and `border-border`. Keep shared theme values in `app/globals.css`; avoid hardcoded colors and per-screen themes.
- Preserve the standard component appearance and interaction states. Do not override component internals, remove focus indicators, or create new visual variants through `className`.
- Native HTML is limited to document structure, semantic text, media, and form containers where needed. It must not implement a custom UI control or visual widget. For example, use shadcn/ui `Button`, `Input`, and `Select` instead of handwritten buttons, inputs, or selects.
- Framework navigation and image utilities may provide routing and media behavior. Use shadcn/ui for any surrounding control or widget styling; do not hand-style links into custom buttons.
- Lucide icons are supporting assets, not standalone controls. Place interactive icons inside shadcn/ui components and provide accessible names.

## Forms and interaction

- Build fields, labels, validation messages, selection controls, and submission actions with the appropriate official shadcn/ui components.
- Keep application state, event handlers, validation, and service calls in route logic or nonvisual modules. Pass data and handlers through supported component props.
- Use shadcn/ui components for dialogs, menus, tooltips, notifications, and other interactive surfaces. Preserve their supported trigger and content composition.
- Represent loading, empty, error, and success states with appropriate shadcn/ui components, such as `Skeleton`, `Empty`, or `Alert`, adding them through the CLI when needed.
- Make pending and disabled states clear, prevent duplicate submissions, and provide useful validation and error text.
- Authentication and account actions follow the same rules: use SDK behavior with shadcn/ui controls, rather than vendor-rendered sign-in forms, account menus, or custom controls.

## Accessibility and responsive behavior

- Preserve keyboard interaction, focus management, labels, and ARIA behavior supplied by shadcn/ui.
- Give every field an associated label and every icon-only action an accessible name. Include required dialog titles and descriptions, and associate validation messages with their fields.
- Use correct heading hierarchy and semantic landmarks in route markup. Do not replace interactive components with clickable containers.
- Keep layouts usable on narrow and wide screens, prevent unintended overflow, and ensure controls remain reachable.
- Check supported light and dark themes, visible focus, text contrast, and loading, disabled, and error states.

## Review requirements

Before completing a UI change, verify that:

- Every UI control and widget comes from official shadcn/ui source under `components/ui/`.
- No custom UI component, wrapper, third-party widget, or handcrafted control was introduced.
- Styling uses existing component options and shared theme tokens without creating a separate design system.
- Keyboard use, accessible labels, responsive layouts, and relevant interaction states work.
- `npm run lint` and `npm run typecheck` pass for code changes. Run relevant existing tests and a production build when the change affects rendering or integration.

These standards are mandatory. Convenience, visual similarity, and existing noncompliant code do not justify custom UI components.
