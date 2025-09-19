# @ciolabs/html-mso-properties

> Microsoft Office CSS properties

A comprehensive TypeScript package containing all Microsoft Office (MSO) CSS properties, their valid values, defaults, and inheritance behavior.

## Install

```bash
npm install @ciolabs/html-mso-properties
```

## Usage

### Import the data

```typescript
import msoProperties from '@ciolabs/html-mso-properties';

// Get all MSO properties
console.log(msoProperties.length); // 1000+ properties

// Find a specific property
const borderAlt = msoProperties.find(prop => prop.property === 'mso-border-alt');
console.log(borderAlt);
// {
//   property: 'mso-border-alt',
//   values: ['apples', 'arched-scallops', 'auto', ...],
//   default: null,
//   inherits: false
// }
```

### Import the types

```typescript
import { MsoProperty } from '@ciolabs/html-mso-properties';

function processProperty(prop: MsoProperty) {
  console.log(`Property: ${prop.property}`);
  console.log(`Valid values: ${prop.values.join(', ')}`);
  console.log(`Default: ${prop.default}`);
  console.log(`Inherits: ${prop.inherits}`);
}
```

## Data Structure

The package exports an array of `MsoProperty` objects. Each object contains:

- **`property`** (`string`) - Name of the CSS property (e.g., `'mso-border-alt'`)
- **`values`** (`string[]`) - Array of valid values for the property
- **`default`** (`string | number | null`) - The default value, or `null` if no default
- **`inherits`** (`boolean`) - Whether the property value is inherited from parent elements

## TypeScript Support

This package includes full TypeScript support with exported interfaces:

```typescript
export interface MsoProperty {
  property: string;
  values: string[];
  default: string | number | null;
  inherits: boolean;
}
```
