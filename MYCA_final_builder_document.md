# MYCA — Final Builder Document
## Master context, complete spec, and staged implementation prompts
## All decisions locked. Ready to execute.

---

# PART 1 — MASTER CONTEXT
## Paste this once at the start of every Claude Code session

You are working on the MYCA frontend.
Tech stack: React 18, TypeScript, Vite, Supabase, Tailwind, Vercel.

Do not touch backend logic, session engine, payment processing, or video/call infrastructure.
Only touch the UI layer: copy strings, color tokens, component markup, CSS classes, layout structure.

Core rule: every change must be surgical.
Show me the exact file, exact line, exact before and after.
Do not rewrite entire components unless explicitly asked.
Do not refactor logic.
Do not rename functions or variables.
Only change what is visible to a user.

When you finish each prompt, tell me exactly what you changed and wait for confirmation before moving to the next.

---

# PART 2 — LOCKED PRODUCT DECISIONS
## These are final. Do not interpret. Do not deviate.

### Decision 1 — Form naming
Create/edit form page title: "Define your session style"
Helper line beneath the title: "This is how people will understand what kind of space you can hold."
Field label inside the form: "How do you hold the room?"
The word "room" lives inside the product language and field labels. It does not become the main administrative noun in navigation or page titles.

### Decision 2 — Navigation and management naming
Account-level navigation order: Profile / Session style / Availability / Sessions
Management page title for the list of a user's session styles: "Your rooms"
Single create/edit page title: "Define your session style"
Do not use "Organize your room" anywhere.

### Decision 3 — Trial stage pricing and graduation
Trial means:
- $25 per 25-minute session
- 1 session per day maximum
- Rate is locked during Trial
- No self-editing of price during Trial

Graduation out of Trial requires all of the following:
- Minimum 14 days on platform
- At least 5 completed Trial sessions
- At least 4 out of the last 5 receivers confirm they felt accurately heard
- No no-shows
- No more than 1 cancellation
- No conduct flags

On-screen copy for Trial stage display:
Title: Trial
Body: You are starting here. $25 per 25-minute session. 1 session per day. Your rate stays fixed during Trial. Graduate by completing 5 clean sessions over at least 14 days, with strong receiver confirmation and no reliability issues.

### Decision 4 — Availability signals
Availability is receiver-led. The receiver selects a preferred time window first. The system returns matches.

Public card availability signal rules:
- If available today: show a small availability indicator with no label needed, or "Available today"
- If next slot is not today: show "Next available: [day]" dynamically — never hardcoded
- Never show nothing simply because the person is not available today
- Never show a raw slot count

Public profile availability display:
Section title: Availability
Contents:
- Typical weekly schedule (e.g. Mon 1–3 PM / Wed 6–8 PM / Fri 10 AM–12 PM)
- Next 3–5 specific openings with date and time
- "See more" to expand
- Never show "329 slots" or any raw inventory count

---

# PART 3 — DESIGN TOKENS
## Exact values. Implement globally before any screen work.

### Colors

| Token name | Value |
|---|---|
| Page background | #060606 |
| Secondary surface | #0B0B0C |
| Raised card / panel | #111214 |
| Subtle border | rgba(255,255,255,0.08) |
| Emphasis border | rgba(200,174,106,0.35) |
| Primary text | #F4F1EA |
| Secondary text | rgba(244,241,234,0.72) |
| Muted text | rgba(244,241,234,0.48) |
| Accent gold | #C8AE6A |
| Accent gold hover | #D7BE7D |
| Success / available | muted warm gold-green — no bright green |
| Danger / destructive | deep subdued red — no neon |

### Corner radius

| Element | Value |
|---|---|
| Buttons | 14px |
| Inputs | 14px |
| Cards | 20px |
| Large panels / hero | 24px |
| Pills / tags | 999px |

### Spacing
Base unit: 8px
Common values: 16 / 24 / 32 / 40 / 56

### Shadows
Very subtle. Low spread. High softness. No bright glows. No glassmorphism.

### Layout
12-column grid on desktop. Max width 1360–1440px. Generous horizontal padding.
Do not leave empty black space that feels accidental. Let faces and copy carry the weight.

### Button hierarchy
Primary: solid #C8AE6A fill, dark text, 14px radius — one per panel maximum
Secondary: dark surface, rgba(200,174,106,0.35) border, gold text
Destructive: deep subdued red, visually receded, never the most prominent element on screen
Ghost: muted text only, no border unless hovered

