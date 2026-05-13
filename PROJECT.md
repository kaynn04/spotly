# Synop — Personal Inventory & Lending Tracker

**Version**: 1.0 (MVP)  
**Status**: Active Development  
**Platform**: React Native + Expo Router  
**Created**: May 2026  

---

## 📋 Project Overview

**Synop** is a mobile-first inventory tracking app that helps users organize, locate, and manage their physical belongings. It tracks items across multiple spaces (rooms/locations), containers (boxes/drawers), and supports lending items to friends and family with automatic tracking of returns. The app also includes an "Outside Session" feature for tracking items temporarily taken outside the home.

### Core Problems Solved
- **Where is it?** Know exactly which space, container, and shelf your item is on
- **Who has it?** Track who borrowed your items and automatically remind when they're due back
- **Did I bring it?** Create checklist sessions when taking items outside, ensure everything comes back

---

## ✅ Current Features (Implemented)

### ✓ 001 — Create & Manage Spaces
- Create new spaces (rooms, locations) with names
- View all spaces in a gallery/list
- Delete spaces (with cascade rules for items/containers)
- Edit space details

### ✓ 002 — View Space Details
- See all items and containers in a space
- Organized view: root items + grouped containers
- Quick item count and status indicators

### ✓ 003 — Delete Space
- Confirm deletion workflow
- Cascade handling: items and containers deleted automatically
- Undo prevention (by design) — destructive action alerts user

### ✓ 004 — Add Items
- Create items in a space (root or inside a container)
- Add item properties: name, description (optional), quantity
- Duplicate prevention: warn if item name exists in same space

### ✓ 005 — Move Items
- Move items between spaces and containers
- Full navigation: see all destinations (spaces, containers)
- Current location shown inline as disabled row with "Here" badge
- Batch move support (future enhancement)

### ✓ 006 — Delete Items
- Remove items from inventory
- Confirm workflow with item name in dialog
- Automatic cleanup of associated lendings (cascade)

### ✓ 007 — Container Detail View
- View items inside a specific container
- Move items between containers in same space or across spaces
- Add items directly to container
- Full CRUD on container contents

### ✓ 008 — Dashboard Navigation
- Tab-based navigation: Spaces, Lending, Outside, Account
- Persistent bottom tab bar (FloatingTabBar)
- Welcome screen with personalized greeting
- Onboarding flow (5 slides) for first-time users

### ✓ 009 — Lending Tracker
- Lend items to borrowers with name + optional note
- View active lendings (in-progress loans)
- Mark lendings as returned (with optional return notes)
- Lending history (active + returned)
- Duplicate active lending prevention
- Status badges: "In Progress", "Returned"

### ✓ 010 — Outside Sessions
- Create "outside sessions" — temporary item checklists
- Add items from inventory to session
- Mark items as completed when checked off
- Progress bar: visual feedback on session completion
- Session detail screen with item checklist
- Complete session button (only when 100% done)
- Session history: view past completed sessions with dates
- Item already-in-session prevention

---

## 🏗️ Architecture

### File Structure
```
app/
├── app/                              # Expo Router file-based routes
│   ├── _layout.tsx                   # Root navigation + DB init + onboarding check
│   ├── onboarding.tsx                # 5-slide welcome + name input
│   ├── (tabs)/                       # Tab-based navigation
│   │   ├── _layout.tsx               # Tab router
│   │   ├── index.tsx                 # Spaces tab (home)
│   │   ├── lending.tsx               # Lending tracker tab
│   │   ├── outside.tsx               # Outside sessions tab
│   │   └── spaces.tsx                # Search/browse all spaces (future)
│   ├── item/[id].tsx                 # Item detail + move modal
│   ├── space/[id].tsx                # Space detail + item list
│   ├── container/[id].tsx            # Container detail + item list
│   └── outside/                      # Outside feature routes
│       ├── [id].tsx                  # Session detail
│       └── history.tsx               # Past sessions
├── assets/images/                    # App icons, logo
├── components/                       # Shared React components
├── constants/theme.ts                # Colors, fonts, theme
├── hooks/                            # Custom hooks
├── src/
│   ├── context/                      # React Context (if needed)
│   ├── db/
│   │   ├── client.ts                 # expo-sqlite singleton
│   │   ├── index.ts                  # DB exports
│   │   └── migrations.ts             # Schema + migration logic
│   ├── models/                       # TypeScript interfaces
│   │   ├── Space.ts
│   │   ├── Item.ts
│   │   └── Container.ts
│   ├── repositories/                 # Data access layer
│   │   ├── SpaceRepository.ts
│   │   ├── ItemRepository.ts
│   │   └── ContainerRepository.ts
│   ├── services/                     # Business logic layer
│   │   ├── SpaceService.ts
│   │   ├── ItemService.ts
│   │   ├── ContainerService.ts
│   │   └── UserService.ts
│   ├── features/                     # Feature-specific code
│   │   ├── lending/
│   │   │   ├── models/Lending.ts
│   │   │   ├── repositories/LendingRepository.ts
│   │   │   ├── services/LendingService.ts
│   │   │   ├── screens/LendingPage.tsx
│   │   │   └── components/LendingFormModal.tsx
│   │   ├── outside/
│   │   │   ├── models/OutsideSession.ts
│   │   │   ├── repositories/OutsideSessionRepository.ts
│   │   │   ├── services/OutsideSessionService.ts
│   │   │   ├── screens/OutsidePage.tsx
│   │   │   ├── screens/SessionDetailScreen.tsx
│   │   │   └── components/SessionFormModal.tsx
│   │   ├── spaces/
│   │   │   ├── screens/SpacesPage.tsx
│   │   │   └── components/ItemFormModal.tsx
│   │   └── home/
│   │       └── screens/HomeScreen.tsx
│   └── utils/
│       ├── uuid.ts                   # ID generation
│       └── validators.ts
└── package.json
```

