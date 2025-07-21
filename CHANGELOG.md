# @digitalculture/ochre-sdk

## 0.9.8

### Patch Changes

- 123c0da: fix: adjust formatting in XQuery output for property and value elements in property-query.ts

## 0.9.7

### Patch Changes

- 24d2d9c: feat: introduce WebTitle type and refactor title handling in WebElement and WebBlock

## 0.9.6

### Patch Changes

- 4f8e708: feat: add href and slug properties to OchrePropertyValueContent and PropertyValueContent types

## 0.9.5

### Patch Changes

- 3b92327: fix: enhance error handling and type safety in parseWebElementProperties function

## 0.9.4

### Patch Changes

- 5a7a24a: fix: update value extraction in XQuery to include all attributes for properties

## 0.9.3

### Patch Changes

- b3cf6ab: refactor: simplify property UUID handling in fetchPropertyQuery function

## 0.9.2

### Patch Changes

- 58536ba: feat: add properties support to OchreConcept and Concept types, and update parsing logic to handle properties

## 0.9.1

### Patch Changes

- 4d1b675: feat: enhance Identification type by adding optional code property and update parsing logic accordingly

## 0.9.0

### Minor Changes

- 98190a6: - feat: implement property query fetcher for OCHRE API
  - refactor: remove unused component types and enhance query component structure with additional properties

## 0.8.46

### Patch Changes

- 8c34123: fix: update query component type definition and parsing logic to use propertyUuids instead of valueUuids

## 0.8.45

### Patch Changes

- 8229036: feat: implement query component logic in parsing and update type definition

## 0.8.44

### Patch Changes

- 425f29b: fix: make interpretations optional in OchreConcept type and handle undefined cases in parseConcept function

## 0.8.43

### Patch Changes

- 6ee145f: feat: add skeleton for "query" component to schemas and types

## 0.8.42

### Patch Changes

- f73909d: feat: extend itemVariant type to include "tile" option

## 0.8.41

### Patch Changes

- a92cf73: refactor: restructure searchOptions to use filters and scopes with updated types

## 0.8.40

### Patch Changes

- a900e07: refactor: update searchOptions structure to use filterUuids and scopeUuids

## 0.8.39

### Patch Changes

- 4fa820c: refactor: simplify property retrieval for display settings in parse functions
- 4fa820c: feat: enhance string item parsing to support nested OchreStringItem and update annotation UUIDs

## 0.8.38

### Patch Changes

- e60628d: fix: update isCountDisplayed condition to include variant check

## 0.8.37

### Patch Changes

- f4943a9: fix: rename filterDisplayed to isFilterDisplayed

## 0.8.36

### Patch Changes

- 7211fc4: refactor: update LevelContext and OchreLevelContextItem types to include identification properties

## 0.8.35

### Patch Changes

- f2ef1c1: minor fix
- f2ef1c1: refactor: rename searchContexts to filterContexts

## 0.8.34

### Patch Changes

- 8aa2d78: refactor: update WebElementComponent type to rename isSearchable to isFilterDisplayed for consistency

## 0.8.33

### Patch Changes

- 1822131: refactor: rename isSearchable to filterDisplayed in parseWebElementProperties function and update related logic

## 0.8.32

### Patch Changes

- 0033c76: feat: enhance type definitions and parsing logic for OchreLevelContextItem and WebElement, adding new properties and refining structure

## 0.8.31

### Patch Changes

- d6c851f: feat: extend WebElementComponent type with startIcon and endIcon properties, and update parsing logic to accommodate new icon fields
- a3d416f: feat: add description field to Link and WebImage types, and update parsing logic accordingly

## 0.8.30

### Patch Changes

- 91304f4: fix: parse "time" type property values as number

## 0.8.29

### Patch Changes

- 28dc493: feat: extend shape options in ImageMapArea types and update parsing logic to accommodate new shape "circle"

## 0.8.28

### Patch Changes

- 0d1bcd3: fix: make content optional in OchreStringItemContent type and adjust string parsing logic accordingly

## 0.8.27

### Patch Changes

- 4cec648: fix: simplify string parsing by removing unnecessary replacements

## 0.8.26

### Patch Changes

- 0bdeea3: fix: simplify string parsing by removing unnecessary replacements

## 0.8.25

### Patch Changes

- 14b679c: feat: add fileSize property to resource and link types

## 0.8.24

### Patch Changes

- 784fbd8: refactor: update context properties in OchreTree and Website types

## 0.8.23

### Patch Changes

- 6322768: fix: fix minor tree parsing bug

## 0.8.22

### Patch Changes

- e6f4658: feat: add support for text annotations, fix curly bracket rendering in MDX

## 0.8.21

### Patch Changes

- e853ced: refactor: remove isDownloadButtonDisplayed property from audio-player

## 0.8.20

### Patch Changes

