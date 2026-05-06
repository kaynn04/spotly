# Feature Specification: Lending Tracker

**Feature Branch**: `009-lending-feature`  
**Created**: May 6, 2026  
**Status**: Draft  
**Input**: User description: "Users can lend items to other people and track whether items are returned"

## Overview

The Lending Tracker feature enables users to lend their existing items to other people and maintain a record of those lendings. Users can track which items are currently lent out, who has them, and when they were returned. This feature supports the core use case of managing belongings across multiple states: owned, lent, and returned.

## User Goals

- **Track active lendings**: Know what items are currently lent out and to whom
- **Record lending context**: Capture the borrower's name and optional notes about each lending
- **Mark items as returned**: Update lending status when items are returned
- **Manage lending history**: View a complete record of all lendings (active and returned)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lend an Item (Priority: P1)

A user has items organized in spaces and containers. They want to lend one of their items to someone and create a record of that lending for future reference.

**Why this priority**: This is the core capability of the feature. Without being able to lend items, the feature has no value. It's the entry point for all lending workflows.

**Independent Test**: Can be fully tested by creating a lending record for an existing item and verifying it appears in the lending list.

**Acceptance Scenarios**:

1. **Given** a user is viewing the Lending tab and has existing items in the system, **When** they select "Lend Item" and choose an item from their spaces, **Then** they see a form to enter borrower name and optional note
2. **Given** the lending form is open, **When** they enter a borrower name and submit, **Then** a lending record is created with status ACTIVE and current timestamp
3. **Given** a lending record was successfully created, **When** the user navigates away and returns to the Lending tab, **Then** the newly created lending appears in the active lendings list
4. **Given** a user attempts to lend an item, **When** that item already has an ACTIVE lending, **Then** the system prevents the action and shows an error message

---

### User Story 2 - View Active Lendings (Priority: P1)

A user wants to see a list of all items they've lent out that haven't yet been returned, organized clearly with borrower names and lending dates.

**Why this priority**: This is essential for the MVP—users need to know what's lent out. Viewing active lendings is foundational to the lending workflow.

**Independent Test**: Can be fully tested by creating several lending records and verifying they all appear in the active list with correct information.

**Acceptance Scenarios**:

1. **Given** a user has created one or more ACTIVE lending records, **When** they navigate to the Lending tab, **Then** all ACTIVE lendings are displayed in a list view
2. **Given** lendings are displayed, **When** the list is shown, **Then** each lending shows: item name, borrower name, lending date, and any optional note
3. **Given** multiple ACTIVE lendings exist, **When** the list is displayed, **Then** they are sorted by lending date (most recent first)
4. **Given** no ACTIVE lendings exist, **When** the user navigates to the Lending tab, **Then** an empty state message is shown ("No active lendings")

---

### User Story 3 - Mark Item as Returned (Priority: P1)

A user has received their lent item back from the borrower and wants to update the record to reflect that the item has been returned.

**Why this priority**: This completes the core lending cycle. Without this capability, lending records would accumulate indefinitely and provide incomplete information.

**Independent Test**: Can be fully tested by creating an ACTIVE lending, marking it as returned, and verifying it no longer appears in the active list but appears in history.

**Acceptance Scenarios**:

1. **Given** an ACTIVE lending record is displayed in the list, **When** the user taps on it, **Then** a detail view opens showing full lending information with a "Mark as Returned" button
2. **Given** the lending detail view is open, **When** the user taps "Mark as Returned", **Then** the lending status changes to RETURNED and the current timestamp is recorded
3. **Given** a lending has been marked as RETURNED, **When** the user returns to the Lending tab, **Then** the lending no longer appears in the ACTIVE list
4. **Given** a lending status is RETURNED, **When** the user views the lending history, **Then** the returned lending is displayed with its return date

---

### User Story 4 - View Lending History (Priority: P2)

A user wants to see a complete history of all lendings, including both active and returned items, to maintain an audit trail of what they've lent out.

**Why this priority**: This provides historical context and audit capability. While P1 features handle current lendings, this enables users to reference past lending activity.

**Independent Test**: Can be fully tested by creating mixed ACTIVE and RETURNED lendings and verifying they both appear in the history view with correct status indicators.

**Acceptance Scenarios**:

1. **Given** the user is in the Lending tab, **When** they access a "History" or "All Lendings" view, **Then** both ACTIVE and RETURNED lendings are displayed
2. **Given** history is displayed, **When** lendings are shown, **Then** each lending shows its current status (ACTIVE or RETURNED) clearly indicated
3. **Given** returned lendings have a returned_at timestamp, **When** they appear in history, **Then** the return date is displayed
4. **Given** history contains many lendings, **When** the list is displayed, **Then** lendings are sorted chronologically with most recent first

---

### Edge Cases

- What happens if a user tries to lend an item that doesn't exist? System should reject with error message.
- What happens if a user tries to lend an item that's already actively lent out? System prevents the action and informs the user.
- What happens if borrower name is empty? System should require this field before submission.
- What happens if an item is deleted after it has an ACTIVE lending record? Lending record should remain in history (item reference preserved) or borrower name should be displayed prominently to maintain traceability.
- What happens if user tries to mark something as returned twice? System should prevent the action (button hidden/disabled for RETURNED items).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create a lending record by selecting an existing item and entering a borrower name
- **FR-002**: System MUST record the lending timestamp when a lending record is created (lent_at)
- **FR-003**: System MUST prevent multiple ACTIVE lendings for the same item (one item can only have one active lending at a time)
- **FR-004**: System MUST display all ACTIVE lendings in a list on the Lending tab
- **FR-005**: System MUST allow users to mark a lending as RETURNED and record the return timestamp (returned_at)
- **FR-006**: System MUST support optional notes for each lending record
- **FR-007**: System MUST persist lending records in local SQLite database
- **FR-008**: System MUST maintain complete lending history (both ACTIVE and RETURNED records)
- **FR-009**: System MUST display lending details including: item name, borrower name, lending date, return date (if applicable), notes, and status
- **FR-010**: System MUST prevent users from editing completed (RETURNED) lending records