### Data Flow: Repository → Service → Screen
```
Screen Component
    ↓ (calls)
Service (static class with business logic)
    ↓ (uses)
Repository (static class with DB queries)
    ↓ (queries)
Database (SQLite via expo-sqlite)
```

**Example**: Lending an item
1. User taps "Lend" button on item → opens LendingFormModal
2. Modal calls `LendingService.createLending(itemId, borrowerName, note)`
3. Service validates, then calls `LendingRepository.createLending()`
4. Repository executes SQL INSERT, returns lending record
5. Screen refreshes lending list via `LendingService.getActiveLendings()`

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | React Native + Expo | Latest |
| **Router** | Expo Router | File-based |
| **Language** | TypeScript | Strict mode |
| **UI Components** | React Native (built-in) | - |
| **Icons** | Font Awesome | @fortawesome/react-native-fontawesome |
| **Database** | SQLite | expo-sqlite |
| **State** | AsyncStorage | Local user prefs + onboarding flag |
| **Styling** | Inline StyleSheet.create | No external CSS library |
| **Safe Area** | react-native-safe-area-context | - |
| **Dev Server** | Expo CLI | npx expo start -c |

---

## 🎨 Design System

### Colors
```typescript
PRIMARY = '#6b7f99'        // Muted blue-grey (brand)
LENDING = '#9b72cb'        // Purple (active lending status)
SUCCESS = '#6b9e7a'        // Green (complete/success, returned status)
DESTRUCTIVE = '#e53e3e'    // Red (delete/danger)

// Dark mode colors
Dark Background: '#000000'
Dark Card: '#1c1c1e'
Dark Border: '#2c2c2e'
Dark Text (subtle): '#8e8e93'

// Light mode colors
Light Background: '#f8f9fa'
Light Card: '#ffffff'
Light Border: '#e2e6ea'
Light Text (subtle): '#a0aec0'
```

### Iconography
```typescript
faMapPin           // Space root
faFolder           // Container
faBox              // Item (or item in container)
faHandshake        // Lending
faSuitcase         // Outside sessions
faChevronLeft      // Back
faEllipsisVertical // More actions
faTrash            // Delete
```

### Typography
- **Title**: fontSize 28, fontWeight '700', letterSpacing -0.5
- **Section Label**: fontSize 11, fontWeight '600', letterSpacing 0.8, uppercase
- **Body**: fontSize 15-16, fontWeight '500'
- **Small**: fontSize 13, fontWeight '500'

### Component Patterns
- **Bottom Sheets**: Modal with slide animation, semi-transparent overlay
- **Disabled Rows**: opacity 0.6, onPress={undefined}, activeOpacity={1}, "Here" badge
- **Tappable Rows**: paddingVertical 14, borderRadius 10, borderWidth 1, gap 12
- **No external UI library** — all styles inline via `StyleSheet.create()`

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and **npm** 9+
- **Expo CLI**: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Emulator

### Installation
```bash
cd synop/app

# Install dependencies
npm install

# Start dev server
npx expo start -c

# In simulator or Expo Go app, scan the QR code or press 'i' (iOS) / 'a' (Android)
```

### Database Setup
- Database initializes automatically on first app launch
- Migrations run via `initializeDatabase()` in `_layout.tsx`
- See `src/db/migrations.ts` for schema

### Reset Project (if needed)
```bash
npm run reset-project
```

---

## 📱 Current Branch & Workflow

**Active Branch**: `031-overall-improvements`

### Recent Changes (Session Notes - May 11, 2026)

#### Dashboard Navigation Improvements
- Recently Added items now show **current location** (space › container) instead of creation location
- Recently Added items navigate to container or space based on current location
- Query updated: `ItemRepository.getRecentItems()` now joins containers table to fetch current container name
- Matches Recently Moved section design pattern for consistency

