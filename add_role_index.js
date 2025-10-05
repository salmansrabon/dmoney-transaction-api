const { sequelize } = require('./sequelizeModel/db.js');

async function addRoleIndex() {
    try {
        // Check if index exists
        const [results] = await sequelize.query(`
            SELECT COUNT(*) as index_count
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
            AND table_name = 'Users'
            AND index_name = 'role_index'
        `);

        if (results[0].index_count > 0) {
            console.log('Index on role column already exists.');
            return;
        }

        // Add index on role column
        await sequelize.query(`
            ALTER TABLE Users ADD INDEX role_index (role)
        `);

        console.log('Index on role column added successfully.');
    } catch (error) {
        console.error('Error adding index:', error);
    } finally {
        await sequelize.close();
    }
}

addRoleIndex();