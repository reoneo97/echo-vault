# Binary Search

Binary search finds a target value in a sorted array by repeatedly halving the search space.

## Algorithm

1. Set `low = 0`, `high = len(array) - 1`
2. While `low <= high`:
   - Compute `mid = (low + high) // 2`
   - If `array[mid] == target`: return `mid`
   - If `array[mid] < target`: set `low = mid + 1`
   - If `array[mid] > target`: set `high = mid - 1`
3. Return -1 (not found)

## Complexity

- **Time**: O(log n) — each iteration halves the search space
- **Space**: O(1) iterative, O(log n) recursive (call stack)

## Key Properties

- Requires the array to be **sorted**. Applying binary search to an unsorted array produces incorrect results.
- For duplicate elements, standard binary search returns *an* index of the target, not necessarily the first or last.
- The iterative version is preferred in practice to avoid stack overflow on large inputs.

## Common Mistakes

- Off-by-one errors: using `high = len(array)` instead of `len(array) - 1`
- Integer overflow: `(low + high) // 2` is safe in Python; in C/Java use `low + (high - low) // 2`
- Forgetting the sorted precondition
