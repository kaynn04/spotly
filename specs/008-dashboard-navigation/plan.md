# Implementation Plan: Dashboard Navigation Structure

**Branch**: `008-dashboard-navigation` | **Date**: May 6, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification for dashboard-based navigation with persistent bottom tabs

## Summary

Refactor the Spotly app from a single-screen space-management interface to a multi-tab dashboard experience. Create a bottom tab navigation bar with four sections (Home, Spaces, Lending, Outside) using Expo Router's built-in tabs layout. The Home tab displays an overview dashboard with recently added items and statistics. The Spaces tab preserves all existing space/container/item functionality. Lending and Outside tabs are placeholder screens for future feature expansion. This establishes a scalable navigation foundation for the app while maintaining backward compatibility with all existing features.

## Technical Context

**Language/Version**: TypeScript 5.x with React Native (Expo)  
**Primary Dependencies**: React Native, Expo, Expo Router (v2+), expo-sqlite, react-native-safe-area-context  
**Storage**: expo-sqlite (local SQLite database)  
**Testing**: Jest/Vitest (not in MVP scope)  
**Target Platform**: iOS/Android via React Native  
**Project Type**: Mobile app (Expo)  
**Performance Goals**: Tab transitions <500ms, home dashboard loads <1s (even with 500+ items)  
**Constraints**: Local-first, offline-capable, single-user, no authentication, no cloud sync  
**Scale/Scope**: Single space app with nested containers (up to 50+ containers, 500+ items)

## Constitution Check

**Status**: ✅ PASS

- ✅ Spec-Driven: Feature spec completed and clarified (5 questions resolved)
- ✅ Simplicity First: MVP scope focused on navigation structure only; Lending/Outside are placeholders
- ✅ Vertical Slice: Navigation architecture touches UI layer (tabs) and Service/UI integration for data fetching
- ✅ Local-First: Dashboard data pulled from existing SQLite; no new API integration
- ✅ Clean Layers: Uses existing Service → Repository → SQLite pattern for dashboard data
- ✅ TypeScript Strict: All navigation types explicit, no `any`
- ✅ No ORMs: Dashboard queries use existing parameterized SQL repositories

**Violations**: None | **Justifications**: N/A

## Project Structure

### Documentation (this feature)

```text
specs/008-dashboard-navigation/
├── plan.md              # This file (implementation planning)
├── spec.md              # Feature specification with clarifications
├── research.md          # Phase 0 (none needed - no major unknowns)
├── data-model.md        # Phase 1 (no new entities - reuses Space/Item/Container)
├── quickstart.md        # Phase 1 implementation walkthrough
├── contracts/           # Phase 1 contracts (navigation interfaces)
│   └── dashboard-service.ts
└── checklists/
    └── requirements.md
```

### Source Code (mobile app structure)

**Routing**: Expo Router tabs layout
```text
app/
├── (tabs)/                    # NEW - Tab navigation layout
│   ├── _layout.tsx            # NEW - Tabs routing configuration
│   ├── index.tsx              # NEW - Home dashboard screen
│   ├── spaces.tsx             # NEW - Spaces tab (wrapper)
│   ├── lending.tsx            # NEW - Lending placeholder screen
│   └── outside.tsx            # NEW - Outside placeholder screen
│
├── space/
│   └── [id].tsx               # EXISTING - Space detail (nested under spaces route)
│
├── container/
│   └── [id].tsx               # EXISTING - Container detail (nested under spaces route)
│
├── _layout.tsx                # MODIFIED - Update app root layout
├── app.json                   # EXISTING - No changes (edgeToEdgeEnabled already set)
├── modal.tsx                  # EXISTING - No changes
└── (tabs)/explore.tsx         # MIGRATE - Deprecated; consolidate into new tabs
```

**Services**: Dashboard-specific utilities
```text
src/
├── services/
│   ├── ContainerService.ts    # EXISTING
│   ├── ItemService.ts         # EXISTING - Add getDashboardRecentItems()
│   ├── SpaceService.ts        # EXISTING
│   ├── DashboardService.ts    # NEW - Home dashboard data aggregation
│   └── NavigationService.ts   # NEW - Tab state and navigation helpers (optional)
│
├── repositories/              # EXISTING - No changes
│   ├── ContainerRepository.ts
│   ├── ItemRepository.ts
│   └── SpaceRepository.ts
│
├── models/                    # EXISTING - No changes
│   ├── Container.ts
│   ├── Item.ts
│   └── Space.ts
│
└── db/                        # EXISTING - No schema changes
    ├── client.ts
    ├── index.ts
    └── migrations.ts
```