- 6037262: - fix: rename audioUuid to audioId
  - fix: update parseTree function to include category and setCategory parameters

## 0.8.19

### Patch Changes

- 3af7513: fix: reimplement globalOptions context parsing

## 0.8.18

### Patch Changes

- 2f5de6a: refactor: remove deprecated footnotes handling and update related types and parsing logic

## 0.8.17

### Patch Changes

- 32f245c: feat: add audio-player component

## 0.8.16

### Patch Changes

- b32ef69: fix: fix parsing boolean values

## 0.8.15

### Patch Changes

- e07a46b: - feat: add defaultTheme property to website properties
  - refactor: revert date and dateTime handling in type definitions and parsing logic to be string type instead of Date

## 0.8.14

### Patch Changes

- fbbbd14: fix: string parsing fixes

## 0.8.13

### Patch Changes

- 50d3158: refactor: update type definitions and parsing logic for Ochre data structures

## 0.8.12

### Patch Changes

- ae3b40c: feat: add isBreadcrumbsDisplayed property to Webpage properties

## 0.8.11

### Patch Changes

- 449d98f: feat: add paginationVariant to collection component

## 0.8.10

### Patch Changes

- 59f3945: feat: add isFullHeight property to WebElementComponent type and update parseWebElementProperties function to handle it

## 0.8.9

### Patch Changes

- 32b4248: feat: add fileFormat property to Link and OchreLinkItem types and update parseLink function to handle it

## 0.8.8

### Patch Changes

- 072265f: refactor: rename 'format' to 'fileFormat' in Resource type

## 0.8.7

### Patch Changes

- 07de104: refactor: update fetchWebsite return type to handle errors and improve destructuring in tests

## 0.8.6

### Patch Changes

- 05261d3: fix: properly parse flattenContexts structure

## 0.8.5

### Patch Changes

- f7c3e9c: feat: refactor website options structure to include flatten contexts and update collection options handling

## 0.8.4

### Patch Changes

- 622600e: feat: add customFetch parameter to fetch functions for enhanced flexibility in network requests
- 622600e: feat: extend CoordinatesItem and OchreCoordinatesItem types to support related context with value field

## 0.8.3

### Patch Changes

- db104ca: feat: enhance OchrePerson and Person types with description and notes fields

## 0.8.2

### Patch Changes

- f8b57d6: feat: add coordinates support to resource types and parsing

## 0.8.1

### Patch Changes

- b3a1d54: feat: add map component support in WebElement and parsing logic

## 0.8.0

### Minor Changes

- c7f93d6: feat: enhance geographic coordinate types and parsing logic
  - Updated `OchreSpatialUnit` and `SpatialUnit` types to include `mapData` and ensure `coordinates` are always defined.
  - Introduced `CoordinatesItem` type to better represent point and plane coordinates.
  - Refactored `parseCoordinates` function to handle new coordinate structures and return an array of `CoordinatesItem`.

## 0.7.22

### Patch Changes

- 8c4a85d: feat: add temporary UUID overrides for DIGS 30005 class in item fetcher

## 0.7.21

### Patch Changes

- cf98cda: refactor: simplify website properties parsing by providing default values for type and status

## 0.7.20

### Patch Changes

- 548e7c5: refactor: update UUID metadata types and fetcher to improve structure and clarity

## 0.7.19

### Patch Changes

- 5ca7c1e: fix: correct latitude and longitude assignment in parseCoordinates function

## 0.7.18

### Patch Changes

- 96ff50d: feat: add footnotes and UUID metadata fetchers with corresponding types

## 0.7.17

### Patch Changes

- 0cec14f: feat: add functions to retrieve properties and their values by UUID

## 0.7.16

### Patch Changes

- 132a2c2: refactor: update types for observations and properties to support multiple observers and content types

## 0.7.15

### Patch Changes

- 4fb0f67: refactor: remove 'type' property from OchreSpatialUnit and SpatialUnit types

## 0.7.14

### Patch Changes

- 21364b8: revert: add itemUuid to ImageMapArea type and update parseImageMap function to generate uuid using randomUUID

## 0.7.13

### Patch Changes

- 9275eee: feat: add itemUuid to ImageMapArea type and update parseImageMap function to generate uuid using randomUUID

## 0.7.12

### Patch Changes

- d1b4532: feat: introduce OchreTreeCollectionOption type and update collectionOptions structure in internal.raw.d.ts; modify parseWebsite function to utilize new collectionOptions

## 0.7.11

### Patch Changes

- 69e2605: refactor: rename searchNestedProperties to includeNestedProperties in PropertyOptions and update related functions

## 0.7.10

### Patch Changes

- 1f66c56: feat: add uuid property to Property type and update parsing logic to include uuid

## 0.7.9

### Patch Changes

- 927b75f: refactor: restructure collectionOptions in Website

