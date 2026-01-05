# Quick Reference: JSON Schemas

## Schema Files Location
All schemas are in the `schemas/` directory.

## Schema File List
- `job.schema.json` - Job postings
- `pilot.schema.json` - Pilot roster
- `faction.schema.json` - Factions
- `transaction.schema.json` - Individual transactions
- `manna.schema.json` - Manna balance container
- `base-module.schema.json` - Individual modules
- `base.schema.json` - Base configuration
- `settings.schema.json` - Global settings

## Quick Validation

### Command Line
```bash
# Validate all data files
node test-schemas.js

# Install AJV CLI for detailed validation
npm install -g ajv-cli
ajv validate -s schemas/job.schema.json -d data/jobs.json
```

### In Code
```javascript
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');

const ajv = new Ajv();
addFormats(ajv);

const schema = JSON.parse(fs.readFileSync('schemas/job.schema.json'));
const validate = ajv.compile(schema);

const job = { /* ... */ };
if (!validate(job)) {
  console.log(validate.errors);
}
```

## VS Code IntelliSense Setup

Add to `.vscode/settings.json`:
```json
{
  "json.schemas": [
    { "fileMatch": ["data/jobs.json"], "url": "./schemas/job.schema.json" },
    { "fileMatch": ["data/pilots.json"], "url": "./schemas/pilot.schema.json" },
    { "fileMatch": ["data/factions.json"], "url": "./schemas/faction.schema.json" },
    { "fileMatch": ["data/manna.json"], "url": "./schemas/manna.schema.json" },
    { "fileMatch": ["data/base.json"], "url": "./schemas/base.schema.json" },
    { "fileMatch": ["data/settings.json"], "url": "./schemas/settings.schema.json" }
  ]
}
```

## Common Tasks

### Adding a New Field
1. Update `schemas/<type>.schema.json`
2. Add field to `properties` object
3. Add to `required` array if mandatory
4. Update validation in `helpers.js`
5. Update initialization in `server.js`
6. Update documentation in `.github/copilot-instructions.md`
7. Run `node test-schemas.js` to verify

### Changing Field Validation
1. Update constraints in schema (min/max, pattern, enum)
2. Update validation in `helpers.js` if needed
3. Test with `node test-schemas.js`
4. Update documentation

### Checking Data Validity
```bash
node test-schemas.js
```
This validates all 6 data files against their schemas.

## Key Relationships

```
Jobs → Factions (via factionId)
Pilots → Jobs (via relatedJobs array)
Pilots → Transactions (via personalTransactions array)
Base → BaseModules (15 modules: 3 Core, 6 Major, 6 Minor)
Manna → Transactions (container with transaction array)
```

## Notes
- Integer fields use `type: "number"` with `multipleOf: 1` (JSON limitation)
- UUID fields use `format: "uuid"` for validation
- Empty strings are valid for optional reference fields (factionId, emblem)
- See `schemas/README.md` for complete documentation