---

# PART 4 — COMPLETE COPY CHANGE REFERENCE
## Every visible string. Old on the left. New on the right.

### Global string replacements — apply everywhere

| Old | New |
|---|---|
| Find a person | Get heard |
| Offer your time | Become available |
| Create Offer | Define your session style |
| Edit Offer | Edit your session style |
| My Offers | Your rooms |
| Manage Offers | Manage your rooms |
| What You Offer | Your rooms |
| Create New Offer | Define a new session style |
| Manage Availability | Availability |
| Profile & Settings | Account and Profile |
| Your Calls | Sessions |
| Name your price | Current session rate |
| per block | per 25-min session |
| Directions you allow | What kind of room can you hold? |
| Hard no's | Boundaries |
| Make your offer irresistible | Why do people leave clearer after talking to you? |
| Many interests | (remove — require real one-line description) |
| Keep going | Keep going |
| Hear your perspective | Listening and reflection |
| Think together | Thinking together |
| Define next step | Clarifying the next move |
| Pressure test | Direct challenge |
| End cleanly | REMOVE as selectable option — platform default, not a room style |
| Allow instant booking | Instant booking |
| Record Video | Record video |
| Copy Your Profile Link | Copy profile link |
| Rate (standalone section label) | Your current rate |
| Your Upcoming Availability (329 slots) | Your next open times |
| Your Availability (329 slots) | Your upcoming open times |
| Your Slots (329) | Upcoming open times |
| Add Availability | Add these times |
| Your Commitment (section header only) | Remove the header. Keep the body copy. |
| If you cancel: They get refunded. You receive nothing. | If you cancel, they are refunded and you receive nothing. |
| If they cancel: You keep their payment. | If they cancel, platform policy applies. |
| Only offer times you can reliably keep. | Only open times you can reliably keep. |
| vault (tag label) | Draft |
| As Seeker (10) | As seeker |
| YOU BOOKED | You booked |
| 25-minute booking | 25-min session |
| Session ended | Completed |
| Save Profile | Save |
| Tagline | How do you hold the room? |
| Bio/background (optional, 500 char max) | Why do people leave clearer after talking to you? |
| Share a bit about your background and experience... | Describe what kind of clarity, challenge, steadiness, or perspective you tend to bring. |
| 6 offers | 6 session styles |
| Share Your Profile | Share your profile |
| Share this on Instagram, Twitter, or anywhere you want people to find you. | Share your profile link wherever people should find you. |
| Control when you're available for bookings. This applies to all your offerings. | Only open times you can reliably keep. |
| Each offer is a different type of conversation you offer. You can offer multiple modes (listening, teaching, etc.) at different prices. | Each session style is a different way you hold space. |
| Book a Session | Book this session |
| Session price $29.42 (no context) | Session rate $25.00 + Platform fee $4.42 = Total $29.42 |
| Introduction Video | Introduction video |
| Record your introduction video (15-30 seconds) | A short video helps people feel your presence before booking. |
| Profile Picture | Profile photo |
| Square image works best. Face visible. Good lighting. | Square image, face visible, good lighting. |
| Stay within your selected category (0/200) | REMOVE |

### Global removals — remove from all UI-facing renders

Remove every visible instance of:
- [DEV] anything
- [ADMIN] anything
- build: v3-... or any build string
- STRIPE_STATE
- Any raw JSON object rendered to screen
- hasStripeAccountId or any raw key-value Stripe state
- isGiver or any internal flag rendered as text
- 329 slots or any raw slot count used as a heading or hero label
- vault unless redefined as Draft or Inactive
- Many interests
- Make your offer irresistible
- Hard no's
- End cleanly as a selectable room/session direction

---

# PART 5 — PAGE-BY-PAGE SPEC

### LANDING PAGE

Hero headline: Get understood first.

Hero subheadline (three lines):
You speak first without interruption.
They reflect back what they heard.
Then the conversation opens.

Primary CTA: Get heard
Secondary CTA: Become available
Line below CTAs: Most people can do both.

Remove: any duplicate block that repeats the subheadline lower on the page.

Add below hero — section: How it works

Step 1 / Speak first / You begin without interruption.
Step 2 / Be reflected back / Your holder repeats back what they heard.
Step 3 / Continue with clarity / Then the conversation opens.

