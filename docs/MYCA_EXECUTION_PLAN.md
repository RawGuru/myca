# MYCA Execution Plan
## Architecture Stabilization Before Product Work

---

## 1. Project Concept

MYCA is a protected environment for structured human attention.

**Core mechanic:**
Every session begins with uninterrupted expression. The speaker holds the floor first. The listener reflects back what they heard before the conversation opens. This creates a threshold—a moment of being understood before reaction.

**Product direction:**
- Not a normal video call app
- Not a therapy marketplace
- Not a coaching directory
- A platform where presence has weight, where attention is compensated, where clarity comes first

**Session ritual:**
1. Speaker begins without interruption
2. Listener reflects back what they heard
3. Then the conversation opens

The ritual is non-negotiable. The platform enforces understanding before reaction.

---

## 2. Why Time Was Wasted

**Root cause: Architecture, not copy.**

The 10,468-line App.tsx monolith created these problems:
- All screens rendered as inline blocks inside one massive component
- No clear render ownership boundaries
- Overlapping logic (availability management duplicated across editVideo and manageAvailability)
- UI polish work caused architectural drift
- Partial wins (better copy, refined cards) without structural stability
- Impossible to reason about what renders when and why

**The mistake:** Attempting product work (copy changes, UI refinement) on top of unstable render architecture.

**The lesson:** Extract screens first. Stabilize render ownership. Then do product work.

---

## 3. Current Codebase State

### Extractions Completed
1. ✅ **WelcomeScreen** - Extracted to `src/screens/WelcomeScreen.tsx`
   - Status: Committed (commit 5bd16c3)
   - Lines removed: 138
   - Build: Passing
   - Browser verified: Yes

2. ✅ **ManageListingsScreen** - Extracted to `src/screens/ManageListingsScreen.tsx`
   - Status: Committed (commit 11b53be)
   - Lines removed: 135 (net, accounting for replacement code)
   - Build: Passing (zero TypeScript errors)
   - Browser verified: Yes (via "Become available" flow on localhost)

3. ✅ **CreateListingScreen** - Extracted to `src/screens/CreateListingScreen.tsx`
   - Status: Committed (commit e92ee82)
   - Lines removed: 263 (net, accounting for replacement code)
   - Build: Passing (zero TypeScript errors)
   - Browser verified: Yes on localhost

4. ✅ **EditListingScreen** - Extracted to `src/screens/EditListingScreen.tsx`
   - Status: Committed (commit 01a9236)
   - Lines removed: 149 (net, accounting for replacement code)
   - Build: Passing (zero TypeScript errors)
   - Browser verified: Yes on localhost

5. ✅ **ManageAvailabilityScreen** - Extracted to `src/screens/ManageAvailabilityScreen.tsx`
   - Status: Committed (commit 6a0bf03)
   - Lines removed: 184 (net, accounting for replacement code)
   - Build: Passing (zero TypeScript errors)
   - Browser verified: Yes on localhost

6. ✅ **EditVideoScreen** - Extracted to `src/screens/EditVideoScreen.tsx`
   - Status: Committed (commit da86a4c)
   - Lines removed: 244 (net, accounting for replacement code)
   - Build: Passing (zero TypeScript errors)
   - Browser verified: Yes on localhost

### Current Metrics
- **App.tsx line count chronology:**
  - 10,468 lines (before any extractions)
  - 10,352 lines (after WelcomeScreen extraction, committed)
  - 10,217 lines (after ManageListingsScreen extraction, committed)
  - 9,954 lines (after CreateListingScreen extraction, committed)
  - 9,805 lines (after EditListingScreen extraction, committed)
  - 9,621 lines (after ManageAvailabilityScreen extraction, committed)
  - 9,377 lines (after EditVideoScreen extraction, committed)
- **Build status:** ✅ Passing with zero errors
- **Commit state:** Clean working tree
- **Latest commit:** da86a4c - EditVideoScreen extraction

