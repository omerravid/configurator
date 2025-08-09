const embeddedMongo = require('./models/embedded-mongodb');
const DataMigration = require('./scripts/migrate-to-mongodb');

async function migrateToEmbeddedMongo() {
  try {
    console.log('🚀 Starting migration to embedded MongoDB...\n');

    // Start embedded MongoDB
    await embeddedMongo.start();
    const connectionString = embeddedMongo.getConnectionString();
    console.log(`✅ Embedded MongoDB started at: ${connectionString}\n`);

    // Run migration
    console.log('📦 Migrating data from SQLite to embedded MongoDB...');
    const migration = new DataMigration();
    const result = await migration.migrate(connectionString);

    if (result.success) {
      console.log('\n🎉 Migration completed successfully!');
      console.log(`📊 Migrated ${result.stats.users} users and ${result.stats.configurations} configurations\n`);
      
      console.log('🔧 Next steps:');
      console.log('1. Restart the server with: npm run dev');
      console.log('2. The system will now use embedded MongoDB instead of SQLite');
      console.log('3. All your data has been preserved');
    } else {
      console.error('❌ Migration failed:', result.message);
    }

  } catch (error) {
    console.error('💥 Migration error:', error.message);
  } finally {
    await embeddedMongo.stop();
    process.exit(0);
  }
}

migrateToEmbeddedMongo();
