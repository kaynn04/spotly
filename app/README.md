# Synop — Personal Inventory & Lending Tracker

A React Native + Expo app for organizing, locating, and managing physical belongings across spaces, containers, and tracking lending to friends and family.

## 🚀 Quick Start

```bash
npm install
npx expo start -c
```

Press `i` for iOS simulator or `a` for Android emulator. Scan the QR code with Expo Go app.

## 📖 Documentation

For complete project documentation, architecture, roadmap, and development guidelines, see **[PROJECT.md](../PROJECT.md)** at the root of this repository.

## ✨ Features

- **Spaces & Containers**: Organize items into rooms and storage containers
- **Item Tracking**: Know exactly where each item is located
- **Lending Tracker**: Lend items to friends, track returns automatically
- **Outside Sessions**: Create checklists for items taken outside, ensure nothing is forgotten
- **Dark Mode**: Full light/dark theme support
- **Onboarding**: 5-slide welcome flow for first-time users

## 🏗️ Tech Stack

- **React Native** + **Expo Router** (file-based routing)
- **TypeScript** (strict mode)
- **SQLite** (expo-sqlite)
- **Font Awesome** icons
- **Responsive Design** (works on phone & tablet)

## 📁 Project Structure

See [PROJECT.md — Architecture section](../PROJECT.md#️-architecture) for detailed folder breakdown.

**Key directories:**
- `app/` — Expo Router file-based routes
- `src/services/` — Business logic layer
- `src/repositories/` — Data access layer
- `src/features/` — Feature-specific code (lending, outside, etc.)

## 🎯 Development Workflow

1. **Create/edit feature** in appropriate folder
2. **Add database migrations** if needed (src/db/migrations.ts)
3. **Test on device**: `npx expo start -c`
4. **Commit with message** referencing feature spec (e.g., `feat: Add item duplicate check #004`)

## 📱 Active Branch

**Current**: `022-outside-mainscreen-enhancement`

See [PROJECT.md — Current Branch](../PROJECT.md#-current-branch--workflow) for latest changes.

## 🔗 More Info

- **Full Documentation**: [PROJECT.md](../PROJECT.md)
- **Feature Specs**: [specs/](../specs/) folder
- **Expo Docs**: https://docs.expo.dev
- **React Native**: https://reactnative.dev

