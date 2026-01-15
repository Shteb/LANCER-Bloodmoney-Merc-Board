# LANCER RPG Job Board - Data Schemas

This directory contains JSON Schema definitions for all data structures used in the LANCER RPG Job Board application.

## Schema Files

### Core Data Structures

1. **job.schema.json** - Job posting schema
   - Defines the structure for job postings in the job board
   - Includes job state management (Pending/Active/Complete/Failed/Ignored)
   - Links to factions via `factionId`

2. **pilot.schema.json** - Pilot roster schema
   - Defines the structure for pilot records
   - Includes license level (LL), active status, and related jobs
   - References transactions via `personalTransactions` array
   - References reserves via `reserves` array (objects with `reserveId` UUID and `deploymentStatus` enum)

3. **faction.schema.json** - Faction schema
   - Defines the structure for faction records
   - Includes standing levels (0-4) and job count offsets
   - Job counts are dynamically calculated at runtime

4. **transaction.schema.json** - Transaction schema
   - Defines individual transaction records
   - Used within the manna.json file

5. **manna.schema.json** - Manna balance container schema
   - Container for the transactions array
   - References transaction.schema.json for array items

6. **base-module.schema.json** - DEPRECATED - Legacy base module schema
   - Defines individual base module structure (Core/Major/Minor)
   - Replaced by facility schemas

7. **base.schema.json** - DEPRECATED - Legacy base configuration container schema
   - Container for the 15 base modules (3 Core, 6 Major, 6 Minor)
   - References base-module.schema.json for array items
   - Replaced by facility schemas

8. **base-core-major-facility.schema.json** - Core/Major facility schema
   - Defines the structure for Core and Major facilities
   - Includes facility name, description, price, purchase status, and upgrades array
   - Each upgrade has name, description, price, max purchases, and current purchase count

9. **base-core-major-facilities.schema.json** - Core/Major facilities container schema
   - Container for 9 facilities (3 Core + 6 Major)
   - References base-core-major-facility.schema.json for array items

10. **minor-facility-slot.schema.json** - Minor facility slot schema
    - Defines the structure for a minor facility slot
    - Includes slot number (1-6), facility name, description, and enabled status
    - Slots can be enabled/disabled (last 2 disabled by default)

11. **minor-facilities-slots.schema.json** - Minor facilities slots container schema
    - Container for 6 minor facility slots
    - References minor-facility-slot.schema.json for array items

12. **settings.schema.json** - Global settings schema
    - Defines application-wide configuration
    - Includes portal heading, date, color scheme, and operation progress

13. **reserve.schema.json** - Reserve item schema
    - Defines the structure for reserve items (equipment/supplies)
    - Includes rank (1-3), name, price, description, and isCustom flag
    - Legacy items from reserves.json marked as isCustom: false

14. **store-config.schema.json** - Store configuration schema
    - Defines the store configuration including current stock and resupply settings
    - currentStock: array of Reserve UUIDs available for purchase
    - resupplySettings: controls automatic store refresh behavior

15. **voting-period.schema.json** - Voting period schema
    - Defines the structure for a voting period
    - Includes state (Ongoing/Archived), job votes, and end time
    - Only one voting period may be Ongoing at a time
    - Each pilot may only vote for one job per voting period

16. **voting-periods.schema.json** - Voting periods container schema
    - Container for all voting periods (Ongoing and historical/Archived)
    - References voting-period.schema.json for array items

## Schema Validation

### Using with JSON Schema Validators

You can use these schemas with any JSON Schema validator (Draft 7) to validate your data files:

#### Node.js Example (using ajv)

```bash
npm install ajv ajv-formats
```

```javascript
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');

const ajv = new Ajv();
addFormats(ajv);

// Load schema
const jobSchema = JSON.parse(fs.readFileSync('schemas/job.schema.json', 'utf8'));
const validate = ajv.compile(jobSchema);

// Validate data
const jobData = JSON.parse(fs.readFileSync('data/jobs.json', 'utf8'));
const valid = validate(jobData[0]); // Validate first job

if (!valid) {
  console.log(validate.errors);
}
```

