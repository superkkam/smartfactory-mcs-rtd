'use client';

import { useState, useEffect } from 'react';

/** 입력값이 변경된 후 delay ms 동안 추가 변경이 없을 때 최종값을 반환 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