**Components**: Reuse existing components, create dashboard-specific ones
```text
components/
├── breadcrumb.tsx             # EXISTING - Reused in space/container detail
├── themed-*.tsx               # EXISTING - Theme components
├── parallax-scroll-view.tsx   # EXISTING
├── dashboard/                 # NEW - Dashboard-specific components
│   ├── recently-added-card.tsx
│   ├── stats-card.tsx
│   ├── empty-state.tsx
│   └── home-dashboard.tsx     # Main home dashboard component
└── [other existing components]
```

**Structure Decision**: Mobile app using Expo Router with tab-based navigation. Tab routes wrap existing screens and create new dashboard views. Services are enhanced with dashboard-specific data aggregation methods. No database schema changes needed.

## Complexity Tracking

No Constitution violations. This is a straightforward navigation refactoring that:
- Preserves existing business logic (no rewrites)
- Reuses existing screens and services
- Adds UI layer improvements (tabs, home dashboard)
- Maintains offline-first, local-first architecture

## Phases

### Phase 0: Research & Unknowns

**Status**: ✅ COMPLETE (No critical unknowns)

**Clarifications Resolved** (in spec):
1. ✅ Back button behavior from nested views (return to Spaces tab root)
2. ✅ Empty state display (encouraging onboarding messages)
3. ✅ Tab visual indicators (icons + text labels)
4. ✅ Recently added items context (name + space)
5. ✅ Quick action button strategy (none - rely on Spaces tab)

**Assumptions Verified**:
- Expo Router v2+ supports tabs layout ✅
- Recent items query can be efficiently fetched from existing repositories ✅
- Statistics (item count, space count) are simple aggregations ✅

**Output**: No separate research.md needed (all clarifications in spec)

---

### Phase 1: Design & Architecture

**Deliverables**: data-model.md, contracts/dashboard-service.ts, quickstart.md

#### 1.1 Data Model (No Database Changes)

**Dashboard Dashboard** (computed view, not persisted):
- `recentItems: Item[]` - 5 most recent items across all spaces, sorted by created_at DESC
- `totalItemCount: number` - COUNT(*) from items table
- `totalSpaceCount: number` - COUNT(*) from spaces table
- `totalContainerCount: number` - COUNT(*) from containers table

**Reuses Existing Entities**:
- Space (from feature 001)
- Item (from feature 001)
- Container (from feature 007)

**No Schema Changes**: Dashboard data is computed from existing tables via queries.

#### 1.2 Service Layer Design

**New DashboardService.ts**:
```typescript
class DashboardService {
  async getRecentItems(limit: number = 5): Promise<Item[]>
    // SELECT * FROM items ORDER BY created_at DESC LIMIT ?
  
  async getDashboardStats(): Promise<{
    totalItems: number
    totalSpaces: number
    totalContainers: number
  }>
    // COUNT queries from repositories
  
  async getFullDashboard(): Promise<Dashboard>
    // Aggregate recentItems + stats
}
```

**Enhanced ItemService.ts**:
- Add `getItemsBySpaceId()` method if needed for dashboard context display

**Navigation Service** (optional, can be skipped for MVP):
- Helper for managing tab state
- Can defer to Phase 2

#### 1.3 UI/Component Design

**Tabs Layout Structure** (`app/(tabs)/_layout.tsx`):
```
TabsLayout
  ├── Home Tab → DashboardScreen (index.tsx)
  ├── Spaces Tab → SpacesScreen (spaces.tsx)
  ├── Lending Tab → PlaceholderScreen (lending.tsx)
  └── Outside Tab → PlaceholderScreen (outside.tsx)
```

**Home Dashboard Screen** (`index.tsx`):
- Header: "Dashboard" or logo
- RecentlyAddedCard: Shows 5 most recent items (name • space format)
- StatsCard: Total items, spaces, containers
- EmptyState: If no spaces exist (onboarding message)
- ScrollView for vertical scrolling