## 0.7.8

### Patch Changes

- 65e750a: - fix: update type constraint for setCategory parameter in fetchItem function
  - feat: add searchOptions and collectionOptions to OchreTree and Website types, and update parsing logic accordingly

## 0.7.7

### Patch Changes

- 2569fc7: fix: update variant type for `"entries"` component

## 0.7.6

### Patch Changes

- d9e92b7: feat: enhance OchrePerson and Person types with additional properties and update parsing logic

## 0.7.5

### Patch Changes

- b95d627: feat: add isUncertain property to PropertyValueContent and OchrePropertyValueContent types

## 0.7.4

### Patch Changes

- 8b41409: feat: replace blog component with entries component and update parsing logic

## 0.7.3

### Patch Changes

- e79255a: feat: enhance parseSet and fetchItem functions to support optional item categories

## 0.7.2

### Patch Changes

- 6819b4e: feat: add section sidebar item handling and update WebElement and WebBlock types

## 0.7.1

### Patch Changes

- b1d9643: feat: enhance coordinate handling in OchreSpatialUnit and parsing logic

## 0.7.0

### Minor Changes

- 5181aff: feat: implement non-string property value types (number, boolean, and Date)

## 0.6.6

### Patch Changes

- 738ce95: fix: update OchreResource type to cover edge case for document

## 0.6.5

### Patch Changes

- 092db9a: feat: update gallery fetcher XQuery to support Sets alongside Trees

## 0.6.4

### Patch Changes

- b9fc0ca: feat: add category field to Person type and update parsePerson function

## 0.6.3

### Patch Changes

- eb81da6: fix: export website fetcher

## 0.6.2

### Patch Changes

- 0829005: fix: actually bring back gallery fetcher

## 0.6.1

### Patch Changes

- e3897c7: fix: bring back gallery fetcher

## 0.6.0

### Minor Changes

- d32fc0c: breaking: refactor fetchers and schemas; replace multiple fetchers with a unified `fetchItem` function, reorganize and expand validation schemas, and update type definitions.

## 0.5.19

### Patch Changes

- 38a81f3: Revert: Strict resource type typing

## 0.5.18

### Patch Changes

- 5030855: - Enhance type safety by introducing Category type, updating Metadata and PropertyValueContent structures, and implementing category validation schema in parsing functions.
  - Introduce ResourceType and PropertyValueContentType types, enhance PropertyValueContent structure for better type safety, and update parsing functions to accommodate new types
- cec2d06: Revert: Strict category typing

## 0.5.17

### Patch Changes

- 53ceff7: Add "inset" option to captionLayout for image component

## 0.5.16

### Patch Changes

- de26223: Add filter-categories component type and parsing logic

## 0.5.15

### Patch Changes

- c213d1d: refactor: update iframe properties in type definition and parsing logic to include href, height, and width

## 0.5.14

### Patch Changes

- 39ba818: fix: update propertyValue key in type definition and fetcher logic

## 0.5.13

### Patch Changes

- 33b3940: refactor: update propertyValue type and parsing logic to align with new data structure

## 0.5.12

### Patch Changes

- 8400c4d: feat: export property-value fetcher to support new data structure

## 0.5.11

### Patch Changes

- f32ad15: - feat: add propertyValue type and parsing logic to support new data structure
  - feat: add search-bar component with variant support to type definitions and parsing logic

## 0.5.10

### Patch Changes

- 3da930f: Remove `item-gallery` component from type definitions and parsing logic, updating related gallery link retrieval to include "set" category

## 0.5.9

### Patch Changes

- adc50b2: Remove deprecated `text-image` component

## 0.5.8

### Patch Changes

- b64043f: feat: add showCount property and update parse logic for "collection" component

## 0.5.7

### Patch Changes

- 0b43f6e: feat: add itemVariant property to "collection" component

## 0.5.6

### Patch Changes

- 689b37d: feat: add icon property to "button" component

## 0.5.5

### Patch Changes

- 987a6a6: Enhance OchreLink and Link types to include spatialUnit category and support in parsing logic

## 0.5.4

### Patch Changes

- 65db23c: feat: Add isPrimary property to Link and OchreLinkItem types

## 0.5.3

### Patch Changes

- fc69222: Minor bug fix in string parsing

## 0.5.2

### Patch Changes

- c5adbd7: Fix type and parsing of `description` for `OchreResource`

## 0.5.1

### Patch Changes

- 6796fe4: Add new `iframe` component

## 0.5.0

### Minor Changes

- 74549bc: refactor: Update Webpage and WebBlock types to use a unified items array for elements and blocks

## 0.4.15

### Patch Changes

- cc949b1: refactor: Simplify email parsing by removing URL parsing

## 0.4.14

### Patch Changes

- df27724: feat: Improve link string parsing to support rich text content
- 59de70a: Bug fixes

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
