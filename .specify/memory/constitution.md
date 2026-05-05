# Spotly Constitution

## Core Principles

### I. Spec-Driven Development (NON-NEGOTIABLE)
Every feature must begin with a completed specification. Development workflow: `specify` → `clarify` → `plan` → `tasks` → `implement`. No code should be written before the spec is approved. Specs are the single source of truth that guides all development decisions.

### II. Simplicity First
Avoid overengineering. Build for the MVP scope only. Each component should have one clear purpose. When deciding between two approaches, always choose the simpler one. YAGNI principle enforced: don't build features not in the spec.

### III. Vertical Slice Development
Every feature must work end-to-end from UI to database. Features are not split into isolated layers for separate implementation. Integration testing against real (or test) SQLite happens immediately, not as an afterthought.

### IV. Local-First Architecture
Data lives on the device first. All data must persist locally using SQLite (expo-sqlite in production). No cloud sync, no authentication required in V1. Users work offline by default; sync is out of scope.

### V. Clean Layered Architecture
UI → Service → Repository → SQLite. Each layer has a single responsibility. No cross-layer dependencies. Services validate business logic. Repository handles all database queries. UI only handles presentation and user input.

## Technology Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript (strict mode)
- **Database**: expo-sqlite (production), sql.js (testing)
- **Data Access Pattern**: Repository pattern with parameterized queries
- **Package Manager**: npm
- **No ORMs**: All queries written directly using parameterized SQL

## Architecture Guidelines

**Layered Design**:
- **UI Layer**: Components, screens, routing. Calls services only.
- **Service Layer**: Business logic, input validation, error handling. Never directly queries database.
- **Repository Layer**: Data access abstraction. Executes parameterized SQL queries.
- **Database Layer**: SQLite. Schema versioning and migrations handled here.

**Constraints**:
- Keep functions small (under 30 lines when possible)
- No circular dependencies between layers
- Services contain validation logic; no separate validation services in V1
- Repositories are database-agnostic (can swap sqlite for in-memory in tests)
- Error handling: simple try-catch, meaningful error messages to UI

## Data Strategy

- **Single-User**: No multi-user support or authentication in V1
- **Local-First**: All data persists immediately on device
- **Schema-First**: Define data model in spec before coding
- **Migrations**: SQLite migration files for schema changes
- **Offline-First**: App works without network connectivity

## Coding Guidelines

1. **Small Functions**: Keep functions focused and under 30 lines
2. **Input Validation**: Validate in service layer, not in UI
3. **Error Messages**: Return clear, actionable errors to the UI
4. **TypeScript**: Use strict types; avoid `any`
5. **SQL Safety**: Always use parameterized queries; never string interpolation
6. **Testing**: Use sql.js for in-memory database tests; Vitest or Jest
7. **Documentation**: Functions should have clear purpose statements

## V1 Scope

- Space management (create, read)
- Item management (basic CRUD)
- Search (basic text search by name)
- Carry list (simple list of items to take with you)

## Out of Scope for V1

- Multi-user support / cloud sync
- Authentication / authorization
- AI-powered tagging or automation
- Advanced analytics or reporting
- Photo attachments for items
- QR codes or barcodes
- Voice input
- Complex search filters

## Definition of Done

A feature is complete when:
- ✅ Spec is written and approved
- ✅ All acceptance criteria from spec are met
- ✅ Feature works end-to-end in the app
- ✅ Data persists correctly after app restart
- ✅ No critical errors or crashes
- ✅ Basic manual testing completed
- ✅ Code follows architecture guidelines

## Anti-Patterns to Avoid

- ❌ **Spec Skipping**: Starting code before spec is approved
- ❌ **Over-Abstraction**: Adding layers or patterns not needed for current scope
- ❌ **Async Implementation**: Building UI, service, and database in separate sprints
- ❌ **Scope Creep**: Adding features not in the approved spec
- ❌ **Delayed Database Integration**: Mocking the database instead of using real SQLite early
- ❌ **Complex Error Systems**: Avoid elaborate error handling frameworks in V1
- ❌ **Premature Optimization**: Focus on correctness first, performance later

## Governance

The constitution supersedes all other development practices. All PRs must verify compliance with these principles. If a feature requires deviation from this constitution (e.g., adding authentication early), the constitution must be amended first with justification, then the spec updated.

**Code Review Checklist**:
- Is there a completed spec for this work?
- Does code follow the layered architecture?
- Are all SQL queries parameterized?
- Are functions small and focused?
- Is input validation in the service layer?
- Does the feature work end-to-end?

**Version**: 1.0 | **Ratified**: 2026-05-05 | **Last Amended**: 2026-05-05
