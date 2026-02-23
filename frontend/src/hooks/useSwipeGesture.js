import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to detect swipe gestures on touch devices
 * @param {Object} options - Configuration options
 * @param {Function} options.onSwipeLeft - Callback when swipe left detected
 * @param {Function} options.onSwipeRight - Callback when swipe right detected
 * @param {number} options.minSwipeDistance - Minimum distance to trigger swipe (default: 50px)
 * @param {number} options.maxSwipeTime - Maximum time for swipe gesture (default: 300ms)
 * @param {number} options.edgeWidth - Width of edge zone for swipe detection (default: 30px)
 * @param {boolean} options.edgeOnly - Only detect swipes starting from edges (default: false)
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 50,
  maxSwipeTime = 500,
  edgeWidth = 30,
  edgeOnly = false,
} = {}) {
  const touchStartRef = useRef(null);
  const touchStartTimeRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    const screenWidth = window.innerWidth;
    
    // Check if touch started from left edge (for swipe right to open)
    const isLeftEdge = startX <= edgeWidth;
    // Check if touch started from right edge (for swipe left to close)
    const isRightEdge = startX >= screenWidth - edgeWidth;
    
    // If edgeOnly is enabled, only track touches from edges
    if (edgeOnly && !isLeftEdge && !isRightEdge) {
      touchStartRef.current = null;
      return;
    }
    
    touchStartRef.current = {
      x: startX,
      y: touch.clientY,
      isLeftEdge,
      isRightEdge,
    };
    touchStartTimeRef.current = Date.now();
  }, [edgeWidth, edgeOnly]);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStartRef.current || !touchStartTimeRef.current) return;

    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = Math.abs(endY - touchStartRef.current.y);
    const deltaTime = Date.now() - touchStartTimeRef.current;
    
    // Reset refs
    const startData = touchStartRef.current;
    touchStartRef.current = null;
    touchStartTimeRef.current = null;
    
    // Check if swipe is valid (horizontal, not too slow, not too vertical)
    const isValidSwipe = 
      Math.abs(deltaX) >= minSwipeDistance && 
      deltaTime <= maxSwipeTime &&
      deltaY < Math.abs(deltaX) * 0.7; // Ensure mostly horizontal swipe
    
    if (!isValidSwipe) return;
    
    // Determine swipe direction
    if (deltaX > 0) {
      // Swipe right - open sidebar
      // For opening, we want swipes starting from left edge or anywhere if edgeOnly is false
      if (!edgeOnly || startData.isLeftEdge) {
        onSwipeRight?.();
      }
    } else {
      // Swipe left - close sidebar
      onSwipeLeft?.();
    }
  }, [minSwipeDistance, maxSwipeTime, edgeOnly, onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    // Only enable on touch devices
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);
}

export default useSwipeGesture;
