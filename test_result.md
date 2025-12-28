# Test Result Tracking

## Test Run - OTM Filter Verification

### Features to Test:
1. Straddles & Strangles section - configurable OTM filter inputs (0.5% default, 0.1 step)
2. Calendar Spreads section - configurable OTM filter input (0.5% default, 0.1 step)  
3. Filter functionality - tables should filter strategies based on user-defined % range
4. Input validation - values should be constrained between 0.01 and 10

### Test Status:
- Straddles Filter UI: PENDING
- Strangles Filter UI: PENDING
- Calendar Spreads Filter UI: PENDING
- Filter Functionality: PENDING

### Agent Communication:
- Main agent is verifying the configurable OTM filters for Straddles, Strangles, and Calendar Spreads
- Filter inputs should have 0.5% default value and 0.1 step increment
- Need to verify that changing the filter value updates the displayed data correctly
- Current observations: 
  - Straddles section shows "Showing 11 of 100 straddles" with 0.5% filter
  - Calendar Spreads shows "Showing 24 of 100 calendar spreads" with 0.5% filter
  
### Incorporate User Feedback:
- None