One paragraph below the three steps:
Your attention has weight. When you have room, make yourself available.

Design: full-width hero. Large headline. Centered or split layout. Two CTAs. Three-step section in columns below. No narrow left-rail card layout. No dead space to the right.

---

### DISCOVERY / BROWSE

Card element order (top to bottom):
1. Face or intro video thumbnail — large, dominant
2. Name
3. One-line session style description — required, not filler
4. Session direction pills (e.g. Listening · Thinking together · Direct challenge)
5. Stage badge (Trial / Trusted / Proven)
6. Rate: $25 / 25 min
7. Availability signal: "Available today" or "Next available: [day]" or nothing if dynamic shows no upcoming slots
8. Trust signal: e.g. 18 completed sessions

Remove: "Many interests" or any generic filler
Remove: price as the dominant element above identity
Tabs: All / Saved — keep, but make Saved quieter

---

### PUBLIC PROFILE

Section 1 — Identity
Large face or intro video at top
Name
One-line session style description (required)
Stage badge
Rate: $25 / 25 min
Trust stat: e.g. 18 completed sessions
Primary CTA: Book this session

Section 2 — How this room begins
Every session starts with uninterrupted expression. Your holder listens fully, then reflects back what they heard. Then the conversation opens.

Section 3 — How I hold the room
(Provider fills in — short paragraph)

Section 4 — What kind of room I can hold
Pills: Listening and reflection / Thinking together / Direct challenge / Clarifying the next move / Perspective shift

Section 5 — Who gets the most from this room
(Provider fills in — short paragraph)

Section 6 — Availability
Typical schedule (e.g. Mon 1–3 PM)
Next 3–5 specific openings
See more option

Section 7 — Book this session
Choose day / Choose time / 25 min session
Session rate $25.00 + Platform fee $4.42 = Total $29.42

Never show: 329 slots, raw inventory counts, price mismatch without explanation.

---

### ACCOUNT AND PROFILE

Page title: Account and Profile

Section: Account
Email
Timezone
Sign out

Section: Profile
Profile photo
Introduction video — label: "A short video helps people feel your presence before booking."
Name
How do you hold the room? (placeholder: One line. What kind of space do you create?)
Why do people leave clearer after talking to you? (placeholder: Describe what kind of clarity, challenge, steadiness, or perspective you tend to bring.)
Who gets the most value from your room? (placeholder: Describe the kind of person or situation where you are most useful.)
Save

Section: Your rooms
(Links to manage session styles)
Current rate display with Trial stage explanation (see Part 2, Decision 3)

Section: Availability
Current stage and daily session cap
Next open times (compact, 3–5)
Manage availability

---

### DEFINE YOUR SESSION STYLE (Create / Edit)

Page title: Define your session style
Helper line: This is how people will understand what kind of space you can hold.

Fields in order:

Photo
Label: Photo

Introduction video
Label: Introduction video
Help text: A short video helps people feel your presence before booking.

One-line description
Label: How do you hold the room?
Placeholder: One line. What kind of space do you create?

Longer description
Label: Why do people leave clearer after talking to you?
Placeholder: Describe what kind of clarity, challenge, steadiness, or perspective you tend to bring.

Audience fit
Label: Who gets the most value from this room?
Placeholder: Describe the kind of person or situation where you are most useful.

Session directions
Label: What kind of room can you hold?
Options (checkboxes):
- Keep going / Continue exploring together
- Listening and reflection / Listen without redirecting
- Thinking together / Collaborative dialogue with turn-taking
- Clarifying the next move / Help identify concrete next steps
- Direct challenge / Challenge their thinking directly
- Perspective shift / Offer a reframe from outside the situation
Remove entirely: End cleanly

Boundaries
Label: Boundaries
Placeholder: Name topics, formats, or situations you will not take on.

Instant booking
Label: Instant booking
Body: When this is on, someone can book your next open time immediately. When it is off, you review requests first.

Rate display (Trial)
Trial — $25 per 25-min session
Your rate stays fixed during Trial. (See graduation requirements in your account.)

Submit button (create): Create this room
Submit button (edit): Save changes

Remove entirely from this page: category grid (Health & Wellness, Relationships, etc.) from primary view. If it must exist, collapse it into an optional advanced section at the bottom.
Remove entirely: "Stay within your selected category" character counter label.

---