#### Outside Sessions Auto-Return Behavior
- When completing a session with unchecked items, they are now **automatically returned to original locations**
- Items are moved back to their original space/container, then checked off
- Alert message updated: "Return Unchecked Items — will be returned to its/their original location(s). Continue?"
- OutsideSessionItemWithContext now includes `spaceId` and `containerId` for original location tracking

#### Database & Service Architecture Fixes
- Fixed DashboardService initialization error: changed from type-only imports to runtime imports
- Removed `initialize()` method from DashboardService; now calls repository static methods directly
- Added retry logic to `db/client.ts` to handle stale database handles in development
- Resolved "The 2nd argument cannot be cast to expo.modules.sqlite.NativeStatement" error

---

## 🗺️ Roadmap

### Phase 2 (Next Sprint)
- [ ] **Search & Filter**: Full-text search for items across all spaces
- [ ] **Batch Operations**: Move multiple items at once, bulk delete
- [ ] **Export/Backup**: Export inventory to CSV or cloud backup
- [ ] **QR Codes**: Generate QR per item/container for quick lookup
- [ ] **Item Photos**: Attach images to items for visual identification

### Phase 3 (Later)
- [ ] **Sharing**: Share spaces/containers with family members (read-only or edit)
- [ ] **Notifications**: Reminders for returned items, lending expiry
- [ ] **Advanced Analytics**: Item value tracking, most-lent items, lending stats
- [ ] **Web Sync**: Companion web app for desktop browsing/editing
- [ ] **Cloud Sync**: Optional cloud backup and cross-device sync

### Known Limitations (Intentional)
- No user authentication (single-user app)
- No cloud storage (local DB only — privacy first)
- No app-to-app sharing (could be added in Phase 2)

---

## 🧪 Testing & QA

### Manual Testing Checklist
- [ ] **Onboarding**: 5 slides display correctly, name input works, greeting shows on home
- [ ] **Spaces**: Create, view, delete space → items cascade
- [ ] **Containers**: Create, view, move items in/out
- [ ] **Items**: Create, move between spaces/containers, lend, delete
- [ ] **Lending**: Lend item → appears in active lending list → mark returned
- [ ] **Outside Sessions**: Create session, add items, check off items, complete session
- [ ] **Dark Mode**: All colors adapt (light/dark)
- [ ] **Tablet/Landscape**: Layout responsive, no crashes

### Known Issues
None currently tracked in production branch.

---

## 📝 Code Standards

### Naming Conventions
```typescript
// Components: PascalCase
SpaceListScreen, ItemFormModal, LendingPage

// Functions: camelCase
handleMoveToSpace, loadActiveLendings, confirmDeleteItem

// Constants: UPPER_SNAKE_CASE
PRIMARY = '#6b7f99'
ONBOARDING_DONE_KEY = '@synop/onboarding_done'

// Interfaces: PascalCase, no 'I' prefix
type Space = { id: string; name: string; ... }
```

### Style Guidelines
- Use **Repository → Service → Screen** layering
- Keep screens under 500 lines (break into components)
- Minimize state lifting; use local state when possible
- Use `useCallback` with `eslint-disable-line react-hooks/exhaustive-deps` for complex dependencies
- Always wrap DB calls in try/catch
- Export static class methods, not instances: `SpaceService.getSpaceById()`

### TypeScript
- Strict mode enabled
- No `any` without comment explaining why
- Export types from model files, import in screens/services

---

## 🔐 Privacy & Security

- **No cloud sync**: All data stored locally on device
- **No analytics**: No tracking, no telemetry
- **No authentication**: Single-user app (no login)
- **Data persistence**: AsyncStorage for flags, SQLite for inventory
- **No network requests**: App works fully offline

---

## 📞 Support & Contributions

### For Feature Requests
1. Check [specs/](/specs/) folder for detailed feature specs
2. Create new issue with user story format
3. Reference this roadmap

### For Bug Reports
1. Test on latest dev server: `npx expo start -c`
2. Include device type, OS version, reproduction steps
3. Check `get_errors` in VS Code for compile errors

### For Code Changes
1. Create feature branch: `git checkout -b 0NN-feature-name`
2. Follow naming conventions above
3. Test on device/simulator
4. Commit with descriptive message
5. Create pull request with spec reference

---

## 📚 Additional Resources

- **Specs**: See `specs/` folder for detailed feature specifications (specs/NNN-feature-name/spec.md)
- **Plans**: Implementation plans: `specs/NNN-feature-name/plan.md`
- **Data Models**: `src/models/` folder for TypeScript interfaces
- **Database Schema**: `src/db/migrations.ts`
- **Expo Docs**: https://docs.expo.dev
- **React Native Docs**: https://reactnative.dev

---

**Last Updated**: May 11, 2026  
**Active Developers**: You  
**Current Focus**: Dashboard navigation improvements, outside session enhancements, Play Store submission polish