#### Command Line (using ajv-cli)

```bash
npm install -g ajv-cli
ajv validate -s schemas/job.schema.json -d "data/jobs.json#" --verbose
```

### VS Code Integration

To enable IntelliSense and validation in VS Code:

1. Install the "JSON Schema" extension
2. Add schema references to your data files:

```json
{
  "$schema": "../schemas/job.schema.json"
}
```

Or configure in `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["data/jobs.json"],
      "url": "./schemas/job.schema.json"
    },
    {
      "fileMatch": ["data/pilots.json"],
      "url": "./schemas/pilot.schema.json"
    }
  ]
}
```

## Updating Schemas

### When to Update Schemas

Update the relevant schema file when you:

1. Add a new field to a data structure
2. Change validation rules (e.g., min/max values, string patterns)
3. Modify field types or requirements
4. Add or remove enum values
5. Change field descriptions

### Schema Update Process

1. **Identify the affected schema** - Determine which schema file needs to be updated
2. **Update the schema file** - Edit the appropriate `.schema.json` file in this directory
3. **Update validation in code** - If you've added new validation rules, update the corresponding validation functions in `helpers.js`
4. **Update copilot-instructions.md** - Update the Data Structures section to reflect the changes
5. **Test the changes** - Validate existing data files against the updated schema
6. **Document breaking changes** - If the schema change is breaking, document migration requirements

### Schema Update Example

If you add a new field to the Job structure:

1. **Update job.schema.json:**
```json
{
  "properties": {
    // ... existing properties ...
    "newField": {
      "type": "string",
      "description": "Description of the new field"
    }
  }
}
```

2. **Update helpers.js validation (if needed):**
```javascript
function validateJobData(jobData, factions, uploadDir) {
  // Add validation for newField if required
  // ...
}
```

3. **Update copilot-instructions.md:**
Update the Job Posting section under Data Structures to include the new field.

4. **Update initialization in server.js (if needed):**
If the field should have a default value, update `initializeData()` to include it.

## Schema Relationships

The schemas are interconnected in the following ways:

### Direct References (using $ref)

- `manna.schema.json` → `transaction.schema.json`
- `base.schema.json` → `base-module.schema.json`

### Data Relationships (via UUIDs)

- **Jobs → Factions**: Job's `factionId` references a Faction's `id`
- **Pilots → Jobs**: Pilot's `relatedJobs` array contains Job `id` values
- **Pilots → Transactions**: Pilot's `personalTransactions` array contains Transaction `id` values
- **Pilots → Reserves**: Pilot's `reserves` array contains objects with `reserveId` (Reserve `id`) and `deploymentStatus` enum
- **Store Config → Reserves**: Store Config's `currentStock` array contains Reserve `id` values
- **Voting Periods → Jobs**: Voting Period's `jobVotes` array contains objects with `jobId` (Job `id`) references
- **Voting Periods → Pilots**: Voting Period's `jobVotes.votes` arrays contain Pilot `id` values

Note: These UUID-based relationships are validated in code (see `helpers.js`) but not enforced by JSON Schema's `$ref` mechanism due to the cross-file nature of the references.

## Best Practices

1. **Keep schemas in sync with code** - Always update both the schema files and the corresponding validation functions in `helpers.js`
2. **Use meaningful descriptions** - Schema descriptions serve as inline documentation
3. **Validate after changes** - Test your data files against the schemas after making changes
4. **Version control** - Commit schema changes with the code changes that use them
5. **Document migrations** - If a schema change requires data migration, document the migration logic

## Notes

- All UUIDs in the system use the standard UUID v4 format
- Date fields use ISO 8601 format (date-time)
- Faction job counts (`jobsCompleted`, `jobsFailed`) are calculated at runtime and not stored in the data files
