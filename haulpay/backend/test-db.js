const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function testDatabase() {
    try {
        console.log('Testing database connection...');
        
        // Test connection
        const result = await pool.query('SELECT NOW()');
        console.log('Database connection successful:', result.rows[0]);
        
        // Test employees table
        const employees = await pool.query('SELECT * FROM employees');
        console.log('Employees in database:', employees.rows);
        
        // Test specific user
        const admin = await pool.query('SELECT * FROM employees WHERE email = $1', ['admin@haulpay.com']);
        console.log('Admin user:', admin.rows[0]);
        
    } catch (error) {
        console.error('Database error:', error);
    } finally {
        await pool.end();
    }
}

testDatabase();