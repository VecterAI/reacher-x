# Code Duplication Refactoring Guide

This document outlines the code duplication issues found in the ReacherX codebase and provides a step-by-step implementation plan for fixing them.

## 🔍 Issues Identified

### 1. **Validation Logic Duplication**

**Problem:** `validateDescription` function and constants duplicated in:

- `convex/llmFilter.ts`
- `convex/keywordSuggestions.ts`
- Frontend constants in `app/(webapp)/onboarding/page.tsx`

**Impact:**

- Code maintenance burden
- Risk of inconsistent validation rules
- Violation of DRY principle

### 2. **Request ID Generation Duplication**

**Problem:** Same request ID pattern repeated 6+ times:

```typescript
`${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
```

**Locations:**

- `convex/llmFilter.ts`
- `convex/keywordSuggestions.ts`
- `features/search/hooks/useTwitterSearch.ts`
- `shared/lib/utils/keywordStorage.ts` (multiple)
- `features/search/hooks/useSearchHistory.ts`

### 3. **Hook State Patterns Duplication**

**Problem:** Common async state patterns repeated:

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### 4. **Form Field Patterns Duplication**

**Problem:** Repetitive `Controller + FormItem + FormControl + FormLabel` patterns in:

- `features/search/ui/components/FilterContent.tsx`
- `features/waitlist/ui/components/WaitlistForm.tsx`
- Other form components

## 🛠️ Solutions Implemented

### ✅ Solution 1: Shared Validation Utils

**File Created:** `shared/lib/utils/validation.ts`

**Features:**

- Centralized validation constants
- Unified `validateDescription` function with configurable required/optional mode
- Specific validation functions for different use cases

**Usage Examples:**

```typescript
// Backend usage
import { validateDescriptionForKeywords } from "@/shared/lib/utils/validation";
const validation = validateDescriptionForKeywords(userDescription);

// Frontend usage
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils/validation";
const minLength = DESCRIPTION_CONSTRAINTS.MIN_LENGTH;
```

### ✅ Solution 2: Shared Request Utils

**File Created:** `shared/lib/utils/request.ts`

**Features:**

- Centralized request ID generation
- Request metadata management
- Timing utilities

**Usage Examples:**

```typescript
import { generateRequestId, createRequestMetadata } from "@/shared/lib/utils/request";
const requestId = generateRequestId("llm_filter");
const metadata = createRequestMetadata(requestId);
```

### ✅ Solution 3: Shared Hook Utils

**File Created:** `shared/hooks/useAsyncState.ts`

**Features:**

- Common async state management
- Automatic error handling
- Loading state management

**Usage Examples:**

```typescript
import { useAsyncState, useAsyncOperation } from "@/shared/hooks/useAsyncState";

// Basic async state
const { data, loading, error, setData, setLoading, setError } = useAsyncState();

// Async operation wrapper
const { data, loading, error, execute } = useAsyncOperation(myAsyncFunction);
```

### ✅ Solution 4: Reusable Form Components

**File Created:** `shared/ui/components/FormField.tsx`

**Features:**

- Pre-built form field components
- Consistent styling and behavior
- TypeScript support for form validation

**Usage Examples:**

```typescript
import { TextField, CheckboxField, SelectField } from "@/shared/ui/components/FormField";

<TextField
  control={form.control}
  name="email"
  label="Email Address"
  placeholder="Enter your email"
  description="We'll never share your email"
/>
```

### ✅ Solution 5: Shared Validation Schemas

**File Created:** `shared/lib/schemas/validation.ts`

**Features:**

- Centralized Zod validation schemas
- Consistent error messages
- Reusable schema components

**Usage Examples:**

```typescript
import { onboardingSchema, descriptionSchema } from "@/shared/lib/schemas/validation";

const form = useForm({
  resolver: zodResolver(onboardingSchema),
  defaultValues: { description: "" }
});
```

## 📋 Implementation Steps

### Phase 1: Update Backend Files

1. **Update `convex/llmFilter.ts`:**

   ```typescript
   // Replace validation function
   import { validateDescriptionForFiltering } from "@/shared/lib/utils/validation";
   import { generateRequestId } from "@/shared/lib/utils/request";

   // Replace
   const requestId = generateRequestId("llm_filter");
   const validation = validateDescriptionForFiltering(userDescription);
   ```

2. **Update `convex/keywordSuggestions.ts`:**

   ```typescript
   // Replace validation function
   import { validateDescriptionForKeywords } from "@/shared/lib/utils/validation";
   import { generateRequestId } from "@/shared/lib/utils/request";

   // Replace
   const requestId = generateRequestId("keyword_gen");
   const validation = validateDescriptionForKeywords(userDescription);
   ```

### Phase 2: Update Frontend Hooks

3. **Update `features/keywords/hooks/useKeywordSuggestions.ts`:**

   ```typescript
   import { useAsyncState } from "@/shared/hooks/useAsyncState";
   import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils/validation";

   // Replace manual state management with useAsyncState
   const { data: suggestions, loading, error, setData: setSuggestions, setLoading, setError } = useAsyncState([]);
   ```

4. **Update `features/search/hooks/useTwitterSearch.ts`:**

   ```typescript
   import { generateRequestId } from "@/shared/lib/utils/request";
   import { useAsyncState } from "@/shared/hooks/useAsyncState";

   const requestId = generateRequestId("search");
   ```

### Phase 3: Update Form Components

5. **Update `app/(webapp)/onboarding/page.tsx`:**

   ```typescript
   import { onboardingSchema, DESCRIPTION_CONSTRAINTS } from "@/shared/lib/schemas/validation";

   // Replace constants
   const MIN_CHARS = DESCRIPTION_CONSTRAINTS.MIN_LENGTH;
   const MAX_CHARS = DESCRIPTION_CONSTRAINTS.MAX_LENGTH;

   // Use shared schema
   const form = useForm({
     resolver: zodResolver(onboardingSchema),
     // ...
   });
   ```

6. **Update `features/search/ui/components/FilterContent.tsx`:**

   ```typescript
   import { TextField, CheckboxField, SelectField, RadioField } from "@/shared/ui/components/FormField";

   // Replace repetitive Controller patterns with reusable components
   <TextField
     control={form.control}
     name="from"
     label="From"
     placeholder="e.g., elonmusk"
     description="Posts from a specific @username."
     disabled={isLoading}
   />
   ```

### Phase 4: Update Utility Functions

7. **Update `shared/lib/utils/keywordStorage.ts`:**

   ```typescript
   import { generateUniqueId } from "@/shared/lib/utils/request";

   // Replace manual ID generation
   const keywordId = generateUniqueId("keyword");
   const voteId = generateUniqueId("vote");
   ```

8. **Update other files using request ID generation:**
   - `features/search/hooks/useSearchHistory.ts`
   - Any other files with the duplicated pattern

## 🧪 Testing Strategy

### 1. **Unit Tests**

- Test all new utility functions
- Verify validation logic consistency
- Test form components with various inputs

### 2. **Integration Tests**

- Verify backend validation still works
- Test form submissions end-to-end
- Confirm request ID generation is unique

### 3. **Manual Testing**

- Test onboarding flow
- Test search functionality
- Test filter forms
- Verify error handling

## 📊 Expected Benefits

### **Code Quality Improvements:**

- ✅ Eliminated 6+ instances of duplicate code
- ✅ Centralized validation logic
- ✅ Consistent error handling
- ✅ Improved maintainability

### **Development Experience:**

- ✅ Faster form development with reusable components
- ✅ Consistent validation across frontend/backend
- ✅ Reduced chance of bugs from inconsistent logic
- ✅ Better TypeScript support

### **Performance:**

- ✅ Smaller bundle size (shared utilities)
- ✅ Better tree-shaking potential
- ✅ Reduced memory usage from duplicate functions

## 🚨 Migration Warnings

1. **Breaking Changes:**

   - Function signatures may change slightly
   - Import paths will need updating

2. **Testing Required:**

   - All validation flows must be tested
   - Form submissions need verification
   - Backend actions require testing

3. **Gradual Migration:**
   - Implement one phase at a time
   - Test thoroughly between phases
   - Keep old code until new code is verified

## 📚 Additional Recommendations

### **Future Improvements:**

1. **Logging Utilities:** Centralize logging patterns
2. **Error Handling:** Create shared error handling utilities
3. **Type Definitions:** Move common types to shared locations
4. **Constants:** Centralize magic numbers and strings

### **Code Review Checklist:**

- [ ] No duplicate validation logic
- [ ] Consistent request ID generation
- [ ] Reusable form components used where applicable
- [ ] Shared hooks used for common patterns
- [ ] All imports updated to use shared utilities

---

This refactoring will significantly improve code quality, maintainability, and developer experience while reducing the risk of bugs from inconsistent implementations.