### Key Entities

- **Lending**: Represents a single item lent to someone
  - `id`: Unique identifier (UUID)
  - `item_id`: Reference to the item being lent (foreign key to items table)
  - `borrower_name`: Name of person borrowing the item (required)
  - `note`: Optional additional information about the lending
  - `lent_at`: Timestamp when item was lent (required, set at creation)
  - `returned_at`: Timestamp when item was returned (null until marked as returned)
  - `status`: Current state of the lending (ACTIVE or RETURNED)
  - `created_at`: Record creation timestamp
  - `updated_at`: Record last modification timestamp

- **Item** (existing): Has relationship with Lending
  - A lending record is only valid if the referenced item exists

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a lending record from item selection to submission in under 30 seconds
- **SC-002**: Users can view all their active lendings in a single tap from the Lending tab
- **SC-003**: Users can mark an item as returned in under 10 seconds from the lending detail view
- **SC-004**: 100% of ACTIVE lending records prevent concurrent lending of the same item
- **SC-005**: All lending records persist locally and survive app restart
- **SC-006**: System maintains lending history indefinitely (no automatic purging of returned records)
- **SC-007**: Users can distinguish between ACTIVE and RETURNED lendings at a glance

## Business Rules

- **BR-001**: An item can have at most one ACTIVE lending at any given time
- **BR-002**: A lending record, once created, cannot be edited (only marked as returned)
- **BR-003**: The borrower_name field is required and cannot be empty
- **BR-004**: When a lending is marked as returned, both the status and returned_at timestamp must be updated atomically
- **BR-005**: Lending records are linked to items by item_id; if an item is deleted, its lending history should be preserved for audit purposes

## MVP Scope

### Included in MVP

- Basic lending creation (select item + enter borrower name + optional note)
- View active lendings list
- Mark item as returned
- Lending history view
- Local SQLite persistence
- Offline-first operation (no cloud sync)

### Explicitly Out of Scope

- Cloud synchronization
- User authentication or profiles
- Reminder notifications for unreturned items
- Push notifications
- Contacts integration or contact picker
- Email/SMS communication with borrowers
- Lending analytics or statistics
- Animations or complex transitions
- Item categorization by lending status
- Multi-user sharing
- Lending deadline or due dates
- Recurring or bulk lendings

## Assumptions

- **Users manage belongings in a single-user, offline environment**: No cloud sync, no multi-device, no authentication
- **Item references are stable**: When a lending record references an item_id, that item exists or is tracked even if deleted
- **Timestamps use device local time**: No server time synchronization needed
- **Borrower name is sufficient for identification**: No contact list or borrower profile management
- **Users don't need lending reminders**: No background jobs or scheduled notifications
- **MVP focuses on active lending management**: Historical analysis and complex queries not required
- **All lendings are equal priority**: No due dates, escalation, or urgency levels
- **UI simplicity takes priority over advanced features**: Focus on core workflows over edge case handling
- **Device storage is sufficient**: No need for archiving or data purging strategies in MVP
- **Borrowers are informal relationships**: No legal agreements or formal contracts needed

## UX Expectations

- **Lending Tab Organization**:
  - Primary view shows ACTIVE lendings in a card/list format
  - Empty state clearly indicates when no active lendings exist
  - Tap on a lending card to view details and mark as returned
  - Access to history/all lendings through a secondary tab or menu option

- **Interaction Patterns**:
  - "Lend Item" button visible on Lending tab to initiate new lending
  - Form-based flow: Select item → Enter borrower → Add note (optional) → Submit
  - Confirmation feedback when lending is created successfully
  - Detail view for each lending with clear "Mark as Returned" action

- **Information Hierarchy**:
  - Active lendings highlighted clearly (current and actionable)
  - Borrower name is prominent (who has it?)
  - Item name is clear (what is lent?)
  - Dates shown but not visually dominant
  - Status clearly distinguished between ACTIVE and RETURNED

## Technical Constraints

- **Offline-first**: All data stored locally in SQLite, no network dependency
- **Layered Architecture**: Follow existing pattern (UI → Service → Repository → SQLite)
- **Feature-based Structure**: Place lending feature code in `src/features/lending/`
- **No animations**: Keep UI transitions simple and functional
- **React Native**: Use platform APIs consistently across iOS and Android
- **TypeScript**: All code must be fully typed
- **No external APIs**: No contacts, maps, or cloud services
- **Local only**: No authentication, authorization, or user management

## Open Questions & Clarifications

- **Q1 - Item Deletion Handling**: When an item is deleted that has lending records, should:
  - A) Lending record be soft-deleted (hidden from UI but preserved in DB)?
  - B) Lending record remain visible with item reference marked as invalid?
  - C) Both lending record and item reference be permanently deleted?
  
  *Assumption for MVP*: Lending records remain visible with item information (name/description) preserved at time of lending, allowing users to maintain lending history even if item is later deleted from inventory.

- **Q2 - Bulk Operations**: Should MVP support:
  - A) Marking multiple items as returned at once?
  - B) Lending multiple items in one action?
  
  *Assumption for MVP*: No bulk operations in v1. Each lending is managed individually.

- **Q3 - Borrower Recurrence**: Should the system suggest previously used borrower names for autocomplete?
  - *Assumption for MVP*: No autocomplete in v1, but borrower names are persisted for potential future feature.
