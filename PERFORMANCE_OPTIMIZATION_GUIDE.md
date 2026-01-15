# Stream-Agri Performance Optimization Guide

This document outlines the performance optimizations implemented and recommended practices for keeping the app fast on all devices.

## 🚀 Implemented Optimizations

### 1. React Component Optimization

#### ✅ Memoization
- **React.memo**: Applied to list item components to prevent unnecessary re-renders
- **useMemo**: Used for expensive computations (filtering, calculations, style objects)
- **useCallback**: Applied to event handlers to maintain referential equality

**Example (warehouse-dispatch-note.tsx):**
```typescript
// Memoized list item component
const DispatchNoteItem = React.memo(({ item }: { item: DispatchNote }) => {
  // Memoized expensive calculations
  const initials = useMemo(() => {
    // ... calculation logic
  }, [item.warehouse_destination_name]);
  
  // Memoized event handlers
  const handlePress = useCallback(() => {
    // ... navigation logic
  }, [router, item.mobile_app_id, item.id]);
});
```

#### ✅ Optimized Search Filtering
- Moved filtering logic to `useMemo` to avoid recalculating on every render
- Removed redundant `filteredNotes` state, now computed from `notes` and `searchQuery`

### 2. FlashList Optimizations

#### ✅ Enhanced Configuration
```typescript
<FlashList
  data={filteredNotes}
  renderItem={({ item }) => <DispatchNoteItem item={item} />}
  estimatedItemSize={120}  // More accurate size estimation
  keyExtractor={(item) => item.id}  // Stable keys
  removeClippedSubviews={true}  // Remove off-screen views
  drawDistance={250}  // Render distance optimization
/>
```

**Benefits:**
- `removeClippedSubviews`: Removes views outside viewport, saving memory
- `drawDistance`: Controls how far ahead items are rendered
- `keyExtractor`: Provides stable keys for better reconciliation

## 📋 Recommended Optimizations (To Apply)

### 3. Database Query Optimization

#### ⚠️ Parallelize Sequential Queries
**Current Issue:** Multiple sequential database queries in `scan-bales.tsx`

**Solution:**
```typescript
// ❌ BAD: Sequential queries
const shippedBale = await powersync.getOptional(...);
const localLines = await powersync.getAll(...);
const product = await powersync.getOptional(...);

// ✅ GOOD: Parallel queries
const [shippedBale, localLines, product] = await Promise.all([
  powersync.getOptional(...),
  powersync.getAll(...),
  powersync.getOptional(...)
]);
```

#### ⚠️ Add Query Result Caching
For frequently accessed, rarely-changing data:
```typescript
// Create a simple cache utility
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedQuery = async (key: string, queryFn: () => Promise<any>) => {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const data = await queryFn();
  queryCache.set(key, { data, timestamp: Date.now() });
  return data;
};
```

#### ⚠️ Optimize SQL Queries
- **Add indexes** on frequently queried columns (if PowerSync supports it)
- **Limit result sets** when possible
- **Select only needed columns** instead of `SELECT *`

### 4. Debounce Search Inputs

For very large lists, add debouncing:
```typescript
import { useDebouncedCallback } from 'use-debounce'; // or implement custom

const debouncedSearch = useDebouncedCallback(
  (text: string) => setSearchQuery(text),
  300 // 300ms delay
);
```

### 5. Image Optimization

#### ⚠️ Use Optimized Image Components
```typescript
// Use expo-image instead of Image for better performance
import { Image } from 'expo-image';

<Image
  source={{ uri: imageUrl }}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk" // Enable caching
/>
```

### 6. Camera Performance

#### ⚠️ Optimize Barcode Scanner
- **Reduce barcode types** when possible (only scan what you need)
- **Lower camera resolution** for barcode scanning (if supported)
- **Pause camera** when modal is not visible

