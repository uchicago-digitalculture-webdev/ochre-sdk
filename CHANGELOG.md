# @digitalculture/ochre-sdk

## 0.4.13

### Patch Changes

- c397601: feat: Add href support for webpage link rendering

## 0.4.12

### Patch Changes

- bd60130: feat: Enhance WebBlock type with mobile styling properties

## 0.4.11

### Patch Changes

- b638285: fix: Add character escape for parsing string items beginning with a numeric character followed by a dot; fix typing and parsing of `OchreStringItem`

## 0.4.10

### Patch Changes

- c37c8b7: feat: Include IIIF links in image link filtering

## 0.4.9

### Patch Changes

- ffdefbc: feat: Add isTransparentBackground and isCover properties to "image" compontent

## 0.4.8

### Patch Changes

- d097eca: roll back changes for `"newline"` parsing
- 85f6d1e: roll back changes for `"newline"` parsing

## 0.4.7

### Patch Changes

- cb272d0: refactor: Update default block properties and type definitions

## 0.4.6

### Patch Changes

- 1a72106: feat: Add width and height support for image components

## 0.4.5

### Patch Changes

- 9e3ec8f: Bug fixes
- 9e3ec8f: feat: Add mobile layout support for sidebar
- 9e3ec8f: Actually fix `"newline"` parsing

## 0.4.4

### Patch Changes

- fad6c20: fix: generate new UUID for non-OCHRE Blocks

## 0.4.3

### Patch Changes

- 8a3dd16: Fix `"newline"` parsing
- 8a3dd16: Fix edge cases for `Block` parsing

## 0.4.2

### Patch Changes

- 4e22ae2: feat: Add empty-space component to web element types and parsing

## 0.4.1

### Patch Changes

- 172e785: fix: Update default spacing to 'auto' in parsing functions

## 0.4.0

### Minor Changes

- f5f73c6: feat: Enhance block and webpage type definitions with new properties

## 0.3.8

### Patch Changes

- 2dcf8c0: refactor: Restructure image component properties and parsing

## 0.3.7

### Patch Changes

- fd1a24a: feat: Add inline header variant option

## 0.3.6

### Patch Changes

- efeb112: fix: Handle sidebar property extraction logic

## 0.3.5

### Patch Changes

- e86f8c9: feat: Add heading property to text component

## 0.3.4

### Patch Changes

- de0de88: feat: Add sidebar visibility property to webpage parsing

## 0.3.3

### Patch Changes

- 7644616: feat: Add sidebar layout property to support start and end positioning

## 0.3.2

### Patch Changes

- bbdf6b4: fix: Update title property parsing with presentation label

## 0.3.1

### Patch Changes

- 45b79ea: refactor: Restructure sidebar title and properties parsing logic

## 0.3.0

### Minor Changes

- d4bfb88: refactor: Enhance sidebar parsing with title and style properties

## 0.2.12

### Patch Changes

- 35302b2: feat: Add support for slug parsing in property values

## 0.2.11

### Patch Changes

- 4425047: refactor: Fix carousel options parsing in image component

## 0.2.10

### Patch Changes

- fdaf4dd: refactor: Restructure image component properties with carousel options

## 0.2.9

### Patch Changes

- 9b1ab62: feat: Add header alignment, project visibility, and theme toggle options to website properties

## 0.2.8

### Patch Changes

- acf13cb: Fix regression in Property parsing

## 0.2.7

### Patch Changes

- 0861a4b: Readjust carousel support for image component

## 0.2.6

### Patch Changes

- f3bc4e2: - Add support for Person inside Set and Tree
  - Add height and width as props to Image

## 0.2.5

### Patch Changes

- 9cdae44: Fix property value parsing for older Sets

## 0.2.4

### Patch Changes

- afa84e9: Fix string parsing for older set identification and description

## 0.2.3

### Patch Changes

- 1206cd4: Fix language parsing inside Metadata

## 0.2.2

### Patch Changes

- 8655afa: Fix bug with multiple images for `image` component

## 0.2.1

### Patch Changes

- 0d0d5f2: Add isSearchable property to `annotated-image`, `image-gallery`, and `item-gallery`

## 0.2.0

### Minor Changes

- 4c913ba: Change title parsing for Web Element, implement title display options for WebElement, add "video" type for Component, add component properties to Image component

## 0.1.29

### Patch Changes

- c2dd73e: Fix gallery response type

## 0.1.28

### Patch Changes

- 7e18657: Update gallery item identification parsing

## 0.1.27

### Patch Changes

- 5a63361: Update webpage background image to use &load instead of &preview

## 0.1.26

### Patch Changes

- b06eca8: Add Periods property to Bibliography

## 0.1.25

### Patch Changes

- f61bf3d: Bug fixes

## 0.1.24

### Patch Changes

- e8b794d: Add fetchers for Bibliography and Period

## 0.1.23

### Patch Changes

- 5da8677: Add category property to Bibliography and Period

## 0.1.22

### Patch Changes

- 06f2831: Implement bibliographies for Set and Tree, implement image gallery fetcher

## 0.1.21

### Patch Changes

- 3440cdb: Add header variant property to website

## 0.1.20

### Patch Changes

- ef2617b: Rename `variant` to `category`, fix parsing of some components
