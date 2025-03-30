/**
 * Data Mapper Utility
 * Maps data from various sources to database fields based on configuration
 */

// Helper function to get a value from an object using a path (dot notation)
const getValueByPath = (obj, path) => {
  if (!obj || !path) return undefined;
  
  const parts = path.split('.');
  let value = obj;
  
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  
  return value;
};

// Maps data from source object to target object using field mappings
const mapData = (sourceData, fieldMappings) => {
  if (!sourceData || !fieldMappings || !Array.isArray(fieldMappings)) {
    throw new Error('Invalid parameters for data mapping');
  }

  const result = {};

  fieldMappings.forEach(mapping => {
    const { source, target, type, transform, required, defaultValue, fallbackSources } = mapping;
    
    // Get value from primary source
    let value = getValueByPath(sourceData, source);
    
    // If value is undefined and fallbackSources are defined, try to get value from fallback sources
    if (value === undefined && fallbackSources && Array.isArray(fallbackSources)) {
      for (const fallbackSource of fallbackSources) {
        value = getValueByPath(sourceData, fallbackSource);
        if (value !== undefined) break;
      }
    }
    
    // Apply transformation if defined
    if (transform && typeof transform === 'function') {
      value = transform(value, sourceData);
    }
    
    // If value is still undefined but there's a default value, use it
    if (value === undefined && defaultValue !== undefined) {
      value = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
    
    // Validate required fields
    if (required && (value === undefined || value === null)) {
      throw new Error(`Required field "${target}" is missing from source data`);
    }
    
    // Handle different data types
    if (value !== undefined) {
      if (type === 'DATE' && !(value instanceof Date) && value !== null) {
        // Convert string dates to Date objects
        try {
          result[target] = new Date(value);
        } catch (e) {
          console.error(`Error converting value to date for field ${target}:`, e);
          result[target] = null;
        }
      } else {
        result[target] = value;
      }
    }
  });

  return result;
};

module.exports = {
  mapData,
  getValueByPath
}; 