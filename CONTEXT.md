# OCHRE domain vocabulary

OCHRE is the Online Cultural and Historical Research Environment, a research data platform run by the University of Chicago. This SDK reads from its public v2 API, which serves XML built by an XQuery run against a MarkLogic backend.

This file records what the OCHRE words mean. It exists because the recurring bugs in this package have been comprehension bugs rather than coding bugs, and none of them were inferable from the code: OCHRE is an external system with its own model, and the code can only show what someone already understood about it.

Keep this file to OCHRE's vocabulary. The README documents the SDK's own interface and `docs/adr` records the decisions behind its shape, so restating either here just gives them somewhere to disagree. Nothing in here should need editing when a file moves.

## Items

**Item** is the general word for a record OCHRE serves. Every item has a UUID, an identification, and a **category** naming what kind of thing it is.

There are eleven item categories: `tree`, `bibliography`, `concept`, `spatialUnit`, `period`, `person`, `propertyVariable`, `propertyValue`, `resource`, `text` and `set`. Two more names appear alongside them without being categories in their own right. `dictionaryUnit` shows up only as the target of a link. `heading` is a grouping wrapper OCHRE puts around hierarchy entries, so it behaves like a category when walking a hierarchy and never appears as an item you can fetch.

Two of the eleven serve different purposes than their names suggest. A **propertyVariable** is the definition of a property, meaning the thing a property's label names. A **propertyValue** is the definition of one allowed value of such a variable. Both are items in their own right, with their own UUIDs, and OCHRE also serves them under the shorter element names `variable` and `value`. That aliasing is the only place two element names mean the same category.

**Container** categories hold other items: `tree` and `set`. What a container holds is its **contained item category**, and OCHRE does not declare it, so a caller either states which category it expects or lets the parser work it out from the payload. A Tree holds one contained category. A Set can mix several.

A **Tree** is a hierarchy. A **Set** is a queryable collection with paging, sorting and facets. The difference that matters is that a Tree is walked and a Set is searched.

**Embedded items** are the nested hierarchy an item carries inside its own payload. Seven categories carry one: `tree`, `set`, `bibliography`, `concept`, `spatialUnit`, `period` and `resource`. Asking for a large recursive item without them is a real need, because the full hierarchy can be enormous.

An item arrives in one of three ways, and it matters because the shape differs. **Top level** is the item the request asked for. **Embedded** is an item nested inside another item's payload, which is abridged. **Standalone child** is a child served as its own record rather than nested.

**Context** is an item's path through the hierarchies above it, which OCHRE serves as a list of ancestors rather than as a pointer.

## Properties

A **property** attaches a value to an item. Its **variable** is what the property is called, and OCHRE identifies the variable by UUID as well as by label, because two variables can share a label. Its **values** are what it says. Properties nest: a property can carry child properties, and OCHRE uses that nesting heavily rather than inventing new labels.

A **simplified property** is the flattened form OCHRE serves when a payload sets `simplify="true"`. The difference is in the labels, which arrive as plain strings rather than as multilingual content.

A property value carries its text in four different attributes and OCHRE picks between them by how the value was entered. In precedence order they are `rawValue`, `payload`, `content` and `slug`. Reading them in any other order produces the wrong text for a value that carries more than one.

**dataType** names the type of a value, and OCHRE writes it with the XML Schema prefix. It arrives as `xs:integer` rather than `integer`, so anything comparing against the unprefixed name silently matches nothing and every reader has to strip the prefix before it compares.

A value whose `dataType` is **IDREF** points at a propertyValue item rather than holding text, so the value it stands for is that item's UUID.

A **facet** is a count of how many items in a Set carry a given property value, which is what drives filter sidebars. Facets are grouped by the canonical value a property stands for, which OCHRE has to decide before it can count.

## Multilingual text

Almost every human-readable field is multilingual. OCHRE serves it as **content**, a list of entries tagged with a language code, each holding one or more **strings**. When a language has several entries the first is primary, and the rest are aliases.

The same field can also arrive as a bare **payload** with no language tag at all, which is what OCHRE does for text entered before the field was multilingual.

**Rich text** is the marked-up form of a string, carrying rendering hints such as `italic`, whitespace markers, embedded links and annotations. OCHRE stores links inside the text rather than beside it, so extracting text and extracting links are two reads of the same tree.

**Source order** matters and is not recoverable from the parsed shape. XML groups same-named elements together, so a document that interleaved two element types comes back as one array per type. Only the byte offsets recorded during parsing can put them back in the order OCHRE sent.

## Website presentation

OCHRE stores a website as a Tree whose items are pages, with every configuration choice expressed as a nested property. This is the part of the model with the least resemblance to what it produces.

**presentation** is the label under which all of it hangs, and the value it carries does one of two jobs. On a resource it says what the resource is: `page`, `block`, `element` or `website`. Elsewhere it names a group of nested settings rather than a kind of resource, which is how `title` and the `css`, `css-tablet` and `css-mobile` groups work. Either way everything more specific is a property nested under it.

A **page** is a route. A **block** is a layout container inside a page. An **element** is a leaf, and an element's **component** names what it renders, such as `text`, `image`, `map` or `collection`. Blocks nest inside blocks, and a page holds blocks and elements.

A **segment** is a whole website nested inside a page of another website, used to publish a sub-site under a parent. Segments are why page slugs are not simply what OCHRE stores on the page.

A **slug** is the path a page is published at. OCHRE stores it relative to the segment holding it, so the full slug depends on the path taken through the tree to reach the page. A page only prefixes its children once it is itself inside a segment, which keeps a top-level website's slugs flat. OCHRE also puts a uniqueness prefix on a segment page's stored slug, which has to be stripped before the slug is used.

A **stylesheet** attaches CSS to a property variable or to one property value, so a website can style items by what they are rather than by where they appear.

## How OCHRE serves things

A **collection** in the MarkLogic sense is where documents of one category live, which is what makes a category-scoped query cheap and an unscoped one slow.

**supplemental** marks nodes that should not be returned to a consumer. The marker can sit at any depth, so stripping it means walking the whole subtree. The OCR layer is marked supplemental and is deliberately read without stripping, because reading it is the entire point of asking for it.

An **OCR layer** is the positioned text recognized from a scanned page, stored as ALTO. OCHRE varies the casing of the element names and serves them both in the ALTO namespace and in no namespace at all, so any selector over the layer has to accept every combination. A word's text is in an attribute rather than in the element's content.

A **permanent identification URL** is the citable `pi.lib.uchicago.edu` address of an item. It is a stable identifier rather than a page, so a consumer rewrites it: to an API endpoint when it wants the data, and to a route when it wants somewhere for a reader to click.
