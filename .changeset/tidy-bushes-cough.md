---
"@digitalculture/ochre-sdk": minor
---

feat: enhance geographic coordinate types and parsing logic

- Updated `OchreSpatialUnit` and `SpatialUnit` types to include `mapData` and ensure `coordinates` are always defined.
- Introduced `CoordinatesItem` type to better represent point and plane coordinates.
- Refactored `parseCoordinates` function to handle new coordinate structures and return an array of `CoordinatesItem`.
