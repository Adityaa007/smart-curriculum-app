# AI-Powered Daily Routine Generator

This feature will turn a student's static timetable into a dynamic, AI-optimized daily plan that accounts for their career goals, interests, and free time.

## User Review Required

> [!IMPORTANT]
> **Manual Override**: Users can now fully edit, add, or delete AI-generated tasks. This gives them final control over their schedule.
> **Productivity-Based Streaks**: A streak day only counts if at least **50% of tasks** are marked as "Completed".
> **Partial Regeneration**: We are adding a feature to "Swap" or "Regenerate" a single routine slot if the student doesn't like a specific suggestion.
> **Auto-Save**: Routines are automatically persisted to Firestore upon generation.

## Proposed Changes

---

### 1. Backend Enhancement

#### [MODIFY] [app.py](file:///c:/Users/Aditya/.gemini/antigravity/scratch/backend/app.py)
- Update `POST /api/generate-routine` to handle full generation AND single-slot regeneration.
- Implement **Smart Scheduling**:
  - Direct Gemini to assign high-intensity/cognitive tasks between 8 AM - 12 PM.
  - Direct Gemini to assign low-intensity/relaxing tasks after 6 PM.
- Implement a 1-retry mechanism for AI parsing failures.
- Define a structured `get_fallback_routine()` with high-quality default entries.

---

### 2. Frontend — Profile Expansion

#### [MODIFY] [CareerGoals.jsx](file:///c:/Users/Aditya/.gemini/antigravity/scratch/frontend/src/pages/CareerGoals.jsx)
- Add new fields to the profile form:
  - **Study Preference**: Dropdown (Morning, Afternoon, Evening, Night).
  - **Daily Free Time**: Number input (Hours per day).
- Update Firestore save logic to include these fields in `users/{uid}`.

---

### 3. Frontend — Daily Routine Page

#### [NEW] [DailyRoutine.jsx](file:///c:/Users/Aditya/.gemini/antigravity/scratch/frontend/src/pages/DailyRoutine.jsx)
- **Data Fetching & Save**:
  - Load and auto-save routines to `routines` collection.
  - Streak Logic: Fetch recent routines and calculate streaks based on the 50% completion threshold.
- **Task Interaction**:
  - **Inline Editing**: Double-click or "pencil" icon to edit time, activity, or description.
  - **Status States**: Support `pending`, `completed`, and `skipped`.
  - **Add/Delete**: Manual buttons to append or remove segments.
  - **Partial Regen**: "Magic wand" button on individual slots to regenerate only that specific time window.
- **Advanced UI**:
  - **Current Slot Glow**: Real-time highlighting of the current activity.
  - **Smooth Scrolling**: Automatically scroll to the "Now" task on mount or refresh.
  - **Day Progress**: Circular or linear progress bar based on "Completed" vs total tasks.
- **Aesthetics**:
  - Floating action menu for routine management.
  - Category-based emoji integration.

---

#### 4. Dashboard Integration

#### [MODIFY] [StudentDashboard.jsx](file:///c:/Users/Aditya/.gemini/antigravity/scratch/frontend/src/pages/StudentDashboard.jsx)
- Update route `/student/routine` to use `DailyRoutine` component.

---

## Verification Plan

### Automated/Manual Tests
- **API Connectivity**: Verify `POST /api/generate-routine` returns valid JSON with correct fields.
- **Data Integrity**: Ensure class times in the routine match the timetable exactly.
- **State Management**: Verify that marking an item as done updates the "completed X out of Y" count in real-time.
- **Persistence**: Refresh the page after saving a routine to ensure it reloads from Firestore.
- **Responsive Design**: Verify the vertical timeline looks premium on both mobile and desktop.

## Open Questions

- Should we allow the user to *manually* add custom items to the routine after it's generated?
- For the "Streak" counter, should we count every day a routine is *generated*, or only days where at least 50% of tasks are *completed*?
