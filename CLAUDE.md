# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Merge is a unified messaging interface built with React 19 and TypeScript. It displays conversations from multiple messaging platforms (WhatsApp, Signal, Mail, SMS, Telegram, Slack, Teams, etc.) in a unified timeline view with AI-powered summarization via Google Gemini API.

## Development Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Production build
npm run preview  # Preview production build
```

## Environment Setup

Set `GEMINI_API_KEY` in `.env.local` for AI summarization features.

## Architecture

### Stack
- **React 19** with TypeScript
- **Vite** for bundling (dev server on port 3000)
- **Tailwind CSS** via CDN (configured in `index.html`)
- **Google GenAI SDK** for conversation summarization

### Key Files
- `App.tsx` - Main application component with all state management (messages, users, themes, search, AI summary)
- `types.ts` - Core type definitions: `Platform`, `User`, `Message`, `Attachment`, `PlatformConfig`
- `constants.ts` - Platform configuration (colors, labels) and dummy data (`USERS`, `INITIAL_MESSAGES`)
- `index.html` - Contains CSS theming system (dark/dimmed/light) and Tailwind setup

### Component Structure
| Component | Purpose |
|-----------|---------|
| `Sidebar.tsx` | User list, global search |
| `Composer.tsx` | Message input with platform selector, attachments, emoji picker |
| `GraphNode.tsx` | Individual message rendering with platform timeline visualization |
| `MediaGallery.tsx` | Shared media browser |
| `Lightbox.tsx` | Fullscreen image viewer |
| `PDFViewer.tsx` | PDF document viewer |
| `SettingsModal.tsx` | Theme and settings configuration |
| `EmojiPicker.tsx` | Emoji selection for composer |

### Theming System
CSS custom properties defined in `index.html` with three themes: `dark`, `dimmed`, `light`. Theme applied via `data-theme` attribute on `<html>`. Use `bg-theme-*`, `text-theme-*`, `border-theme` utility classes.

### Data Flow
- Messages filtered by selected user, sorted chronologically
- Platform visibility toggleable per user
- Search works globally (sidebar) and locally (within conversation)
- AI summary groups messages into "conversation blocks" based on time proximity

### Path Alias
`@/*` maps to project root (configured in `tsconfig.json` and `vite.config.ts`)
