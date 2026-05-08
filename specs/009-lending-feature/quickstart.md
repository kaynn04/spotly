# Quickstart: Lending Feature Implementation

**Goal**: Implement a lending tracker where users lend items to people and track returns.

## What You're Building

Users can:
1. **Lend an item** - Select item + enter borrower name + optional note
2. **View active lendings** - See what's currently lent out
3. **Mark as returned** - Update when item comes back
4. **View history** - See all lendings (active and returned)

**Key constraint**: Only ONE active lending per item at a time.

---

## Architecture at a Glance

### Layered Structure
```
UI (LendingPage, LendingDetailScreen, etc.)
  ↓
Service (LendingService - validates & enforces rules)
  ↓
Repository (LendingRepository - database queries)
  ↓
SQLite (lendings table)
```

### Folder Structure
```
src/features/lending/
├── screens/
│   ├── LendingPage.tsx              # Main tab - active list + create
│   ├── LendingDetailScreen.tsx      # Detail + mark returned
│   └── LendingHistoryScreen.tsx     # History view
├── services/
│   └── LendingService.ts            # Business logic
├── repositories/
│   └── LendingRepository.ts         # Database queries
└── models/
    └── Lending.ts                   # Types/interfaces
```

---

## The Lending Model

```typescript
// What a lending record contains
{
  id: UUID,
  item_id: UUID,              // References the item being lent
  borrower_name: string,      // Who has it (required)
  note?: string,              // Optional context
  lent_at: Date,              // When lent (auto-generated)
  returned_at?: Date,         // When returned (null until marked)
  status: 'ACTIVE' | 'RETURNED',
  created_at: Date,
  updated_at: Date
}
```

---

## Core Business Rules

1. **One active lending per item** - Item can't be lent again until marked returned
2. **Borrower name required** - Every lending needs who has it
3. **Records immutable except return** - Create once, only action is mark returned
4. **Timestamps auto-managed** - Repository generates all dates
5. **History preserved** - Returned lendings stay in database

---

## Implementation Phases

### Phase 1: Database (Day 1)
- [ ] Create Lending TypeScript type
- [ ] Add migration to create lendings table
- [ ] Implement LendingRepository with query methods

### Phase 2: Service Layer (Day 1-2)
- [ ] Create LendingService with business logic
- [ ] Implement validation: borrower name, item exists, no active duplicate
- [ ] Add error handling

### Phase 3: UI - Create Flow (Day 2)
- [ ] Create LendingPage component
- [ ] Item selection modal
- [ ] Lending form (borrower + note)
- [ ] Display active lendings list

### Phase 4: UI - Detail & Return (Day 3)
- [ ] Create LendingDetailScreen
- [ ] Implement mark-as-returned action
- [ ] Navigation between screens

### Phase 5: History View (Day 3)
- [ ] Create LendingHistoryScreen
- [ ] Show all lendings with status filter
- [ ] Navigation to detail

### Phase 6: Polish (Day 4)
- [ ] Test edge cases
- [ ] Error messages
- [ ] Data persistence across restart

---

## Key Decision Points

| Question | Decision | Why |
|----------|----------|-----|
| Item selection | Flat list, all items | Simpler, works for MVP |
| Item deletion | Orphaned lendings (no cascade) | Preserves history |
| Timestamps | Repository generates | Single source of truth |
| State management | React hooks only, no Redux | Too simple for state manager |
| History view | Tab filter (Active/Returned) | Simple UX |
| Animations | None | Keep it fast |

---

## Navigation

**Existing**: `app/(tabs)/lending.tsx` already set up as thin wrapper

**Add Routes**:
- `/lending/[id]` - Detail screen
- `/lending/history` - History view

**Flow**:
1. LendingPage (tab) → tap "Lend Item" → Item selector modal
2. Select item → Form (borrower + note) → Create
3. Tap lending in list → LendingDetailScreen → "Mark Returned"
4. "See History" → LendingHistoryScreen → tap to detail

---

## Success Criteria (Testing Checklist)

- [ ] Create lending: User can lend item in < 30 seconds
- [ ] View active: All ACTIVE lendings shown in list
- [ ] Prevent duplicate: Can't lend item twice (error shown)
- [ ] Mark returned: Can mark ACTIVE lending as returned
- [ ] History: RETURNED lendings visible in history
- [ ] Persist: Data survives app restart
- [ ] Distinguish: ACTIVE vs RETURNED clearly different

---

## Common Patterns in Codebase

**Error Handling**:
```
// Service throws ServiceError
throw new ServiceError('Item already lent', 'DUPLICATE_ACTIVE_LENDING')

// UI catches and shows to user
catch (error) {
  Alert.alert('Error', error.message)
}
```

**Data Refresh on Focus**:
```
useFocusEffect(
  useCallback(() => {
    loadLendings()
  }, [])
)
```

**Repository Queries**:
```
// All parameterized, never string concat
SELECT * FROM lendings WHERE item_id = ? AND status = ?
```

---

## Gotchas & Tips

1. **Borrower name validation**: Check for empty AND whitespace (`borrowerName.trim()`)
2. **Timestamps**: Always use repository to generate dates, never UI or service
3. **Active check**: Query `(item_id, status)` before creating, use index
4. **Item deletion**: If item deleted, lending still exists (orphaned). Handle gracefully in display.
5. **Multiple screens**: Use `useFocusEffect` to refresh data when returning to screen
6. **Parameter types**: TypeScript strict mode - `string | null` vs `string` matters

---

## Debugging Tips

- Check SQLite schema: `sqlite3 ~/.expo/lendings.db ".schema lendings"`
- Log repository queries: Add console.log before/after DB calls
- Test data: Manually insert lending record to test display
- Navigation: Verify params passed correctly to detail screen
- Timestamps: Log `lent_at` and `returned_at` to verify they're dates not strings

---

## Reference Docs

- **Specification**: [spec.md](./spec.md) - What to build
- **Implementation Plan**: [plan.md](./plan.md) - How to build it
- **Existing Models**: `src/models/` - Similar patterns (Space, Item, Container)
- **Similar Service**: `src/services/SpaceService.ts` - Reference for pattern
- **DB Access**: `src/repositories/` - Repository pattern examples

---

*Ready to start Phase 1? See plan.md section 12 for detailed implementation guidance.*