### YOUR ROOMS (management list)

Page title: Your rooms

Buttons:
+ Define a new session style
Availability

Session style cards:
Remove: vault tag — replace with Draft if unpublished
Show: session style description, rate, direction pills, Edit button

---

### AVAILABILITY

Page title: Availability

Top display (Stage and cap):
Trial
1 session per day

Add open times section:
From / To / Opens at / Closes at / Repeat on / Add these times

Upcoming open times section:
Grouped by day
Show next 7 days expanded
Show more control to expand beyond 7 days
Never show a raw count like "329" as a header or label

Commitment copy (no section header):
When someone books your time, they pay up front.
If you cancel, they are refunded and you receive nothing.
If they cancel, platform policy applies.
Only open times you can reliably keep.

Clear All button: move to bottom of page, subdued red, visually receded.

---

### SESSIONS (formerly Your Calls)

Page title: Sessions

Remove entirely and immediately:
- [DEV] View Raw Bookings Data
- [ADMIN] Email Events Audit Trail
- build: v3-profiles-stripe-debug
- STRIPE_STATE and any raw JSON

Session list sections:
Upcoming
Pending review (if instant booking is off)
Completed

Session states:
Requested / Confirmed / Live / Completed / Canceled / Refunded

Card copy:
You booked (not YOU BOOKED)
25-min session (not 25-minute booking)
Completed (not Session ended)
As seeker (not As Seeker (10))

---

### CHECKOUT / BOOKING PANEL

Before payment, show this block:

Section: What happens first
You will have the floor first.
You will not be interrupted.
Your holder will reflect back what they heard before the conversation opens.

Price display:
Session rate: $25.00
Platform fee: $4.42
Total: $29.42

This breakdown must be visible before the user confirms payment.
Never surface $29.42 for the first time at the moment of confirmation when all prior screens said $25.

---

### PRE-SESSION ROOM ENTRY (build this screen — does not yet exist)

For the speaker (person who booked):
Headline: You begin with the floor.
Body: Take the time you need to say it clearly.
Footer: This room begins with understanding before reaction.

For the holder (person being booked):
Headline: Listen fully first.
Body: Reflect back what you heard before moving into dialogue.
Footer: This room begins with understanding before reaction.

This screen should feel like crossing a threshold.
Not a Zoom waiting room.
Not a loading screen.
Quiet, dark, intentional.

---

# PART 6 — STAGED IMPLEMENTATION PROMPTS
## Run these one at a time. Confirm each before moving to the next.

---

## PROMPT 1 — Emergency: Remove all debug and internal leakage

Find every string in the codebase that contains any of the following and remove them from all UI-facing renders. Do not delete the underlying logic. Only remove from display.

- "[DEV]"
- "[ADMIN]"
- "build: v3" or any build string
- "STRIPE_STATE"
- "hasStripeAccountId"
- "onboardingComplete"
- "isGiver"
- any raw JSON object rendered to the screen

Show me every file and line you are touching before making any changes.

---

## PROMPT 2 — Design tokens

Find where global CSS variables, Tailwind config, or theme tokens are defined. Replace the color system with exactly these values and no others:

--color-bg-primary: #060606
--color-bg-secondary: #0B0B0C
--color-surface-raised: #111214
--color-border-subtle: rgba(255,255,255,0.08)
--color-border-emphasis: rgba(200,174,106,0.35)
--color-text-primary: #F4F1EA
--color-text-secondary: rgba(244,241,234,0.72)
--color-text-muted: rgba(244,241,234,0.48)
--color-accent: #C8AE6A
--color-accent-hover: #D7BE7D

Border radius:
--radius-button: 14px
--radius-input: 14px
--radius-card: 20px
--radius-panel: 24px
--radius-pill: 999px

Show me where these are currently defined before changing anything.

---

## PROMPT 3 — Global string replacements

Do a global find and replace across all UI-facing strings. Do not touch variable names, function names, or database fields. Only visible user-facing text.

