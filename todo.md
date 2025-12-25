# MYCA TODO

## Calendar-Based Availability - IN PROGRESS

Started migration from weekly recurring to calendar-based availability per constitution.

### Completed:
- ✅ Database migration created (giver_availability table)
- ✅ TypeScript types updated (AvailabilitySlot interface)
- ✅ Removed WeeklyAvailability type from Giver interface

### Remaining UI Work:
- [ ] Update giver profile setup to select specific dates (not days of week)
- [ ] Add date picker for givers to choose available dates
- [ ] Update booking flow to show real calendar dates to seekers
- [ ] Remove DAYS_OF_WEEK constant and weekly UI components
- [ ] Fetch availability slots from new table instead of JSON field
- [ ] Mark slots as booked when booking is created

### Approach:
Per DECISION RULES: Choose simpler interpretation.
- Minimum viable: Single date picker + time dropdown
- Giver picks date, picks time, adds to list
- Seeker sees list of actual dates/times
- No complex calendar UI needed for MVP

This is a significant change. Proceeding step by step per autonomous protocol.
