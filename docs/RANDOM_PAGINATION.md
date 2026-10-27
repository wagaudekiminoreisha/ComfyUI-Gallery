# Random order while loading more media

Random mode keeps the existing shuffled sequence as Hydrus pages, local files or refreshed metadata arrive. New IDs are shuffled and appended; existing images stay in place. Removed files disappear and updated metadata is retained without reshuffling survivors. The grid and ordinary slideshow use the same sequence.

The sequence is tracked separately for each gallery view and shuffle seed. **Reshuffle** changes the seed and shuffles the whole loaded collection. Other sort modes still sort the complete collection as before. This is a shuffled sequence of arriving batches, not a uniform shuffle of an entire library that has not yet been fetched.

Previously every page was sorted into the whole seeded collection. Although the Random setting stayed selected, newly fetched images could insert before the current scroll position, making the gallery appear to reset or change order at batch boundaries.

Regression coverage: pure ordering tests verify append order, removals, metadata updates and reshuffling; the random pagination browser test reproduces the old layout jump and checks two new batches; the paging browser test exercises near-end automatic loading with random mode selected.
