# OCHRE SDK

A JavaScript/TypeScript SDK for working with OCHRE (Online Cultural and Historical Research Environment) data.

## Installation

```bash
pnpm add @uchicago/ochre
or
npm install @uchicago/ochre
or
bun install @uchicago/ochre
```

## Features

- Type-safe parsing of OCHRE data structures
- Comprehensive TypeScript types for OCHRE entities
- Utilities for handling OCHRE websites, resources, and metadata
- Support for parsing rich text, documents, and multilingual content

## Usage

```typescript
import { fetchWebsite, fetchResource, fetchSet } from "@uchicago/ochre";

// Fetch and parse OCHRE website data
const website = await fetchWebsite(abbreviation);

// Fetch and parse OCHRE resource data
const resource = await fetchResource(uuid);

// Fetch and parse OCHRE set data
const set = await fetchSet(uuid);
```

## API Reference

### Core Functions

#### `fetchWebsite(abbreviation: string): Promise<Website | null>`

Fetch and parse OCHRE website data.

```typescript
const website = await fetchWebsite("guerrilla-television");
```

#### `fetchResource(uuid: string): Promise<Resource | null>`

Fetch and parse OCHRE resource data.

```typescript
const resource = await fetchResource("27adf18a-21ad-442b-b186-0c7f3b8cb2d1");
```

### Types

The SDK provides comprehensive TypeScript types for OCHRE data structures. Key types include:

- `Website` - Represents an OCHRE website
- `Resource` - Represents an OCHRE resource
- `Set` - Represents an OCHRE set
- `Document` - Represents an OCHRE MDX document
- `WebElement` - Represents a web element in an OCHRE website
- And many more...

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
