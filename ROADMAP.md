# Spotly — Product Roadmap

**Last Updated**: May 11, 2026  
**Current Version**: 1.0 (MVP)  
**Vision**: The definitive personal inventory management system — not a notes app, but an intelligent physical object tracker.

---

## What Makes Spotly Different From a Notes App

| Notes App | Spotly |
|-----------|--------|
| Flat text lists | Hierarchical: Space → Container → Item |
| No relationships | Items linked to locations, people, sessions |
| No state tracking | Lending status, outside session progress, move history |
| Manual everything | Auto-return, duplicate prevention, cascade deletes |
| Read/write text | Scan, photograph, track, remind, share |

**Core insight**: Notes apps store *text*. Spotly tracks *physical objects in physical space* — with relationships, state, history, and intelligence.

---

## Phase 1 — MVP ✅ (Complete)

> Foundation: Spaces, items, containers, lending, outside sessions

- [x] Create & manage spaces (rooms, locations)
- [x] Add items with properties (name, description, quantity)
- [x] Containers within spaces (boxes, drawers, shelves)
- [x] Move items between spaces and containers
- [x] Delete items and spaces with cascade rules
- [x] Lending tracker (lend, return, history, status badges)
- [x] Outside sessions (checklist, progress bar, auto-return)
- [x] Dashboard with recently added/moved items
- [x] Onboarding flow with personalized greeting
- [x] Dark mode support
- [x] Fully offline — no cloud, no account required

---

## Phase 2 — "See It, Find It" (Visual Intelligence)

> **Goal**: Make items visual and instantly findable. This is the highest-impact differentiator.

### 📸 Item Photos
- Attach photos when adding or editing items
- Visual browse mode: grid view with thumbnails instead of text lists
- Camera integration: snap a photo directly from the add item screen
- **Why it matters**: You can *see* what's in a container without opening it

### 🔍 Search & Filter
- Full-text search across all spaces, containers, and items
- Filter by: space, container, lending status, category, date added
- Search results show item location path (Space › Container › Item)
- Instant "Where is my X?" — the #1 use case
- **Why it matters**: Notes apps search text. Spotly searches your *physical world*.

### 📱 Barcode & QR Scanning
- Scan product barcodes to auto-fill item name and description
- Generate printable QR labels for containers and shelves
- Scan QR label → instantly see container contents on phone
- **Why it matters**: Bridge between physical labels and digital inventory

### 🏷️ Item Categories & Tags
- Predefined categories: Electronics, Clothes, Tools, Kitchen, Documents, etc.
- Custom color-coded tags for personal organization
- Filter inventory by category or tag
- Category icons for visual distinction in lists
- **Why it matters**: Structure beyond location — find "all my electronics" across all spaces

---

## Phase 3 — "Smart Tracking" (Intelligence Layer)

> **Goal**: Spotly doesn't just store — it *thinks* and *reminds*.

### 🔔 Push Notifications & Reminders
- Lending reminders: "John has had your drill for 14 days"
- Configurable reminder intervals (7, 14, 30 days)
- Outside session reminder: "You have an active session — did everything come back?"
- Optional due dates on lendings
- **Why it matters**: Proactive tracking, not just passive storage

### 💰 Item Value Tracking
- Track purchase price and current estimated value per item
- Total inventory value per space, container, or overall
- Insurance-ready value reports
- **Why it matters**: Know what your stuff is worth — useful for insurance, moving, downsizing

### 📊 Activity Timeline & History
- Full history per item: created → moved → lent → returned → moved again
- Timeline view: see all activity across your inventory
- "Last seen" timestamps — when was an item last interacted with
- **Why it matters**: Accountability and traceability. Notes don't have history.

### 📱 Home Screen Widget
- Quick-glance widget: active lendings count, outside session status
- Recent activity feed without opening the app
- One-tap access to active outside session
- **Why it matters**: Instant visibility without app launch

---

## Phase 4 — "Connected" (Multi-Device & Sharing)

> **Goal**: Spotly works across devices and households.

### ☁️ Cloud Backup & Sync
- Optional cloud backup (user-controlled, privacy-first)
- Restore inventory on a new device
- Cross-device sync for users with multiple phones/tablets
- End-to-end encryption for cloud data
- **Why it matters**: Never lose your inventory data

### 👨‍👩‍👧‍👦 Household Sharing
- Share specific spaces with family members
- Permission levels: view-only or edit
- Shared lending visibility: everyone sees who borrowed what
- **Why it matters**: Household inventory is a *shared* problem

### 📤 Export & Reports
- Export inventory to CSV, PDF, or JSON
- Insurance documentation: itemized list with values and photos
- Moving day checklist: generate packing lists per space
- **Why it matters**: Your data is yours — take it anywhere

### 🖥️ Web Companion
- Browse and manage inventory from desktop browser
- Bulk operations: add/edit/move multiple items efficiently
- Print QR labels from web interface
- **Why it matters**: Desktop is better for bulk management