### Browser Verification Note
**ManageListingsScreen verification resolved:**
- Screen was reachable through real localhost UI flow ("Become available" → giver onboarding → "Your rooms")
- Internal state name: `manageListings`
- User-facing screen title: "Your rooms"
- Navigation/product wording remains confusing (deferred as product debt)

---

## 4. Current Blockers

### A. Architecture Blockers
**No confirmed extraction-code blocker in ManageListingsScreen; current blocker is verification/reachability.**

ManageListingsScreen extraction is architecturally sound:
- No circular imports from App.tsx
- Local type definitions (Mode, Category, Listing) prevent circular dependency
- State mutations encapsulated in callbacks passed from App.tsx
- Build passing with zero errors
- Follows established WelcomeScreen pattern

### B. UI Reachability Blockers
**ACTIVE BLOCKER:** ManageListingsScreen cannot be reached from current localhost UI.

**Evidence:**
1. User can sign in on localhost
2. User sees "Account and Profile" screen (title visible)
3. User sees "Video & Availability" screen (reachable)
4. User CANNOT see "Your rooms" card with "Manage" button
5. No visible UI path to manageListings screen exists

**Root cause analysis:**

The "Your rooms" card (lines 9519-9541 in App.tsx) is inside a conditional block:
```typescript
{myGiverProfile ? (
  <>
    {/* Public Profile card */}
    {/* Rate card */}
    {/* Introduction Video card */}
    {/* Availability card */}
    {/* Your rooms card */}  ← This contains the "Manage" button
  </>
) : (
  /* Non-giver fallback: "Become a Giver" button */
)}
```

**Critical dependency (App.tsx lines 2112-2117):**
```typescript
const { data: publicData, error: publicError } = await supabase
  .from('profiles_public')
  .select('*')
  .eq('id', user.id)
  .eq('is_giver', true)  // ← Must be true to see giver UI
  .single()
```

**Verification blocker hypothesis:**
- The "Your rooms" card is not visible in current localhost UI
- Code analysis suggests this requires `myGiverProfile` to be truthy
- `myGiverProfile` is populated only when `is_giver: true` in the database query
- Therefore, test account likely does NOT have `is_giver: true` set
- However, this has NOT been directly verified in the database

**Contradictory behavior observed:**
Localhost now works, but UI behavior is inconsistent with expectations:
- User can sign in successfully on localhost
- User can reach "Account and Profile" screen (title displays correctly)
- User can reach "Video & Availability" screen (screen is accessible)
- User CANNOT see "Your rooms" card or "Manage" button
- This contradicts the simple "no giver profile" hypothesis

**Possible explanations:**
1. Test account lacks `is_giver: true` in database (most likely)
2. `myGiverProfile` query is failing silently for some other reason
3. Alternative UI path exists that bypasses `myGiverProfile` check for some screens
4. "Video & Availability" screen uses different conditional logic than userProfile cards

**Resolution needed:** Direct database verification of test account's `is_giver` flag status.

### C. Data/Auth Blockers
**ACTIVE BLOCKER (UNVERIFIED):** Test account's `is_giver` flag status unknown.

**Hypothesis:** Test account lacks `is_giver: true` in database, preventing `myGiverProfile` from populating.