Exact replacements:
"Find a person" → "Get heard"
"Offer your time" → "Become available"
"Create Offer" → "Define your session style"
"Edit Offer" → "Edit your session style"
"My Offers" → "Your rooms"
"Manage Offers" → "Manage your rooms"
"What You Offer" → "Your rooms"
"Create New Offer" → "Define a new session style"
"Manage Availability" → "Availability"
"Profile & Settings" → "Account and Profile"
"Your Calls" → "Sessions"
"Name your price" → "Current session rate"
"per block" → "per 25-min session"
"Directions you allow" → "What kind of room can you hold?"
"Hard no's" → "Boundaries"
"Make your offer irresistible" → "Why do people leave clearer after talking to you?"
"Keep going" stays
"Hear your perspective" → "Listening and reflection"
"Think together" → "Thinking together"
"Define next step" → "Clarifying the next move"
"Pressure test" → "Direct challenge"
"Allow instant booking" → "Instant booking"
"Record Video" → "Record video"
"Copy Your Profile Link" → "Copy profile link"
"Rate" (standalone section label only) → "Your current rate"
"Your Upcoming Availability (329 slots)" → "Your next open times"
"Your Availability (329 slots)" → "Your upcoming open times"
"Your Slots (329)" → "Upcoming open times"
"Add Availability" → "Add these times"
"Your Commitment" (section header only) → remove header, keep body copy beneath it
"If you cancel: They get refunded. You receive nothing." → "If you cancel, they are refunded and you receive nothing."
"If they cancel: You keep their payment." → "If they cancel, platform policy applies."
"Only offer times you can reliably keep." → "Only open times you can reliably keep."
"vault" tag → "Draft"
"As Seeker (10)" → "As seeker"
"YOU BOOKED" → "You booked"
"25-minute booking" → "25-min session"
"Session ended" → "Completed"
"Save Profile" → "Save"
"Tagline" → "How do you hold the room?"
"Bio/background (optional, 500 char max)" → "Why do people leave clearer after talking to you?"
"Share a bit about your background and experience..." → "Describe what kind of clarity, challenge, steadiness, or perspective you tend to bring."
"6 offers" → "6 session styles"
"Share this on Instagram, Twitter, or anywhere you want people to find you." → "Share your profile link wherever people should find you."
"Control when you're available for bookings. This applies to all your offerings." → "Only open times you can reliably keep."
"Each offer is a different type of conversation you offer. You can offer multiple modes (listening, teaching, etc.) at different prices." → "Each session style is a different way you hold space."
"Book a Session" → "Book this session"
"Introduction Video" → "Introduction video"
"Record your introduction video (15-30 seconds)" → "A short video helps people feel your presence before booking."
"Profile Picture" → "Profile photo"
"Square image works best. Face visible. Good lighting." → "Square image, face visible, good lighting."
"Stay within your selected category (0/200)" → remove entirely
"Many interests" → remove entirely, leave field empty, mark as required

Show me every file affected before changing.

---

## PROMPT 4 — Landing page

Find the landing page component. Make only these changes:

1. Replace hero headline with: Get understood first.
2. Replace subheadline with these three lines:
   You speak first without interruption.
   They reflect back what they heard.
   Then the conversation opens.
3. Add one line below the two CTA buttons: Most people can do both.
4. Find any duplicate copy block that repeats the subheadline lower on the page and remove it.
5. Add a three-step section below the hero with this exact content:
   Step 1 — Speak first / You begin without interruption.
   Step 2 — Be reflected back / Your holder repeats back what they heard.
   Step 3 — Continue with clarity / Then the conversation opens.
   One paragraph below those three steps: Your attention has weight. When you have room, make yourself available.

Do not change layout structure beyond what is required to place these strings.

---

## PROMPT 5 — Checkout price display

Find the booking panel or checkout component where session price is displayed.

Currently it shows $25 on the card and $29.42 at checkout with no explanation.

Change the total price display to show:
Session rate: $25.00
Platform fee: $4.42
Total: $29.42

If the fee amount is dynamic, pull it from whatever variable already holds it.
Do not hardcode values.
Make the breakdown visible before the user confirms payment.

Also add this block above the price display if it does not already exist:

Section heading: What happens first
Line 1: You will have the floor first.
Line 2: You will not be interrupted.
Line 3: Your holder will reflect back what they heard before the conversation opens.

---

## PROMPT 6 — Discovery card

Find the Giver or provider card component used in the browse and discovery view.

Make these changes:
1. If the session style description field is empty, show nothing. Do not show "Many interests" or any filler.
2. Change price display from "$25 per block" to "$25 / 25 min"
3. Availability signal logic:
   - If available today: show "Available today"
   - If next slot is not today: show "Next available: [day]" using dynamic data
   - Never hardcode "Next available today"
   - Never show nothing simply because the person is unavailable today
