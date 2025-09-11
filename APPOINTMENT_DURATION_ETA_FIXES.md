# Appointment Duration and ETA Fixes

## Issues Fixed:

### 1. **Consultation Duration Updates**
**Problem**: The `duration_minutes` field was never updated with actual consultation time.
**Solution**: 
- Added logic to calculate actual consultation duration when marking appointment as completed
- Updates `duration_minutes` field with actual time spent (from `actual_start_time` to `actual_end_time`)
- Enhanced display to show both planned and actual duration

### 2. **ETA (Estimated Time of Arrival) Issues**
**Problem**: ETA system was incomplete and often showed irrelevant information.
**Solution**:
- Fixed ETA display to only show when appointment is in queue and has valid estimated start time
- Removed ETA display for completed/cancelled appointments (not relevant)
- Changed label from "ETA" to "Estimated Start" for clarity
- Set initial estimated_start_time when creating appointments

### 3. **Duration Display Improvements**
**Enhanced**: 
- Appointment details modal now shows "Actual Consultation Duration" vs "Planned Duration"
- Main appointments list shows actual duration for completed appointments
- Added visual indicators when actual duration differs from planned

## Files Modified:
1. `src/components/appointmentComponents/AppointmentDetailsModal.tsx`
   - Added duration_minutes to update patch type
   - Fixed completion logic to update actual duration
   - Improved ETA display logic
   - Enhanced duration display with planned vs actual

2. `src/pages/Appointments.tsx`
   - Added actual duration display for completed appointments

3. `src/components/appointmentComponents/AddAppointmentModal.tsx`
   - Set initial estimated_start_time when creating appointments

## What ETA Actually Is:
ETA (Estimated Time of Arrival) is primarily useful for:
- Queue management systems where patients wait in line
- Real-time updates when appointments are running late
- Managing patient expectations about wait times

For basic appointment scheduling (non-queue based), ETA is less relevant since appointments have specific scheduled times.

## Testing:
1. Create a new appointment - should have estimated_start_time set
2. Start an appointment (In-Progress) - should record actual_start_time
3. Complete an appointment - should update duration_minutes with actual time
4. Check appointment details - should show both planned and actual duration
