import { useCallback, useRef } from 'react';

/**
 * Custom hook for debouncing callback functions
 * Useful for search handlers, button clicks, etc.
 * 
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced callback function
 * 
 * @example
 * const handleSearch = useDebouncedCallback((text: string) => {
 *   performSearch(text);
 * }, 300);
 * 
 * <TextInput onChangeText={handleSearch} />
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  return debouncedCallback;
}