4. Add stage badge (Trial / Trusted / Proven) from whatever field holds stage data.
5. Add session direction pills below the name using whatever directions the Giver has selected.
6. Add completed sessions count as a quiet trust signal below the direction pills.

Do not change card dimensions or layout beyond what is needed for these additions.

---

## PROMPT 7 — Define your session style form

Find the Create Offer and Edit Offer component.

1. Change page title to: Define your session style
2. Add this line at the top of the form above all fields: This is how people will understand what kind of space you can hold.
3. Add a required field labeled: How do you hold the room? / Placeholder: One line. What kind of space do you create?
4. Add a field labeled: Who gets the most value from this room? / Placeholder: Describe the kind of person or situation where you are most useful.
5. Remove "End cleanly" from the direction checkboxes entirely.
6. Add one new checkbox option: Perspective shift / Offer a reframe from outside the situation.
7. Remove the category grid (Health & Wellness, Relationships, etc.) from the primary form view. If it must exist, move it below all other fields as a collapsed optional section.
8. Remove the "Stay within your selected category (0/200)" label entirely.
9. Change submit button on create to: Create this room
10. Add a Trial rate display below the rate field with this copy:
    Trial
    $25 per 25-min session
    Your rate stays fixed during Trial. Graduate by completing 5 clean sessions over at least 14 days, with strong receiver confirmation and no reliability issues.

---

## PROMPT 8 — Availability page

Find the Manage Availability component.

1. Remove the raw slot count from the header. Do not show "329 slots" or any slot count as a headline.
2. Group slots by day. Show next 7 days expanded. Add a Show more control to expand further.
3. Remove the "Your Commitment" section header. Keep the four body lines. Remove only the bold header.
4. Move the Clear All Slots button to the bottom of the page. Reduce its visual weight — subdued red, smaller, not the most prominent element on screen.
5. Add a stage and cap display at the top of the page:
   Trial
   1 session per day

---

## PROMPT 9 — Sessions page

Find the Your Calls or Sessions list component.

1. Page title: Sessions
2. Confirm all DEV, ADMIN, build, and STRIPE_STATE strings were removed in Prompt 1. If anything remains, remove it now.
3. Replace "As Seeker (10)" with "As seeker"
4. Replace "YOU BOOKED" with "You booked"
5. Replace "25-minute booking" with "25-min session"
6. Replace "Session ended" with "Completed"
7. Ensure session state labels across all cards use only: Requested / Confirmed / Live / Completed / Canceled / Refunded

---

## PROMPT 10 — Final audit

Search the entire codebase for any remaining instances of these strings in UI-facing renders.

List every file and line where they still appear:

"vault"
"Many interests"
"Create Offer"
"Edit Offer"
"My Offers"
"Find a person"
"Offer your time"
"Make your offer irresistible"
"Hard no's"
"End cleanly"
"[DEV]"
"[ADMIN]"
"STRIPE_STATE"
"build:"
"per block"
"Your Calls"
"Profile & Settings"
"Manage Availability"
"Manage Offers"
"329 slots"
"329"
"25-minute booking"
"Session ended"
"YOU BOOKED"
"Name your price"
"Tagline"
"Bio/background"
"What You Offer"
"Rate" as a standalone section label
"vault"
"isGiver"
"hasStripeAccountId"

Report all findings before changing anything.

---

# PART 7 — ACCEPTANCE CRITERIA
## The implementation is complete when all of these are true.

A new user understands in under ten seconds that this is not a normal video call app.
A new user understands exactly how every session begins before they book.
A user never has to choose a permanent giver or receiver identity to use the platform.
A public card communicates the session style before it communicates the price.
The landing page feels like one coherent world, not a narrow app card with dead space.
The profile page feels like a person, not a directory listing.
The session style form feels like defining identity and standards, not filling out an admin form.
The availability page feels like presence and commitment, not inventory management.
The checkout shows a complete price breakdown before the user confirms payment.
The pre-session room entry screen, when built, feels like crossing a threshold.
The whole product feels darker, quieter, more serious, and more cohesive than the current version.
No debug strings, admin links, build tags, raw JSON, or internal state is visible to any user.
The Trial stage rate and graduation requirements are explained clearly on the rate-related screens.
Availability signals on cards are dynamic, never hardcoded, never absent when future slots exist.