---

## Phase 5 — "Power User" (Advanced Features)

> **Goal**: Features that make power users never want to leave.

### ⚡ Batch Operations
- Select multiple items → move all, delete all, lend all, tag all
- Drag-and-drop reordering within containers
- Bulk import: paste a list of items to add at once
- **Why it matters**: Efficiency for large inventories (100+ items)

### 📝 Custom Fields
- Add custom properties per item: serial number, warranty expiry, purchase link, manual PDF
- Field templates per category (e.g., Electronics → serial number, warranty, voltage)
- **Why it matters**: Every item type needs different metadata

### 📍 Location-Aware Spaces
- Attach GPS coordinates to spaces
- Proximity alerts: "You're near your Storage Unit — here's what's inside"
- Map view: see all your spaces on a map
- **Why it matters**: Spaces aren't just rooms — they're storage units, garages, offices

### 🎤 Voice Input
- "Add headphones to bedroom drawer"
- Voice-powered search: "Where's my passport?"
- Hands-free item entry while organizing
- **Why it matters**: Fastest possible input when your hands are full of stuff

### 🔄 Duplicate Detection
- "You already have 'HDMI Cable' in Living Room. Add another or update quantity?"
- Smart suggestions when adding items with similar names
- **Why it matters**: Inventory accuracy without manual checking

---

## Phase 6 — "Ecosystem" (Platform Play)

> **Goal**: Spotly becomes the platform for physical object management.

### 📡 NFC Tag Support
- Write item/container ID to NFC stickers
- Tap phone on sticker → instantly see contents or item details
- Bulk NFC tag writing from web companion
- **Why it matters**: The ultimate bridge between physical and digital

### ⌚ Wear OS / Watch App
- Quick checklist view for outside sessions on your wrist
- Lending notifications on watch
- Voice search from watch: "Where's my keys?"
- **Why it matters**: Fastest access possible

### 🤖 Voice Assistant Integration
- Siri Shortcuts / Google Assistant / Alexa
- "Hey Google, where's my passport?" → "Passport is in Bedroom › Top Drawer"
- "Alexa, who has my drill?" → "Drill is lent to John since May 3rd"
- **Why it matters**: Zero-friction access to inventory knowledge

### 🔌 API & Integrations
- Public API for third-party integrations
- Home automation: smart home knows what's where
- IFTTT/Zapier recipes: "When lending overdue → send reminder email"
- **Why it matters**: Spotly becomes the source of truth for physical objects

---

## Priority Matrix

| Impact | Effort | Feature | Phase |
|--------|--------|---------|-------|
| 🔴 High | 🟢 Low | Search & Filter | 2 |
| 🔴 High | 🟡 Medium | Item Photos | 2 |
| 🔴 High | 🟡 Medium | Push Notifications | 3 |
| 🔴 High | 🟡 Medium | Categories & Tags | 2 |
| 🟡 Medium | 🟢 Low | Home Screen Widget | 3 |
| 🟡 Medium | 🟡 Medium | Barcode/QR Scanning | 2 |
| 🟡 Medium | 🟡 Medium | Item Value Tracking | 3 |
| 🟡 Medium | 🟡 Medium | Activity Timeline | 3 |
| 🟡 Medium | 🟡 Medium | Export & Reports | 4 |
| 🟡 Medium | 🔴 High | Cloud Backup & Sync | 4 |
| 🟡 Medium | 🔴 High | Household Sharing | 4 |
| 🟢 Low | 🟡 Medium | Batch Operations | 5 |
| 🟢 Low | 🟡 Medium | Custom Fields | 5 |
| 🟢 Low | 🟡 Medium | Voice Input | 5 |
| 🟢 Low | 🔴 High | NFC Tags | 6 |
| 🟢 Low | 🔴 High | Voice Assistant | 6 |

---

## Success Metrics (Per Phase)

| Phase | Key Metric | Target |
|-------|-----------|--------|
| 2 | Daily active users | 500+ |
| 2 | Items with photos | >30% of all items |
| 3 | Lending reminder engagement | >60% tap-through rate |
| 3 | Retention (30-day) | >40% |
| 4 | Cloud backup adoption | >25% of users |
| 4 | Household sharing | >10% of users share ≥1 space |
| 5 | Items per user (avg) | 50+ |
| 6 | Play Store rating | 4.5+ stars |

---

## Competitive Landscape

| App | Focus | Spotly Advantage |
|-----|-------|-----------------|
| Google Keep | Notes & lists | Spotly has location hierarchy, lending, sessions |
| Sortly | Visual inventory | Spotly is free, offline-first, has lending + outside tracking |
| Memento | Database app | Spotly is purpose-built for physical items, not generic database |
| Home Inventory | Insurance tracking | Spotly adds lending, outside sessions, real-time tracking |

**Spotly's moat**: The combination of *spatial hierarchy + lending + outside sessions + offline-first* doesn't exist in any competitor. Each phase widens this gap.
