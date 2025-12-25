# MYCA TODO

## Calendar-Based Availability - LOGGED FOR CONTINUATION

Migration from weekly recurring to calendar-based availability per constitution.

### Completed:
- ✅ Database migration created (giver_availability table with RLS policies)
- ✅ TypeScript types updated (AvailabilitySlot interface)
- ✅ Removed WeeklyAvailability from Giver interface
- ✅ Updated state variables (availabilitySlots, newSlotDate, newSlotTime)

### Blocker:
Extensive UI refactor required across multiple screens:
- Giver profile setup screen (lines 2200-2400)
- Booking flow screen (lines 1300-1500)
- Multiple helper functions (toggleTimeSlot, getTotalSlots, getAvailableDates)

**Per autonomous protocol**: After 3 attempts, complex UI migration logged.

### Path Forward (when resumed):
1. Comment out old weekly availability UI sections
2. Add simple date input + time select for givers
3. Store slots to giver_availability table via Supabase
4. Fetch available slots for booking flow
5. Show real dates to seekers (no day-of-week abstraction)

**Decision**: Core constitutional items 1-6 complete and deployed.
Calendar UI is final piece, requires focused refactor session.

### Workaround for Testing:
- Keep current UI functional for now
- Schema ready for when UI is updated
- New bookings will work with either system
