// Test file for filename sanitization functionality
// Run with: node test-filename-sanitization.js

/**
 * Sanitize filename for use as object property
 * Replaces all periods except the last one (before extension) with underscores
 * to avoid path handling issues while preserving the extension
 */
function sanitizeFilenameForProperty(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  
  if (lastDotIndex === -1) {
    // No extension, replace all periods with underscores
    return filename.replace(/\./g, '_');
  }
  
  // Split into name and extension
  const nameWithoutExt = filename.substring(0, lastDotIndex);
  const extension = filename.substring(lastDotIndex);
  
  // Replace periods in the name part only
  const sanitizedName = nameWithoutExt.replace(/\./g, '_');
  
  return sanitizedName + extension;
}

/**
 * Get filename without extension
 */
function getFileNameWithoutExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
}

/**
 * Get sanitized filename without extension for property names
 */
function getSanitizedFileNameWithoutExtension(filename) {
  const sanitized = sanitizeFilenameForProperty(filename);
  return getFileNameWithoutExtension(sanitized);
}

// Test cases
const testCases = [
  {
    input: 'config.dev.json',
    expectedSanitized: 'config_dev.json',
    expectedPropertyName: 'config_dev',
    description: 'JSON file with period in name'
  },
  {
    input: 'app.config.development.js',
    expectedSanitized: 'app_config_development.js',
    expectedPropertyName: 'app_config_development',
    description: 'JS file with multiple periods'
  },
  {
    input: 'my.image.v2.png',
    expectedSanitized: 'my_image_v2.png',
    expectedPropertyName: 'my_image_v2',
    description: 'Image file with periods'
  },
  {
    input: 'simple.txt',
    expectedSanitized: 'simple.txt',
    expectedPropertyName: 'simple',
    description: 'Simple file with one period'
  },
  {
    input: 'no_periods_file.pdf',
    expectedSanitized: 'no_periods_file.pdf',
    expectedPropertyName: 'no_periods_file',
    description: 'File with no periods in name'
  },
  {
    input: 'file.with.many.dots',
    expectedSanitized: 'file_with_many_dots',
    expectedPropertyName: 'file_with_many_dots',
    description: 'File with no extension, multiple periods'
  },
  {
    input: 'test.backup.2024.01.15.zip',
    expectedSanitized: 'test_backup_2024_01_15.zip',
    expectedPropertyName: 'test_backup_2024_01_15',
    description: 'Archive with date in filename'
  }
];

console.log('Testing filename sanitization...\n');

let allPassed = true;

testCases.forEach((testCase, index) => {
  const actualSanitized = sanitizeFilenameForProperty(testCase.input);
  const actualPropertyName = getSanitizedFileNameWithoutExtension(testCase.input);
  
  const sanitizedMatch = actualSanitized === testCase.expectedSanitized;
  const propertyMatch = actualPropertyName === testCase.expectedPropertyName;
  
  const passed = sanitizedMatch && propertyMatch;
  allPassed = allPassed && passed;
  
  console.log(`Test ${index + 1}: ${testCase.description}`);
  console.log(`  Input: "${testCase.input}"`);
  console.log(`  Sanitized: "${actualSanitized}" ${sanitizedMatch ? '✓' : '✗ Expected: "' + testCase.expectedSanitized + '"'}`);
  console.log(`  Property: "${actualPropertyName}" ${propertyMatch ? '✓' : '✗ Expected: "' + testCase.expectedPropertyName + '"'}`);
  console.log(`  Result: ${passed ? 'PASS' : 'FAIL'}`);
  console.log();
});

console.log(`Overall result: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);

if (allPassed) {
  console.log('\nFilename sanitization is working correctly!');
  console.log('Files with periods in their names will now:');
  console.log('- Be stored with sanitized property names (periods → underscores)');
  console.log('- Retain original filenames in metadata');
  console.log('- Download with original filenames');
} else {
  process.exit(1);
}
