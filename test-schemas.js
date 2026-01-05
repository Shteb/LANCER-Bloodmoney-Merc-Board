const fs = require('fs');

/**
 * Simple JSON Schema validation function
 * Supports basic validation: required fields, types, enums, min/max, patterns
 */
function validateAgainstSchema(data, schema, dataPath = 'root') {
  const errors = [];
  
  // Check required fields
  if (schema.required) {
    schema.required.forEach(field => {
      if (!(field in data)) {
        errors.push(`${dataPath}: Missing required field '${field}'`);
      }
    });
  }
  
  // Check properties
  if (schema.properties) {
    Object.keys(schema.properties).forEach(key => {
      if (key in data) {
        const propSchema = schema.properties[key];
        const value = data[key];
        
        // Type checking
        if (propSchema.type) {
          const actualType = Array.isArray(value) ? 'array' :
                            value === null ? 'null' :
                            typeof value;

          const isRequired = Array.isArray(schema.required) && schema.required.includes(key);

          // Skip type checking for null values when the field is optional
          if (!(value === null && !isRequired)) {
            if (propSchema.type !== actualType) {
              errors.push(`${dataPath}.${key}: Expected type '${propSchema.type}' but got '${actualType}'`);
            }
          }
        }
        
        // Enum checking
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          errors.push(`${dataPath}.${key}: Value '${value}' not in allowed enum: ${propSchema.enum.join(', ')}`);
        }
        
        // Number range checking
        if (typeof value === 'number') {
          if (propSchema.minimum !== undefined && value < propSchema.minimum) {
            errors.push(`${dataPath}.${key}: Value ${value} is less than minimum ${propSchema.minimum}`);
          }
          if (propSchema.maximum !== undefined && value > propSchema.maximum) {
            errors.push(`${dataPath}.${key}: Value ${value} is greater than maximum ${propSchema.maximum}`);
          }
          if (propSchema.multipleOf !== undefined && value % propSchema.multipleOf !== 0) {
            errors.push(`${dataPath}.${key}: Value ${value} is not a multiple of ${propSchema.multipleOf}`);
          }
        }
        
        // String validations
        if (typeof value === 'string') {
          if (propSchema.minLength !== undefined && value.length < propSchema.minLength) {
            errors.push(`${dataPath}.${key}: String length ${value.length} is less than minimum ${propSchema.minLength}`);
          }
          if (propSchema.pattern && !new RegExp(propSchema.pattern).test(value)) {
            errors.push(`${dataPath}.${key}: String '${value}' does not match pattern ${propSchema.pattern}`);
          }
        }
        
        // Array validation
        if (propSchema.type === 'array' && Array.isArray(value)) {
          if (propSchema.minItems !== undefined && value.length < propSchema.minItems) {
            errors.push(`${dataPath}.${key}: Array length ${value.length} is less than minimum ${propSchema.minItems}`);
          }
          if (propSchema.maxItems !== undefined && value.length > propSchema.maxItems) {
            errors.push(`${dataPath}.${key}: Array length ${value.length} is greater than maximum ${propSchema.maxItems}`);
          }
        }
      }
    });
  }
  
  return errors;
}

/**
 * Test a single data file against its schema
 */
function testSchema(schemaFile, dataFile, dataName, isArray = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${dataName}`);
  console.log(`Schema: ${schemaFile}`);
  console.log(`Data: ${dataFile}`);
  console.log('='.repeat(60));
  
  try {
    const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    let allValid = true;
    
    if (isArray) {
      // Data is an array of objects
      data.forEach((item, index) => {
        const errors = validateAgainstSchema(item, schema, `${dataName}[${index}]`);
        if (errors.length > 0) {
          allValid = false;
          console.log(`\n✗ ${dataName}[${index}]:`);
          errors.forEach(err => console.log(`    ${err}`));
        } else {
          console.log(`✓ ${dataName}[${index}] is valid`);
        }
      });
    } else {
      // Data is a single object
      const errors = validateAgainstSchema(data, schema, dataName);
      if (errors.length > 0) {
        allValid = false;
        console.log(`\n✗ ${dataName}:`);
        errors.forEach(err => console.log(`    ${err}`));
      } else {
        console.log(`✓ ${dataName} is valid`);
      }
    }
    
    if (allValid) {
      console.log(`\n✓✓✓ All ${dataName} data is valid! ✓✓✓`);
      return true;
    } else {
      console.log(`\n✗✗✗ Some ${dataName} data has validation errors ✗✗✗`);
      return false;
    }
    
  } catch (error) {
    console.log(`\n✗ Error: ${error.message}`);
    return false;
  }
}

// Run all validations
console.log('\n' + '='.repeat(60));
console.log('JSON SCHEMA VALIDATION TEST SUITE');
console.log('='.repeat(60));

const results = [];

// Test each data type
results.push(testSchema('schemas/job.schema.json', 'data/jobs.json', 'Job', true));
results.push(testSchema('schemas/pilot.schema.json', 'data/pilots.json', 'Pilot', true));
results.push(testSchema('schemas/faction.schema.json', 'data/factions.json', 'Faction', true));
results.push(testSchema('schemas/manna.schema.json', 'data/manna.json', 'Manna', false));
results.push(testSchema('schemas/base.schema.json', 'data/base.json', 'Base', false));
results.push(testSchema('schemas/settings.schema.json', 'data/settings.json', 'Settings', false));

// Summary
console.log('\n' + '='.repeat(60));
console.log('VALIDATION SUMMARY');
console.log('='.repeat(60));

const passed = results.filter(r => r).length;
const failed = results.filter(r => !r).length;

console.log(`Passed: ${passed}/${results.length}`);
console.log(`Failed: ${failed}/${results.length}`);

if (failed === 0) {
  console.log('\n✓✓✓ ALL SCHEMAS VALIDATED SUCCESSFULLY! ✓✓✓\n');
  process.exit(0);
} else {
  console.log('\n✗✗✗ SOME SCHEMAS FAILED VALIDATION ✗✗✗\n');
  process.exit(1);
}