**Spaces Screen** (`spaces.tsx`):
- Wrapper that routes to existing `app/(tabs)/index.tsx` or creates new container
- Displays spaces list with ability to create space
- Preserves all existing space detail navigation

**Lending/Outside Screens** (`lending.tsx`, `outside.tsx`):
- PlaceholderScreen component with "Coming Soon" message
- Prepared for future feature expansion in 009+

#### 1.4 Navigation Architecture

**Route Structure** (Expo Router):
```
/ (app root)
├── (tabs) → Bottom tab navigation wrapper
│   ├── / → Home Dashboard
│   ├── spaces → Spaces Management
│   ├── lending → Lending (placeholder)
│   └── outside → Outside (placeholder)
├── space/[id] → Space detail (accessible from Spaces tab)
├── container/[id] → Container detail (accessible from Space detail)
└── modal → Modal layouts
```

**Back Button Behavior**:
- From space/container detail: Use router.back() to return to Spaces tab root
- From tab root: Tabs handle back gesture (OS default behavior)

**Tab State Preservation**:
- Expo Router handles tab state automatically (routes are not destroyed)
- Scroll position within tabs preserved by React Native

---

## Implementation Strategy

### What's New (Create)
1. `app/(tabs)/_layout.tsx` - Tab navigation configuration
2. `app/(tabs)/index.tsx` - Home dashboard screen
3. `app/(tabs)/spaces.tsx` - Spaces tab wrapper
4. `app/(tabs)/lending.tsx` - Lending placeholder
5. `app/(tabs)/outside.tsx` - Outside placeholder
6. `components/dashboard/` - Dashboard components (recently-added-card, stats-card, empty-state, home-dashboard)
7. `src/services/DashboardService.ts` - Dashboard data aggregation
8. `specs/008-dashboard-navigation/data-model.md` - Data model documentation
9. `specs/008-dashboard-navigation/quickstart.md` - Implementation guide
10. `specs/008-dashboard-navigation/contracts/dashboard-service.ts` - Service interface

### What's Migrated (Move/Refactor)
1. `app/_layout.tsx` - Update to work with (tabs) group instead of direct routes
2. `app/(tabs)/explore.tsx` - Consolidate into new spaces.tsx (deprecated)

### What's Enhanced (Modify)
1. `src/services/ItemService.ts` - Add getRecentItems() if needed
2. Navigation logic for back button from nested views

### What's Preserved (No Changes)
1. All space/container/item functionality (100% backward compatible)
2. Database schema and migration system
3. Repository layer and parameterized queries
4. Service layer business logic

---

## Success Criteria (Phase 1 Completion Gates)

- ✅ Tab navigation routes are defined in Expo Router
- ✅ All 4 tabs render without errors
- ✅ Home dashboard displays recent items and statistics
- ✅ Spaces tab preserves all existing functionality
- ✅ Back button from nested views returns to Spaces tab
- ✅ Tab state is preserved when switching tabs and returning
- ✅ Empty states display encouraging messages when database is empty
- ✅ Tab visual design shows active/inactive state clearly
- ✅ No breaking changes to existing space/container/item flows
- ✅ All services/repositories remain unchanged (only enhanced with new methods)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Expo Router tabs not rendering | Low | High | Test tabs layout immediately; fall back to stack layout if needed |
| Performance regression on home dashboard | Low | Medium | Limit to 5 recent items; use pagination if scrolling is slow |
| Breaking existing space detail navigation | Low | High | Test space → container → detail flows exhaustively before merging |
| Tab state not preserved on app foreground | Low | Medium | Use Expo Router's built-in state preservation; test with app backgrounding |
| Back button confusion in nested views | Medium | Low | Clear UX documentation + user testing before GA |

---

## Not Included (Out of Scope - Phase 2+)

- Lending feature (items marking, tracking borrowed items)
- Outside feature (items for carry/outside)
- Advanced dashboard analytics
- Tab customization or reordering
- Animations or transitions
- Dark mode (follow app theme)
- Push notifications for recently added items

---

## Phase 2: Task Generation & Implementation

**Deferred to**: `/speckit.tasks` command

This plan establishes the navigation architecture. The task breakdown will detail specific implementation steps, component creation, service methods, and test scenarios.