**Impact:** Cannot browser-verify ManageListingsScreen until UI path is confirmed working. Options:
1. Verify `is_giver` status in database; set to `true` if missing
2. Complete giver onboarding flow in localhost UI (sets flag automatically)
3. Use temporary direct navigation for screen-only verification (doesn't validate full UI path)

### D. Product/Copy Debt
**Deferred until after architecture stabilization.**

Known product debt:
- "Offer" language still in many places (should be "session style" or "room")
- "Manage Offers" should be "Manage your rooms"
- Raw admin strings ([DEV], [ADMIN], STRIPE_STATE) may still be visible
- Availability displays raw slot counts (329 slots) as headings
- Trial tier graduation requirements not explained consistently
- Checkout price breakdown appears late ($25 shown, then $29.42 at payment)
- Pre-session ritual screens don't exist yet
- Many other copy/UX issues documented in MYCA_final_builder_document.md

---

## 5. Rules for This Phase

**Extraction protocol (must follow exactly):**

1. **One screen at a time** - Never start the next extraction until the previous one is committed
2. **Show plan before applying** - Full diff, exact lines, all props, expected impact
3. **Wait for user approval** - No extraction applied without explicit go-ahead
4. **Run build after every extraction** - Must show zero TypeScript errors
5. **Show App.tsx line count before/after** - Track progress quantitatively
6. **Browser verify before commit** - Extraction not done until visually confirmed in localhost
7. **No circular imports from App.tsx** - All extracted screens use local type definitions
8. **Keep state mutations in App.tsx callbacks** - Screens are presentational, callbacks encapsulate state
9. **No redesign mixed into extraction** - Preserve exact current behavior, no copy changes, no logic changes

**What counts as browser verification:**
- Navigate to extracted screen in localhost dev server
- Confirm screen renders without errors
- Confirm screen matches previous inline behavior
- Confirm navigation to/from screen works
- Visual confirmation required, not just build success

**When to stop:**
- If build fails, fix type errors before proceeding
- If screen is unreachable from UI, resolve access blocker before marking as verified
- If behavior differs from inline version, debug before committing

---

## 6. Extraction Roadmap

### 1. ✅ WelcomeScreen
- **Goal:** Extract welcome/landing screen
- **Risk level:** Low (pure presentation)
- **Status:** DONE - Committed in 5bd16c3
- **Definition of done:** Browser verified, committed, build passing
- **Dependencies:** None
- **Blocked:** No

### 2. ✅ ManageListingsScreen
- **Goal:** Extract "Your rooms" management list screen
- **Risk level:** Low-medium (presentational but requires giver profile)
- **Status:** DONE - Committed in 11b53be
- **Definition of done:**
  - ✅ Extracted to separate file
  - ✅ Build passing with zero errors
  - ✅ Browser verified (via "Become available" flow)
  - ✅ Committed
- **Dependencies:** Required giver profile (resolved via onboarding flow)
- **Blocked:** No

### 3. ✅ CreateListingScreen
- **Goal:** Extract "Define your session style" form screen
- **Risk level:** Medium (form state, validation, API calls)
- **Status:** DONE - Committed in e92ee82
- **Definition of done:**
  - ✅ Extracted to separate file
  - ✅ Build passing with zero errors
  - ✅ Browser verified on localhost
  - ✅ Committed
- **Dependencies:**
  - ✅ ManageListingsScreen committed
  - Navigates back to ManageListingsScreen on success
- **Blocked:** No

### 4. ✅ EditListingScreen
- **Goal:** Extract edit existing listing form screen
- **Risk level:** Medium (form state, validation, API calls)
- **Status:** DONE - Committed in 01a9236
- **Definition of done:**
  - ✅ Extracted to separate file
  - ✅ Build passing with zero errors
  - ✅ Browser verified on localhost
  - ✅ Committed
- **Dependencies:**
  - ✅ ManageListingsScreen committed (provides navigation path)
  - ✅ CreateListingScreen committed (similar form logic)
- **Blocked:** No

### 5. ✅ ManageAvailabilityScreen
- **Goal:** Extract availability management screen
- **Risk level:** HIGH - Contains duplicate logic shared with EditVideoScreen
- **Status:** DONE - Committed in 6a0bf03
- **Definition of done:**
  - ✅ Extracted to separate file
  - ✅ Build passing with zero errors
  - ✅ Browser verified on localhost
  - ✅ Committed
- **Dependencies:**
  - ✅ All listing screens done (WelcomeScreen, ManageListingsScreen, CreateListingScreen, EditListingScreen)
  - Complex time slot manipulation logic
- **Blocked:** No
- **Note:** This screen has overlapping logic with EditVideoScreen - both manage availability

### 6. ✅ EditVideoScreen
- **Goal:** Extract introduction video + availability editor screen
- **Risk level:** HIGHEST - Contains video recording, upload, AND duplicate availability UI
- **Status:** DONE - Committed in da86a4c
- **Definition of done:**
  - ✅ Extracted to separate file
  - ✅ Build passing with zero errors
  - ✅ Browser verified on localhost
  - ✅ Committed
- **Dependencies:**
  - ✅ All other screens extracted first (WelcomeScreen, ManageListingsScreen, CreateListingScreen, EditListingScreen, ManageAvailabilityScreen)
  - Shares availability logic with ManageAvailabilityScreen
  - Most complex extraction due to multiple concerns in one screen
- **Blocked:** No
- **Note:** This was intentionally last due to complexity and duplication issues

---

**SCREEN EXTRACTION PHASE: COMPLETE**

All 6 planned screen extractions are now committed:
- WelcomeScreen (5bd16c3)
- ManageListingsScreen (11b53be)
- CreateListingScreen (e92ee82)
- EditListingScreen (01a9236)
- ManageAvailabilityScreen (6a0bf03)
- EditVideoScreen (da86a4c)

Total reduction: 1,091 lines (10.4% of original 10,468-line monolith)

---

## 7. Product Roadmap After Architecture Stabilization

**These changes are DEFERRED until all 6 screens are extracted and committed.**

### Phase 1: Language Cleanup
- Replace "Offer" → "Session style" or "Room" everywhere
- Replace "Manage Offers" → "Manage your rooms"
- Replace "Create Offer" → "Define your session style"
- Remove all raw admin strings ([DEV], [ADMIN], STRIPE_STATE, build: v3-...)
- Remove "Many interests" filler text
- Remove "Make your offer irresistible" placeholder

### Phase 2: Availability Display Refinement
- Remove raw slot counts from headings ("329 slots" → "Your upcoming open times")
- Group availability by day with visual hierarchy
- Show next 3-5 specific openings prominently
- Dynamic availability signals on cards ("Available today" / "Next available: Tuesday")

### Phase 3: Trial Tier Clarity
- Explain Trial rate locking: $25 per 25-min session, fixed during Trial
- Show graduation requirements clearly:
  - 14 days minimum
  - 5 completed sessions
  - 4/5 receiver confirmations of being heard
  - No no-shows, max 1 cancellation
  - No conduct flags
- Add Trial badge/indicator where rate is shown

### Phase 4: Checkout Price Breakdown
- Show full breakdown BEFORE payment confirmation:
  - Session rate: $25.00
  - Platform fee: $4.42
  - Total: $29.42
- Never show $29.42 for first time at payment moment
- Add "What happens first" section before checkout:
  - You will have the floor first
  - You will not be interrupted
  - Your holder will reflect back what they heard before the conversation opens

### Phase 5: Pre-Session Ritual Screens
**Build new screens (don't exist yet):**
- Pre-session entry screen for speaker: "You begin with the floor. Take the time you need to say it clearly."
- Pre-session entry screen for holder: "Listen fully first. Reflect back what you heard before moving into dialogue."
- Both show: "This room begins with understanding before reaction."
- Design: dark, quiet, intentional threshold crossing

### Phase 6: Sessions/Bookings Cleanup
- Consistent state labels: Requested / Confirmed / Live / Completed / Canceled / Refunded
- Remove "YOU BOOKED" → "You booked"
- Remove "25-minute booking" → "25-min session"
- Remove "Session ended" → "Completed"
- Remove "As Seeker (10)" → "As seeker"

---

## 8. Immediate Next Step

**Question:** What is the next irreversible move from the real current state?

**Answer:** Review the post-extraction architecture state and decide the next phase of work.

**Why this is the next step:**
1. All 6 screen extractions are complete (EditVideoScreen committed in da86a4c)
2. Build is passing with zero errors
3. App.tsx reduced from 10,468 to 9,377 lines (1,091 lines removed, 10.4% reduction)
4. Architecture stabilization goal achieved: screens now have clear render ownership boundaries
5. Product work can now proceed on stable architectural foundation

**Current state:**
- ✅ 6 extracted screens committed and browser-verified
- ✅ No circular dependencies from App.tsx
- ✅ State mutations encapsulated in callbacks
- ✅ Build passing with zero TypeScript errors
- ✅ All screens visually verified in localhost

**Possible next phases:**
- Product/copy cleanup (see Section 7)
- Further architectural refinement
- New feature development
- Performance optimization
- Other priorities determined by user

---

## 9. Decision Log

### 2026-03-29 - Initial execution plan created
- Documented current state: WelcomeScreen done, ManageListingsScreen extracted but not verified
- Identified verification blocker: UI path to ManageListingsScreen not visible
- Hypothesis: is_giver flag missing from test account (unverified)
- Established extraction order and rules
- Deferred all product work until architecture stable
- Next move: Diagnose test account database state, then resolve verification blocker

### 2026-03-29 - ManageListingsScreen completed
- Browser verified through real localhost UI flow ("Become available" → giver onboarding)
- Committed in 11b53be
- App.tsx reduced to 10,217 lines
- Build passing with zero errors
- Navigation/product wording confusion noted as deferred product debt
- CreateListingScreen is now ready to start (no blockers)
- Next move: Locate CreateListingScreen lines in App.tsx and prepare extraction plan

### 2026-03-29 - CreateListingScreen completed
- Extracted to src/screens/CreateListingScreen.tsx
- Added local Mode and Category type definitions to avoid circular dependencies
- Browser verified on localhost through "Your rooms" → "Define your session style" path
- Committed in e92ee82
- App.tsx reduced to 9,954 lines (263 lines removed net)
- Build passing with zero errors
- EditListingScreen is now ready to start (no blockers)
- Next move: Locate EditListingScreen block in App.tsx and prepare extraction plan only

### 2026-03-29 - EditListingScreen completed
- Extracted to src/screens/EditListingScreen.tsx
- Added local Mode and Category type definitions to avoid circular dependencies
- Browser verified on localhost through "Your rooms" → click existing listing → edit form
- Committed in 01a9236
- App.tsx reduced to 9,805 lines (149 lines removed net)
- Build passing with zero errors
- ManageAvailabilityScreen is now ready to start (no blockers)
- Next move: Locate ManageAvailabilityScreen block in App.tsx and prepare extraction plan only

### 2026-03-29 - ManageAvailabilityScreen completed
- Extracted to src/screens/ManageAvailabilityScreen.tsx
- Added local AvailabilitySlot and Giver type definitions to avoid circular dependencies
- Browser verified on localhost through "Account and Profile" → "Video & Availability" → "Availability"
- Committed in 6a0bf03
- App.tsx reduced to 9,621 lines (184 lines removed net)
- Build passing with zero errors
- EditVideoScreen is now ready to start (final screen, highest complexity)
- Next move: Locate EditVideoScreen block in App.tsx and prepare extraction plan only

### 2026-03-30 - EditVideoScreen completed
- Extracted to src/screens/EditVideoScreen.tsx
- Added local AvailabilitySlot, Giver, and VideoStep type definitions to avoid circular dependencies
- Most complex extraction: combined video recording, upload, AND availability management
- Browser verified on localhost through "Account and Profile" → "Video & Availability"
- Committed in da86a4c
- App.tsx reduced to 9,377 lines (244 lines removed net)
- Build passing with zero errors
- **All 6 screen extractions now complete**
- **Architecture stabilization phase complete**
- Total reduction: 1,091 lines (10.4% of original 10,468-line monolith)
- Next phase: Review post-extraction state and decide next work

---

**Document status:** Living document, update after each extraction or major decision
**Last updated:** 2026-03-30
**Current phase:** Architecture Stabilization complete
**Extraction progress:** 6 of 6 screens committed
