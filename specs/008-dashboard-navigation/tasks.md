# Tasks: Dashboard Navigation Structure

**Feature**: Feature 008 - Dashboard Navigation Structure  
**Branch**: `008-dashboard-navigation`  
**Status**: Ready for Implementation  
**Total Tasks**: 5 (MVP scope only)

---

## Execution Strategy

**Approach**: Bottom-up implementation
1. Create tab routing structure (foundation)
2. Build home dashboard and services
3. Wrap existing spaces functionality
4. Add placeholder screens
5. Update root navigation

**MVP Focus**: Core navigation + home dashboard. No testing, no optimizations, no redesigns.

**Estimated Total Time**: 4-6 hours

---

## Phase 1: Setup (Tab Navigation Foundation)

- [x] T001 Create tab navigation layout in app/(tabs)/_layout.tsx with 4 bottom tabs (🏠 Home, 📚 Spaces, 🤝 Lending, 🧳 Outside), active color #0a84ff, inactive color #999, height 70px

- [x] T002 Create home dashboard screen in app/(tabs)/index.tsx displaying statistics (total items, spaces, containers) in 3 stat cards, and recently added items section with 5 most recent items in "name • space" format, empty state with encouraging message "No spaces yet. Create one to get started!"

---

## Phase 2: Service Layer (Data Aggregation)

- [x] T003 [P] Create src/services/DashboardService.ts with getFullDashboard() method that aggregates recentItems (via ItemRepository) and stats (counts from Item/Space/Container repositories), add getRecentItems() and getDashboardStats() methods, handle errors gracefully with fallback values

- [x] T004 [P] Add repository methods: ItemRepository.getRecentItems(limit), ItemRepository.countItems(); SpaceRepository.countSpaces(); ContainerRepository.countContainers() with parameterized SQL queries for aggregation

---

## Phase 3: Navigation Integration

- [x] T005 Create app/(tabs)/spaces.tsx wrapper screen and app/(tabs)/lending.tsx, app/(tabs)/outside.tsx placeholder screens with "Coming Soon" message, update app/_layout.tsx to route (tabs) group correctly, ensure back button from nested space/container views returns to Spaces tab root via router.push('/(tabs)/spaces')

---

## Success Criteria

✅ App launches to Home tab with home dashboard displayed  
✅ Home dashboard shows statistics and 5 recent items (or empty state)  
✅ Bottom tabs visible and responsive on all screens  
✅ Tapping Spaces tab displays spaces list (from feature 007)  
✅ Tapping Lending/Outside tabs shows placeholder screens  
✅ Back button from space/container detail returns to Spaces tab  
✅ Tab state preserved when switching away and returning  
✅ All existing space/container/item operations work identically  

---

## Implementation Order

**Critical Path**:
1. T001 → T005 (tab routing must be first)
2. T002 (home screen depends on T001)
3. T003 ↔ T004 (parallel - service and repo methods)
4. T005 (integration - depends on T001, T002, T003)

**Parallel Opportunities**:
- T003 & T004 can be developed in parallel (independent files)
- T003 can be mocked while T004 is being written

---

## Not Included (Out of Scope - Phase 2)

- ❌ Testing tasks (manual testing only in MVP)
- ❌ Performance optimization (dashboard loads <1s target, no profiling needed yet)
- ❌ Component extraction (keep logic in screens for MVP simplicity)
- ❌ Lending feature implementation (placeholder only)
- ❌ Outside feature implementation (placeholder only)
- ❌ Error boundary implementations
- ❌ Analytics or logging
- ❌ Animations or transitions

---

## Acceptance Criteria Per Task

### T001: Tab Navigation Layout
- [ ] Tabs render at bottom of screen
- [ ] All 4 tabs visible and tappable
- [ ] Tab styling: icons (emoji) above text labels
- [ ] Active tab color: #0a84ff; inactive: #999
- [ ] Tab bar height: 70px with appropriate padding
- [ ] No TypeScript errors

