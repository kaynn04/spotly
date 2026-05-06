# Feature Specification: Dashboard Navigation Structure

**Feature Branch**: `008-dashboard-navigation`  
**Created**: May 6, 2026  
**Status**: Draft  
**Input**: User description: "Refactor the application into a dashboard-based experience with persistent bottom tab navigation"

## Clarifications

### Session May 6, 2026

- Q: Back button behavior when nested in space/container detail views? → A: Option A - Navigate back to Spaces tab root (parent tab)
- Q: Empty state display when database is empty? → A: Option A - Show encouraging onboarding message (e.g., "No spaces yet. Create one to get started!")
- Q: Tab visual indicators? → A: Option C - Icons + text labels (icon on top, label below) with emojis: Home=🏠, Spaces=📚, Lending=🤝, Outside=🧳
- Q: Recently Added Items context? → A: Option B - Display item name + space (e.g., "Laptop Charger • Living Room")
- Q: Quick action button strategy? → A: Option A - No FAB or quick action buttons; users navigate to Spaces tab to create items/spaces

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Access Home Dashboard (Priority: P1)

User wants to see a home dashboard with an overview of their items and spaces when opening the app, so they can quickly understand what they have and what's been added recently without navigating through multiple screens.

**Why this priority**: The home dashboard is the entry point for the entire app experience. It must exist and function before the navigation tabs can be useful.

**Independent Test**: Can be fully tested by: (1) opening the app, (2) verifying home dashboard displays with overview cards, recently added items, and quick statistics, (3) confirming data persists across app restarts.

**Acceptance Scenarios**:

1. **Given** user opens the app, **When** the app loads, **Then** the home dashboard is displayed as the default view
2. **Given** items exist in the database, **When** user views the home dashboard, **Then** a "Recently Added Items" section shows the 5 most recent items sorted by creation date
3. **Given** items exist in multiple spaces, **When** user views the home dashboard, **Then** quick statistics are displayed showing total item count and total space count
4. **Given** the home dashboard is displayed, **When** user scrolls, **Then** all overview cards and sections are accessible without performance degradation

---

### User Story 2 - Navigate Between Tabs (Priority: P1)

User wants to quickly switch between Home, Spaces, Lending, and Outside sections using bottom navigation tabs so they can move around the app without relying on back-button navigation.

**Why this priority**: Tab-based navigation is the core UX pattern for this feature. Without functioning tab navigation, the entire dashboard structure is non-functional.

**Independent Test**: Can be fully tested by: (1) tapping each tab from any screen, (2) verifying the corresponding section loads, (3) confirming tab visual state updates to show active tab, (4) verifying navigation tabs remain visible during all main section interactions.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** user taps the "Home" tab, **Then** the home dashboard displays and the Home tab is highlighted
2. **Given** the app is on the Home tab, **When** user taps the "Spaces" tab, **Then** the spaces list/management screen displays and the Spaces tab is highlighted
3. **Given** the app is on any tab, **When** user taps a different tab, **Then** the new section loads, the previous section is not destroyed (state preserved for Home/Spaces), and navigation tabs remain visible
4. **Given** the app is displaying a main section, **When** user looks at the bottom of the screen, **Then** navigation tabs are visible and accessible (not hidden by keyboard or other UI)

---

### User Story 3 - Access Spaces Feature (Priority: P1)

User wants to access the existing spaces and containers system from the dashboard so the refactoring doesn't break existing functionality and they can continue managing their spaces.

**Why this priority**: Existing functionality must not be disrupted. The spaces feature (with containers) from feature 007 is core to the app and must remain fully accessible.

**Independent Test**: Can be fully tested by: (1) navigating to Spaces tab, (2) viewing existing spaces and containers, (3) performing space/container/item operations (create, view, delete, move), (4) verifying all operations work identically to before the navigation refactor.

**Acceptance Scenarios**:

1. **Given** user taps the Spaces tab, **When** the screen loads, **Then** the existing spaces list is displayed with all spaces created previously
2. **Given** a space is displayed in the Spaces section, **When** user taps on it, **Then** the space detail screen (from feature 007) opens with full functionality intact
3. **Given** user is in a space or container detail view, **When** user taps the back button, **Then** navigation returns to the Spaces tab view (not to a previous app screen)
4. **Given** user creates a new space from the Spaces tab, **When** the space is saved, **Then** it appears in the spaces list immediately

---

### User Story 4 - View Lent Items (Priority: P2)

User wants to see items they have lent to others in the Lending section so they can track borrowed items and plan when to retrieve them.

**Why this priority**: This feature is important but not critical for MVP. The Lending tab exists for future expansion and can be implemented after core dashboard navigation.

**Independent Test**: Can be fully tested by marking items as lent and verifying they appear in the Lending tab with appropriate metadata (lent to whom, lent date).

**Acceptance Scenarios**:

1. **Given** the Lending tab is selected, **When** the screen loads, **Then** a message displays indicating this feature is coming soon or items marked as lent appear with details

---

### User Story 5 - View Items for Outside (Priority: P2)

User wants to see items marked for outside/carry in the Outside section so they can prepare before leaving and quickly gather needed items.

**Why this priority**: Like the Lending feature, this is future functionality that extends the dashboard. MVP focuses on core navigation structure.

**Independent Test**: Can be tested once item marking for "outside" is implemented, by verifying marked items appear in the Outside tab.