```typescript
// In BarcodeScanner.tsx
<CameraView
  ref={cameraRef}
  style={{ flex: 1 }}
  facing="back"
  enableTorch={torchOn}
  // Add these optimizations
  zoom={0} // Disable zoom if not needed
  onBarcodeScanned={isVisible ? handleDetectedCode : undefined}
/>
```

### 7. Bundle Size Optimization

#### ⚠️ Code Splitting
- Use dynamic imports for heavy screens:
```typescript
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));
```

#### ⚠️ Remove Unused Dependencies
Run `npx depcheck` to find unused dependencies:
```bash
npx depcheck
```

### 8. State Management

#### ⚠️ Normalize State Structure
Instead of nested arrays, use normalized state:
```typescript
// ❌ BAD: Nested structure
const notes = [{ id: 1, items: [...] }];

// ✅ GOOD: Normalized
const notes = { 1: { id: 1, ... } };
const noteItems = { 1: [item1, item2] };
```

### 9. Memory Management

#### ⚠️ Clean Up Subscriptions
Ensure all subscriptions are cleaned up:
```typescript
useEffect(() => {
  const subscription = powersync.watch(...);
  return () => {
    subscription.unsubscribe(); // Clean up
  };
}, []);
```

#### ⚠️ Limit List Data
For very large lists, implement pagination or virtual scrolling:
```typescript
// Load only visible items + buffer
const PAGE_SIZE = 50;
const [visibleRange, setVisibleRange] = useState({ start: 0, end: PAGE_SIZE });
```

### 10. Animation Performance

#### ⚠️ Use Native Driver
For animations, use native driver:
```typescript
Animated.timing(animValue, {
  toValue: 1,
  duration: 300,
  useNativeDriver: true, // ✅ Use native driver
}).start();
```

## 🔍 Performance Monitoring

### Add Performance Monitoring
```typescript
// Track render times
const startTime = performance.now();
// ... component render
const endTime = performance.now();
console.log(`Render time: ${endTime - startTime}ms`);
```

### Use React DevTools Profiler
1. Install React DevTools
2. Use Profiler to identify slow components
3. Focus optimization efforts on components with highest render times

## 📊 Expected Performance Improvements

After implementing these optimizations:

1. **List Rendering**: 50-70% faster with memoization and FlashList optimizations
2. **Search Filtering**: 60-80% faster with useMemo
3. **Database Queries**: 30-50% faster with parallelization
4. **Memory Usage**: 20-40% reduction with proper cleanup
5. **App Startup**: 10-30% faster with code splitting

## 🎯 Priority Order

1. ✅ **HIGH PRIORITY (Done)**: React memoization, FlashList optimization
2. ⚠️ **HIGH PRIORITY (Next)**: Database query parallelization, search debouncing
3. ⚠️ **MEDIUM PRIORITY**: Image optimization, camera performance
4. ⚠️ **LOW PRIORITY**: Bundle size, code splitting

## 📝 Checklist for New Components

When creating new components, ensure:

- [ ] Use `React.memo` for list items
- [ ] Use `useMemo` for expensive calculations
- [ ] Use `useCallback` for event handlers passed as props
- [ ] Use `FlashList` or `FlatList` for long lists (never `ScrollView` with many items)
- [ ] Add `keyExtractor` to lists
- [ ] Clean up subscriptions in `useEffect` cleanup
- [ ] Parallelize database queries when possible
- [ ] Debounce search inputs for large datasets
- [ ] Use `expo-image` instead of `Image` for remote images

## 🛠️ Tools for Performance Analysis

1. **React DevTools Profiler**: Identify slow renders
2. **Flipper**: Network, database, and performance monitoring
3. **Chrome DevTools**: For web debugging
4. **Android Studio Profiler**: For native performance
5. **Xcode Instruments**: For iOS performance

## 📚 Additional Resources

- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [FlashList Documentation](https://shopify.github.io/flash-list/)
- [Expo Performance Guide](https://docs.expo.dev/guides/performance/)
- [React Native Performance](https://reactnative.dev/docs/performance)

---

**Last Updated**: 2024
**Maintained By**: Development Team