### T002: Home Dashboard Screen
- [ ] Displays header "Dashboard"
- [ ] Shows 3 stat cards: Items, Spaces, Containers (with correct counts)
- [ ] Shows "Recently Added Items" section with 5 items
- [ ] Each recent item shows: name • spaceName format
- [ ] Empty state displays when no spaces exist
- [ ] Empty state message: "No spaces yet. Create one to get started!"
- [ ] Content scrollable
- [ ] No layout overflow issues

### T003: DashboardService
- [ ] Service class exports with 3 methods
- [ ] getRecentItems(limit) returns recent items array
- [ ] getDashboardStats() returns stats object
- [ ] getFullDashboard() returns aggregated dashboard data
- [ ] Errors caught and logged (graceful fallback to empty/0 values)
- [ ] All return types match Dashboard interface
- [ ] No TypeScript errors

### T004: Repository Methods
- [ ] ItemRepository.getRecentItems(limit: number) implemented with SQL join to spaces
- [ ] ItemRepository.countItems() returns number
- [ ] SpaceRepository.countSpaces() returns number
- [ ] ContainerRepository.countContainers() returns number
- [ ] All queries use parameterized placeholders (?)
- [ ] No TypeScript errors

### T005: Navigation Integration
- [ ] Spaces tab screen created and functional
- [ ] Lending/Outside placeholder screens created with "Coming Soon"
- [ ] Root layout updated to route (tabs) group
- [ ] Back button from space detail navigates to Spaces tab
- [ ] Back button from container detail navigates to Spaces tab
- [ ] No routing errors or broken links

---

## Reference Documentation

- **Spec**: [spec.md](spec.md) - User stories, acceptance criteria, clarifications
- **Plan**: [plan.md](plan.md) - Architecture, technical context, phase breakdown
- **Data Model**: [data-model.md](data-model.md) - Dashboard data structure, queries
- **Quickstart**: [quickstart.md](quickstart.md) - Step-by-step implementation guide with code examples
- **Contracts**: [contracts/dashboard-service.ts](contracts/dashboard-service.ts) - Service interface

---

## Implementation Notes

### File Structure (What to Create)
```
app/(tabs)/
  ├── _layout.tsx          ← Tab routing config
  ├── index.tsx            ← Home dashboard
  ├── spaces.tsx           ← Spaces tab wrapper
  ├── lending.tsx          ← Lending placeholder
  └── outside.tsx          ← Outside placeholder

src/services/
  └── DashboardService.ts  ← Dashboard aggregation
```

### Services to Enhance (Add Methods)
```
src/repositories/
  ├── ItemRepository.ts    ← Add: getRecentItems(), countItems()
  ├── SpaceRepository.ts   ← Add: countSpaces()
  └── ContainerRepository.ts ← Add: countContainers()
```

### Files to Modify
```
app/_layout.tsx           ← Update root routing
```

---

## Testing Checklist (Manual)

Before marking as complete:
- [ ] Open app → Home tab displays with dashboard
- [ ] Tap Spaces tab → Spaces list appears
- [ ] Tap a space → Space detail opens
- [ ] Tap back → Returns to Spaces tab (not app root)
- [ ] Tap container → Container detail opens
- [ ] Tap back → Returns to Spaces tab
- [ ] Tap Lending tab → Placeholder shows
- [ ] Tap Outside tab → Placeholder shows
- [ ] Switch tabs repeatedly → State preserved (scroll position doesn't reset)
- [ ] Create new space → Appears in Spaces tab immediately
- [ ] Add new item → Appears in recent items on Home tab

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Tabs layout doesn't render | Test T001 immediately; refer to Expo Router docs if issues |
| Dashboard query too slow | T004 queries are simple; if performance issues, add basic caching |
| Back button breaks nested views | Test back navigation from both space and container detail in T005 |
| Tab state not preserved | Use Expo Router's built-in state management (no extra work needed) |
| Existing spaces functionality breaks | Test all space/container/item operations with before/after comparison |

---

## Done Criteria (MVP Complete)

When all 5 tasks are complete and acceptance criteria met:
- ✅ Feature 008 implementation is feature-complete for MVP
- ✅ All P1 user stories satisfied (US1, US2, US3)
- ✅ No breaking changes to existing features (backward compatible)
- ✅ Code ready for code review and QA
- ✅ Branch ready for merge to main
