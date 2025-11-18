# Property Category Filtering Fix

## Problem
Posted properties were not appearing in their respective categories even after admin approval and activation. This affected multiple categories (PG/Co-living, Agricultural, Commercial, etc.).

## Root Cause
The issue was caused by a mismatch between how properties were stored and how they were queried:

1. **During Creation**: Properties were stored with the `propertyType` value as submitted by the form (e.g., "co-living", "coliving", "pg-co-living")
2. **During Query**: The filter tried to normalize the query parameter using `TYPE_ALIASES` (e.g., "co-living" → "pg")
3. **Result**: A property stored as `propertyType="co-living"` would not be found when querying for `propertyType="pg"` because the database had the non-normalized value

### Example Scenario
- User posts property selecting "Co-living" category
- Property is stored in DB with `propertyType: "co-living"` 
- When querying, the system asks for properties with `propertyType: "pg"` (after alias normalization)
- Property is not found ❌

## Solution

### 1. **Normalize propertyType at Creation Time** ✅
Modified `server/routes/properties.ts` to normalize the `propertyType` using the same `TYPE_ALIASES` mapping that's used during querying.

**Changes:**
- Added `TYPE_ALIASES` mapping to the `createProperty` handler
- Properties are now stored with canonical propertyType values (e.g., "pg" instead of "co-living")
- This ensures consistency between creation and query time

### TYPE_ALIASES Mapping
```javascript
{
  "co-living": "pg",           // Co-living → PG
  "coliving": "pg",
  "pg": "pg",
  "agricultural-land": "agricultural",  // Farmland → Agricultural
  "agri": "agricultural",
  "agricultural": "agricultural",
  "commercial": "commercial",
  "showroom": "commercial",
  "office": "commercial",
  "residential": "residential",
  "flat": "flat",
  "apartment": "flat",
  "plot": "plot",
}
```

### 2. **Fix Existing Properties** ⚙️
Run the migration script to normalize all existing properties:

```bash
tsx server/scripts/fixPropertyTypes.ts
```

This script will:
- Find all properties with non-normalized propertyType values
- Apply the same TYPE_ALIASES mapping
- Update them to use canonical values
- Log all changes made

### 3. **Verify the Fix** 🧪
Run the test script to verify properties are now correctly filtered:

```bash
tsx server/scripts/testPropertyFiltering.ts
```

This script will:
- Check how many properties of each type exist
- Verify that pg properties have the correct propertyType
- Show no legacy "co-living" propertyType values remain
- Display properties by subcategory

## How It Works Now

### Creation Flow (Fixed)
1. User selects "Co-living" category from form
2. Form submits `propertyType: "co-living"`
3. Server normalizes: `"co-living"` → `"pg"`
4. Property stored in DB with `propertyType: "pg"` ✅

### Query Flow (Unchanged)
1. User navigates to PG category page
2. Page sends query: `propertyType=pg&subCategory=boys`
3. Server normalizes query parameter: `"pg"` → `"pg"` (no change)
4. Filters properties: `filter.propertyType = "pg"`
5. Properties stored with `propertyType: "pg"` are found ✅

## Files Changed
- `server/routes/properties.ts` - Added TYPE_ALIASES normalization to createProperty
- `server/scripts/fixPropertyTypes.ts` - New migration script
- `server/scripts/testPropertyFiltering.ts` - New test script

## Testing Checklist
- [ ] Run `tsx server/scripts/fixPropertyTypes.ts` to fix existing properties
- [ ] Run `tsx server/scripts/testPropertyFiltering.ts` to verify the fix
- [ ] Post a new property in each category (PG, Agricultural, Commercial, Buy, Rent)
- [ ] Verify that properties appear in their categories after admin approval
- [ ] Check that property counts are correct in category pages

## Debugging
If properties still aren't showing, check:
1. **Admin Approval**: Property must have `status: "active"` AND `approvalStatus: "approved"`
2. **Subcategory Mismatch**: Ensure the form's subcategory slugs match what the category pages expect
3. **Category Existence**: Verify the category exists in the `categories` collection
4. **Database Connection**: Check MongoDB logs for any errors

### Useful Queries
```javascript
// Check how many active properties exist
db.properties.find({ status: "active", approvalStatus: "approved" }).count()

// Check pg properties by subcategory
db.properties.aggregate([
  { $match: { propertyType: "pg", status: "active", approvalStatus: "approved" } },
  { $group: { _id: "$subCategory", count: { $sum: 1 } } }
])

// Find properties with non-normalized propertyType
db.properties.find({ propertyType: "co-living" })
```

## Related Code
- Property filtering logic: `server/routes/properties.ts` - `getProperties` function
- Category endpoints: `server/routes/categories-new.ts`
- Frontend property listing: `client/pages/CategoryProperties.tsx`
- Frontend category pages: `client/pages/PG.tsx`, `client/pages/Commercial.tsx`, etc.