**Acceptance Scenarios**:

1. **Given** the Outside tab is selected, **When** the screen loads, **Then** a message displays indicating this feature is coming soon or items marked for outside appear with details

---

### Edge Cases

- ✅ **Back button behavior**: When user is in a nested view (space detail, container detail), the back button navigates to the Spaces tab root (not app root or previous screen within tab)
- ✅ **Empty state display**: When database is empty (no spaces, items), dashboard displays encouraging onboarding messages (e.g., "No spaces yet. Create one to get started!")
- What happens when user is in a nested view and the app is backgrounded then returned to foreground? (State should be preserved within nested view)
- What if the user quickly taps multiple tabs in succession?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a bottom tab navigation bar visible on all main dashboard sections (Home, Spaces, Lending, Outside)
- **FR-001a**: System MUST display each tab with icon (emoji) above text label: 🏠 Home, 📚 Spaces, 🤝 Lending, 🧳 Outside
- **FR-001b**: System MUST clearly highlight the active tab visually (different color, bolder text, or other clear indicator) while showing inactive tabs in muted style
- **FR-002**: System MUST display the Home tab as the default landing screen when app starts
- **FR-003**: System MUST render a home dashboard displaying: recently added items (5 most recent), item count statistics, space count statistics, overview cards
- **FR-003a**: System MUST display recently added items with format: item name + space (e.g., "Laptop Charger • Living Room") to provide context
- **FR-004**: System MUST allow users to switch between tabs and display the corresponding section
- **FR-005**: System MUST preserve navigation state within each tab section (e.g., selecting a space in Spaces tab doesn't reset when switching away and returning)
- **FR-006**: System MUST keep the Spaces section fully functional with all existing features: view spaces, create containers, add items, move items, delete items, navigate to container detail screen with breadcrumbs
- **FR-006a**: System MUST ensure back button from nested views (space detail, container detail) returns to the Spaces tab root, not to previous screen or app root
- **FR-007**: System MUST display placeholder/coming-soon messages for Lending and Outside tabs (P2 features)
- **FR-007a**: System MUST display encouraging onboarding messages when database is empty (e.g., "No spaces yet. Create one to get started!" for Spaces tab)
- **FR-008**: System MUST use React Native Pressable components and Expo Router for tab navigation (no third-party tab libraries)
- **FR-009**: System MUST maintain existing data model and services (Space, Item, Container) without modification

### Key Entities *(include if feature involves data)*

- **Dashboard**: Aggregate view combining home overview, recently added items, statistics (not a new entity, computed from existing data)
- **Tab Navigation Item**: Configuration for each tab - label, icon, route - but no new database entity
- **Existing Entities** (unchanged):
  - **Space**: Container for items (feature 001)
  - **Container**: Grouping within a space (feature 007)
  - **Item**: Individual belongings with metadata

## Success Criteria *(what we're optimizing for)*

1. **Navigation Efficiency**: Users can switch between major app sections in ≤1 tap and ≤500ms load time
2. **Visual Clarity**: Active tab is clearly highlighted (different color/style), inactive tabs visually distinct but not distracting
3. **Feature Preservation**: All existing space/container/item operations work identically to pre-refactor behavior
4. **Responsive State**: App maintains scroll position and selection state when switching tabs and returning
5. **Production-Ready UI**: Dashboard displays cleanly on phones from 5" to 6.5" screens, text is readable, spacing is consistent
6. **Data Display Accuracy**: Home dashboard statistics match actual database counts; recently added items list is accurate
7. **Performance**: Tab transitions are smooth (no noticeable lag), home dashboard loads in <1 second even with 500+ items

## Dependencies

- **Requires Completed**: Feature 001 (Create Space), Feature 007 (Container Detail View with Nested Containers)
- **No External Dependencies**: Uses existing Expo Router, React Native, expo-sqlite
- **Database**: No schema changes needed (reuses existing Space, Container, Item tables)

## Assumptions

- Bottom tab navigation will use Expo Router's built-in tabs layout (Expo Router v2+)
- "Recently Added Items" means items across all spaces, sorted by creation timestamp descending, displayed as "item name • space name"
- Statistics (total items, total spaces) are simple counts, not advanced analytics
- Lending and Outside tabs are not implemented in MVP; placeholder screens suffice (e.g., "Coming Soon" message)
- Back button from nested views (space detail, container detail) returns to the Spaces tab root, not to previous screen or app root
- Home dashboard is for overview/consumption only; users create spaces and items via the Spaces tab (no FAB or quick action buttons on home)
- Tab navigation uses icons (emojis) above text labels: 🏠 Home, 📚 Spaces, 🤝 Lending, 🧳 Outside
- Empty states display with encouraging onboarding messages (e.g., "No spaces yet. Create one to get started!")
- App operates offline-first with local SQLite; no cloud sync assumed
- No user authentication or multi-user scenarios

## Out of Scope

- Lending feature implementation (marked for feature 009 or later)
- Outside/Carry feature implementation (marked for feature 009 or later)
- Custom animations or transitions for tab switching
- User authentication or multi-user support
- Cloud sync or backup functionality
- Detailed analytics or insights beyond basic counts
- Customizable tabs or tab reordering

## Open Questions

None - all critical clarifications have been answered in the Clarifications section above.
