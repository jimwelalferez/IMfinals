const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Haulpay Backend API',
    status: 'running',
    endpoints: {
      login: 'POST /api/login',
      admin: {
        employees: 'GET /api/admin/employees',
        payroll: 'GET /api/admin/payroll'
      },
      employee: {
        payroll: 'GET /api/employee/payroll'
      }
    }
  });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query(
      'SELECT * FROM employees WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get all employees
app.get('/api/admin/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, created_at FROM employees ORDER BY created_at DESC'
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Create employee
app.post('/api/admin/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { email, password, firstName, lastName, role = 'employee' } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if employee already exists
    const existing = await pool.query(
      'SELECT id FROM employees WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Employee with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO employees (email, password, first_name, last_name, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email, hashedPassword, firstName, lastName, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Update employee
app.put('/api/admin/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { email, firstName, lastName } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const result = await pool.query(
      `UPDATE employees 
       SET email = $1, first_name = $2, last_name = $3, updated_at = NOW() 
       WHERE id = $4 
       RETURNING id, email, first_name, last_name, role, updated_at`,
      [email, firstName, lastName, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Delete employee
app.delete('/api/admin/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await pool.query(
      'DELETE FROM employees WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get payroll records
app.get('/api/admin/payroll', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { employeeId, period } = req.query;
    let query = `
      SELECT p.*, e.first_name, e.last_name, e.email 
      FROM payroll p 
      JOIN employees e ON p.employee_id = e.id 
    `;
    const params = [];
    
    if (employeeId) {
      query += ` WHERE p.employee_id = $${params.length + 1}`;
      params.push(employeeId);
    }
    
    if (period) {
      query += params.length ? ' AND' : ' WHERE';
      query += ` p.pay_period = $${params.length + 1}`;
      params.push(period);
    }
    
    query += ' ORDER BY p.pay_period DESC, e.last_name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Create payroll record
app.post('/api/admin/payroll', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { employeeId, salaryAmount, payPeriod, deductions = 0, bonuses = 0 } = req.body;
    
    if (!employeeId || !salaryAmount || !payPeriod) {
      return res.status(400).json({ error: 'Employee ID, salary amount, and pay period are required' });
    }

    // Check if employee exists
    const employeeCheck = await pool.query(
      'SELECT id FROM employees WHERE id = $1',
      [employeeId]
    );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const netSalary = salaryAmount - deductions + bonuses;

    const result = await pool.query(
      `INSERT INTO payroll (employee_id, salary_amount, pay_period, deductions, bonuses, net_salary) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [employeeId, salaryAmount, payPeriod, deductions, bonuses, netSalary]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create payroll error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Update payroll record
app.put('/api/admin/payroll/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { salaryAmount, payPeriod, deductions = 0, bonuses = 0 } = req.body;
    
    if (!salaryAmount || !payPeriod) {
      return res.status(400).json({ error: 'Salary amount and pay period are required' });
    }

    const netSalary = salaryAmount - deductions + bonuses;

    const result = await pool.query(
      `UPDATE payroll 
       SET salary_amount = $1, pay_period = $2, deductions = $3, bonuses = $4, net_salary = $5 
       WHERE id = $6 
       RETURNING *`,
      [salaryAmount, payPeriod, deductions, bonuses, netSalary, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update payroll error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Delete payroll record
app.delete('/api/admin/payroll/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM payroll WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    res.json({ message: 'Payroll record deleted successfully' });
  } catch (error) {
    console.error('Delete payroll error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Employee: Get own payroll records
app.get('/api/employee/payroll', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM payroll 
       WHERE employee_id = $1 
       ORDER BY pay_period DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get employee payroll error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Update employee role
app.put('/api/admin/employees/:id/role', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'employee'].includes(role)) {
      return res.status(400).json({ error: 'Valid role required (admin or employee)' });
    }

    // Prevent changing own role
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const result = await pool.query(
      `UPDATE employees SET role = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, email, first_name, last_name, role`,
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Vercel requires module.exports for serverless
const PORT = process.env.PORT || 5000;

// For Vercel serverless
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // For local development
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}