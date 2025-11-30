import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });

  const [payrollForm, setPayrollForm] = useState({
    employeeId: '',
    salaryAmount: '',
    payPeriod: '',
    deductions: '0',
    bonuses: '0'
  });

  useEffect(() => {
    if (activeTab === 'employees') {
      fetchEmployees();
    } else {
      fetchPayroll();
    }
  }, [activeTab]);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/employees', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchPayroll = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/payroll', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayroll(response.data);
    } catch (error) {
      console.error('Error fetching payroll:', error);
    }
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/admin/employees', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowEmployeeForm(false);
      setFormData({ email: '', password: '', firstName: '', lastName: '' });
      fetchEmployees();
    } catch (error) {
      console.error('Error creating employee:', error);
    }
  };

  const handlePayrollSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/admin/payroll', payrollForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowPayrollForm(false);
      setPayrollForm({
        employeeId: '',
        salaryAmount: '',
        payPeriod: '',
        deductions: '0',
        bonuses: '0'
      });
      fetchPayroll();
    } catch (error) {
      console.error('Error creating payroll:', error);
    }
  };

  const deleteEmployee = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/admin/employees/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <h1>Haulpay Admin Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {user?.firstName}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button 
          className={activeTab === 'employees' ? 'active' : ''}
          onClick={() => setActiveTab('employees')}
        >
          Employees
        </button>
        <button 
          className={activeTab === 'payroll' ? 'active' : ''}
          onClick={() => setActiveTab('payroll')}
        >
          Payroll
        </button>
      </nav>

      <main className="dashboard-content">
        {activeTab === 'employees' && (
          <div className="employees-section">
            <div className="section-header">
              <h2>Employee Management</h2>
              <button onClick={() => setShowEmployeeForm(true)}>Add Employee</button>
            </div>

            {showEmployeeForm && (
              <div className="modal">
                <div className="modal-content">
                  <h3>Add New Employee</h3>
                  <form onSubmit={handleEmployeeSubmit}>
                    <input
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required
                    />
                    <input
                      type="text"
                      placeholder="First Name"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      required
                    />
                    <div className="form-actions">
                      <button type="submit">Create</button>
                      <button type="button" onClick={() => setShowEmployeeForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id}>
                    <td>{emp.id}</td>
                    <td>{emp.first_name} {emp.last_name}</td>
                    <td>{emp.email}</td>
                    <td>{emp.role}</td>
                    <td>
                      <button className="btn-danger" onClick={() => deleteEmployee(emp.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'payroll' && (
          <div className="payroll-section">
            <div className="section-header">
              <h2>Payroll Management</h2>
              <button onClick={() => setShowPayrollForm(true)}>Add Payroll</button>
            </div>

            {showPayrollForm && (
              <div className="modal">
                <div className="modal-content">
                  <h3>Add Payroll Record</h3>
                  <form onSubmit={handlePayrollSubmit}>
                    <select
                      value={payrollForm.employeeId}
                      onChange={(e) => setPayrollForm({...payrollForm, employeeId: e.target.value})}
                      required
                    >
                      <option value="">Select Employee</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Salary Amount"
                      value={payrollForm.salaryAmount}
                      onChange={(e) => setPayrollForm({...payrollForm, salaryAmount: e.target.value})}
                      required
                    />
                    <input
                      type="date"
                      value={payrollForm.payPeriod}
                      onChange={(e) => setPayrollForm({...payrollForm, payPeriod: e.target.value})}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Deductions"
                      value={payrollForm.deductions}
                      onChange={(e) => setPayrollForm({...payrollForm, deductions: e.target.value})}
                    />
                    <input
                      type="number"
                      placeholder="Bonuses"
                      value={payrollForm.bonuses}
                      onChange={(e) => setPayrollForm({...payrollForm, bonuses: e.target.value})}
                    />
                    <div className="form-actions">
                      <button type="submit">Create</button>
                      <button type="button" onClick={() => setShowPayrollForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Salary</th>
                  <th>Deductions</th>
                  <th>Bonuses</th>
                  <th>Net Salary</th>
                  <th>Pay Period</th>
                </tr>
              </thead>
              <tbody>
                {payroll.map(record => (
                  <tr key={record.id}>
                    <td>{record.first_name} {record.last_name}</td>
                    <td>${record.salary_amount}</td>
                    <td>${record.deductions}</td>
                    <td>${record.bonuses}</td>
                    <td>${record.net_salary}</td>
                    <td>{new Date(record.pay_period).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;