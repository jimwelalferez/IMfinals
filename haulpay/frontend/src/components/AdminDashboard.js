import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  const [employeeFormData, setEmployeeFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'employee'
  });

  const [payrollFormData, setPayrollFormData] = useState({
    employeeId: '',
    tripType: 'regular',
    tripDescription: '',
    baseSalary: '',
    distanceAllowance: '0',
    fuelAllowance: '0',
    mealAllowance: '0',
    otherAllowances: '0',
    otherDeductions: '0',
    payPeriod: ''
  });

  const tripTypes = [
    { value: 'regular', label: 'Regular Trip' },
    { value: 'long_haul', label: 'Long Haul' },
    { value: 'intercity', label: 'Intercity' },
    { value: 'local', label: 'Local Delivery' },
    { value: 'special', label: 'Special Delivery' },
    { value: 'corporate', label: 'Corporate Contract' }
  ];

  // Helper functions for weekly grouping
  const getWeekNumber = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  };

  const getWeekRange = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
  };

  const formatWeekLabel = (startDate, endDate) => {
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const year = startDate.getFullYear();
    
    if (startMonth === endMonth) {
      return `Week of ${startMonth} ${startDate.getDate()}-${endDate.getDate()}, ${year}`;
    } else {
      return `Week of ${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}, ${year}`;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateFull = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatWeekRange = (startDate, endDate) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    return `${start} - ${end}`;
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'employees') {
        await fetchEmployees();
      } else {
        await fetchPayroll();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/employees', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const filteredEmployees = response.data.filter(emp => 
        emp.email !== 'employee@company.com' && 
        !(emp.first_name === 'John' && emp.last_name === 'Doe')
      );
      setEmployees(filteredEmployees);
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

  // Group payroll by employee with weekly breakdown
  const groupPayrollByEmployee = () => {
    const grouped = {};
    
    payroll.forEach(record => {
      const employeeId = record.employee_id;
      
      if (!grouped[employeeId]) {
        const employee = employees.find(e => e.id === parseInt(employeeId));
        grouped[employeeId] = {
          employee: employee ? `${employee.first_name} ${employee.last_name}` : `Employee ${employeeId}`,
          employeeData: employee,
          totalEarnings: 0,
          totalDeductions: 0,
          netTotal: 0,
          weeks: {},
          allTrips: []
        };
      }
      
      const baseSalary = parseFloat(record.salary_amount) || 0;
      const allowances = parseFloat(record.bonuses) || 0;
      const deductions = parseFloat(record.deductions) || 0;
      const netSalary = baseSalary + allowances - deductions;
      
      // Add to all trips
      grouped[employeeId].allTrips.push({
        id: record.id,
        tripType: record.trip_type || 'regular',
        tripDescription: record.trip_description || '',
        baseSalary,
        allowances,
        deductions,
        netSalary,
        payPeriod: record.pay_period,
        tripDate: formatDate(record.pay_period)
      });
      
      // Group by week
      const weekKey = getWeekNumber(record.pay_period);
      const weekRange = getWeekRange(new Date(record.pay_period));
      const weekLabel = formatWeekLabel(weekRange.start, weekRange.end);
      
      if (!grouped[employeeId].weeks[weekKey]) {
        grouped[employeeId].weeks[weekKey] = {
          weekLabel: weekLabel,
          weekRange: weekRange,
          trips: [],
          totalBaseSalary: 0,
          totalAllowances: 0,
          totalDeductions: 0,
          totalNetSalary: 0
        };
      }
      
      // Add trip to week
      grouped[employeeId].weeks[weekKey].trips.push({
        id: record.id,
        tripType: record.trip_type || 'regular',
        tripDescription: record.trip_description || '',
        baseSalary,
        allowances,
        deductions,
        netSalary,
        payPeriod: record.pay_period,
        tripDate: formatDate(record.pay_period)
      });
      
      // Update week totals
      grouped[employeeId].weeks[weekKey].totalBaseSalary += baseSalary;
      grouped[employeeId].weeks[weekKey].totalAllowances += allowances;
      grouped[employeeId].weeks[weekKey].totalDeductions += deductions;
      grouped[employeeId].weeks[weekKey].totalNetSalary += netSalary;
      
      // Update employee totals
      grouped[employeeId].totalEarnings += baseSalary + allowances;
      grouped[employeeId].totalDeductions += deductions;
      grouped[employeeId].netTotal += netSalary;
    });
    
    return grouped;
  };

  // Get payroll for specific employee
  const getEmployeePayroll = (employeeId) => {
    return payroll.filter(record => record.employee_id === employeeId);
  };

  // Get trip type label
  const getTripTypeLabel = (tripType) => {
    const tripTypeObj = tripTypes.find(t => t.value === tripType);
    return tripTypeObj ? tripTypeObj.label : tripType;
  };

  // Format currency
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '₱0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `₱${isNaN(num) ? '0.00' : num.toFixed(2)}`;
  };

  // Employee CRUD Operations
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      
      if (editingEmployee) {
        // Update employee role
        await axios.put(`http://localhost:5000/api/admin/employees/${editingEmployee.id}/role`, 
          { role: employeeFormData.role }, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        // Create new employee
        await axios.post('http://localhost:5000/api/admin/employees', employeeFormData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      resetEmployeeForm();
      await fetchEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      alert(error.response?.data?.error || 'Failed to save employee');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteEmployee = async (id, email) => {
    if (email === 'admin@mjjfreight.com') {
      alert('Cannot delete the main admin account');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/admin/employees/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Failed to delete employee');
    }
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setEmployeeFormData({
      email: employee.email,
      password: '',
      firstName: employee.first_name,
      lastName: employee.last_name,
      role: employee.role
    });
    setShowEmployeeForm(true);
  };

  const resetEmployeeForm = () => {
    setEditingEmployee(null);
    setShowEmployeeForm(false);
    setEmployeeFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'employee'
    });
  };

  // Payroll CRUD Operations
  const handlePayrollSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      
      // Calculate totals
      const baseSalary = parseFloat(payrollFormData.baseSalary) || 0;
      const distanceAllowance = parseFloat(payrollFormData.distanceAllowance) || 0;
      const fuelAllowance = parseFloat(payrollFormData.fuelAllowance) || 0;
      const mealAllowance = parseFloat(payrollFormData.mealAllowance) || 0;
      const otherAllowances = parseFloat(payrollFormData.otherAllowances) || 0;
      const otherDeductions = parseFloat(payrollFormData.otherDeductions) || 0;
      
      const totalAllowances = distanceAllowance + fuelAllowance + mealAllowance + otherAllowances;
      const totalDeductions = otherDeductions;
      const netSalary = baseSalary + totalAllowances - totalDeductions;
      
      const payrollData = {
        employeeId: payrollFormData.employeeId,
        salaryAmount: baseSalary,
        payPeriod: payrollFormData.payPeriod,
        deductions: totalDeductions,
        bonuses: totalAllowances,
        netSalary: netSalary,
        tripType: payrollFormData.tripType,
        tripDescription: payrollFormData.tripDescription,
        distanceAllowance: distanceAllowance,
        fuelAllowance: fuelAllowance,
        mealAllowance: mealAllowance,
        otherAllowances: otherAllowances,
        otherDeductions: otherDeductions
      };
      
      if (editingPayroll) {
        // Update payroll
        await axios.put(`http://localhost:5000/api/admin/payroll/${editingPayroll.id}`, payrollData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Create new payroll
        await axios.post('http://localhost:5000/api/admin/payroll', payrollData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      resetPayrollForm();
      await fetchPayroll();
    } catch (error) {
      console.error('Error saving payroll:', error);
      alert(error.response?.data?.error || 'Failed to save payroll record');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeletePayroll = async (id) => {
    if (!window.confirm('Are you sure you want to delete this payroll record?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/admin/payroll/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchPayroll();
    } catch (error) {
      console.error('Error deleting payroll:', error);
      alert('Failed to delete payroll record');
    }
  };

  const handleEditPayroll = (payrollRecord) => {
    setEditingPayroll(payrollRecord);
    setPayrollFormData({
      employeeId: payrollRecord.employee_id,
      tripType: payrollRecord.trip_type || 'regular',
      tripDescription: payrollRecord.trip_description || '',
      baseSalary: payrollRecord.salary_amount || '',
      distanceAllowance: payrollRecord.distance_allowance || '0',
      fuelAllowance: payrollRecord.fuel_allowance || '0',
      mealAllowance: payrollRecord.meal_allowance || '0',
      otherAllowances: payrollRecord.other_allowances || '0',
      otherDeductions: payrollRecord.other_deductions || '0',
      payPeriod: payrollRecord.pay_period ? payrollRecord.pay_period.split('T')[0] : ''
    });
    setShowPayrollForm(true);
  };

  const resetPayrollForm = () => {
    setEditingPayroll(null);
    setShowPayrollForm(false);
    setPayrollFormData({
      employeeId: '',
      tripType: 'regular',
      tripDescription: '',
      baseSalary: '',
      distanceAllowance: '0',
      fuelAllowance: '0',
      mealAllowance: '0',
      otherAllowances: '0',
      otherDeductions: '0',
      payPeriod: ''
    });
  };

  const groupedPayroll = groupPayrollByEmployee();

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">M</span>
            <span className="logo-text">MJJ Freight Cargo Forwarding</span>
          </div>
          <h1 className="dashboard-title">Admin Dashboard</h1>
        </div>
        
        <div className="header-right">
          <div className="theme-toggle">
            <button className="theme-toggle-button" onClick={toggleTheme} title="Toggle dark mode">
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
          <div className="user-menu">
            <span className="user-greeting">Welcome, {user?.firstName}</span>
            <button className="logout-button" onClick={logout}>Sign Out</button>
          </div>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button 
          className={`nav-button ${activeTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          Employees
        </button>
        <button 
          className={`nav-button ${activeTab === 'payroll' ? 'active' : ''}`}
          onClick={() => setActiveTab('payroll')}
        >
          Payroll
        </button>
      </nav>

      <main className="dashboard-content">
        {activeTab === 'employees' && (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Employee Management</h2>
              <div className="section-actions">
                <button 
                  className="primary-button"
                  onClick={() => {
                    resetEmployeeForm();
                    setShowEmployeeForm(true);
                  }}
                >
                  + Add Employee
                </button>
              </div>
            </div>

            {showEmployeeForm && (
              <div className="modal-overlay">
                <div className="modal">
                  <div className="modal-header">
                    <h3>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h3>
                    <button 
                      className="modal-close"
                      onClick={resetEmployeeForm}
                      disabled={processing}
                    >
                      ×
                    </button>
                  </div>
                  <form onSubmit={handleEmployeeSubmit} className="modal-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label>First Name</label>
                        <input
                          type="text"
                          value={employeeFormData.firstName}
                          onChange={(e) => setEmployeeFormData({...employeeFormData, firstName: e.target.value})}
                          required
                          disabled={processing || editingEmployee}
                        />
                      </div>
                      <div className="form-group">
                        <label>Last Name</label>
                        <input
                          type="text"
                          value={employeeFormData.lastName}
                          onChange={(e) => setEmployeeFormData({...employeeFormData, lastName: e.target.value})}
                          required
                          disabled={processing || editingEmployee}
                        />
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label>Email Address</label>
                      <input
                        type="email"
                        value={employeeFormData.email}
                        onChange={(e) => setEmployeeFormData({...employeeFormData, email: e.target.value})}
                        required
                        disabled={processing || editingEmployee}
                      />
                    </div>
                    
                    {!editingEmployee && (
                      <div className="form-group">
                        <label>Password</label>
                        <input
                          type="password"
                          value={employeeFormData.password}
                          onChange={(e) => setEmployeeFormData({...employeeFormData, password: e.target.value})}
                          required={!editingEmployee}
                          disabled={processing}
                        />
                      </div>
                    )}
                    
                    <div className="form-group">
                      <label>Role</label>
                      <select
                        value={employeeFormData.role}
                        onChange={(e) => setEmployeeFormData({...employeeFormData, role: e.target.value})}
                        required
                        disabled={processing}
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                    
                    <div className="modal-actions">
                      <button type="button" className="secondary-button" onClick={resetEmployeeForm} disabled={processing}>
                        Cancel
                      </button>
                      <button type="submit" className="primary-button" disabled={processing}>
                        {processing ? 'Saving...' : editingEmployee ? 'Update Employee' : 'Create Employee'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading employees...</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Payroll Summary</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => {
                      const employeePayroll = getEmployeePayroll(emp.id);
                      const tripCount = employeePayroll.length;
                      const totalEarnings = employeePayroll.reduce((sum, record) => {
                        const baseSalary = parseFloat(record.salary_amount) || 0;
                        const allowances = parseFloat(record.bonuses) || 0;
                        return sum + baseSalary + allowances;
                      }, 0);
                      
                      return (
                        <tr key={emp.id}>
                          <td>
                            <div className="employee-info">
                              <div className="avatar">
                                {emp.first_name?.[0]}{emp.last_name?.[0]}
                              </div>
                              <div>
                                <div className="employee-name">{emp.first_name} {emp.last_name}</div>
                                <div className="employee-id">ID: {emp.id}</div>
                              </div>
                            </div>
                          </td>
                          <td>{emp.email}</td>
                          <td>
                            <span className={`role-badge ${emp.role}`}>
                              {emp.role}
                            </span>
                          </td>
                          <td>
                            <div className="employee-payroll-summary">
                              <div className="trip-count">
                                <span className="count-badge">{tripCount}</span> trips
                              </div>
                              <div className="total-earnings">
                                Total: {formatCurrency(totalEarnings)}
                              </div>
                              {tripCount > 0 && (
                                <div className="last-trip-date">
                                  Last trip: {employeePayroll[0].pay_period ? 
                                    formatDate(employeePayroll[0].pay_period) : 'N/A'}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="edit-button"
                                onClick={() => handleEditEmployee(emp)}
                                disabled={emp.email === 'admin@mjjfreight.com'}
                              >
                                Edit Role
                              </button>
                              <button 
                                className="danger-button"
                                onClick={() => handleDeleteEmployee(emp.id, emp.email)}
                                disabled={emp.email === 'admin@mjjfreight.com'}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payroll' && (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Payroll Management</h2>
              <button 
                className="primary-button"
                onClick={() => {
                  resetPayrollForm();
                  setShowPayrollForm(true);
                }}
              >
                + Add Payroll Record
              </button>
            </div>

            {showPayrollForm && (
              <div className="modal-overlay">
                <div className="modal">
                  <div className="modal-header">
                    <h3>{editingPayroll ? 'Edit Payroll Record' : 'Add Payroll Record'}</h3>
                    <button 
                      className="modal-close"
                      onClick={resetPayrollForm}
                      disabled={processing}
                    >
                      ×
                    </button>
                  </div>
                  <form onSubmit={handlePayrollSubmit} className="modal-form">
                    <div className="form-group">
                      <label>Employee</label>
                      <select
                        value={payrollFormData.employeeId}
                        onChange={(e) => setPayrollFormData({...payrollFormData, employeeId: e.target.value})}
                        required
                        disabled={processing || employees.length === 0}
                      >
                        <option value="">Select employee</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name} ({getEmployeePayroll(emp.id).length} trips)
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label>Trip Type</label>
                        <select
                          value={payrollFormData.tripType}
                          onChange={(e) => setPayrollFormData({...payrollFormData, tripType: e.target.value})}
                          required
                          disabled={processing}
                        >
                          {tripTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Trip Date</label>
                        <input
                          type="date"
                          value={payrollFormData.payPeriod}
                          onChange={(e) => setPayrollFormData({...payrollFormData, payPeriod: e.target.value})}
                          required
                          disabled={processing}
                        />
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label>Trip Description</label>
                      <input
                        type="text"
                        value={payrollFormData.tripDescription}
                        onChange={(e) => setPayrollFormData({...payrollFormData, tripDescription: e.target.value})}
                        disabled={processing}
                        placeholder="Describe the trip or delivery"
                      />
                    </div>
                    
                    <div className="section-divider">
                      <span>Salary Breakdown</span>
                    </div>
                    
                    <div className="salary-breakdown-grid">
                      <div className="salary-breakdown-item">
                        <label>Base Salary (₱)</label>
                        <input
                          type="number"
                          value={payrollFormData.baseSalary}
                          onChange={(e) => setPayrollFormData({...payrollFormData, baseSalary: e.target.value})}
                          required
                          disabled={processing}
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="salary-breakdown-item">
                        <label>Distance Allowance (₱)</label>
                        <input
                          type="number"
                          value={payrollFormData.distanceAllowance}
                          onChange={(e) => setPayrollFormData({...payrollFormData, distanceAllowance: e.target.value})}
                          disabled={processing}
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                    <div className="total-calculation">
                      <div className="calculation-row">
                        <span>Base Salary:</span>
                        <span>{formatCurrency(parseFloat(payrollFormData.baseSalary) || 0)}</span>
                      </div>
                      <div className="calculation-row">
                        <span>Total Allowances:</span>
                        <span className="text-success">
                          {formatCurrency(
                            (parseFloat(payrollFormData.distanceAllowance) || 0)
                          )}
                        </span>
                      </div>
                      <div className="calculation-row">
                        <span>Total Deductions:</span>
                        <span className="text-danger">
                          {formatCurrency(
                            (parseFloat(payrollFormData.otherDeductions) || 0)
                          )}
                        </span>
                      </div>
                      <div className="calculation-row total-row">
                        <span>Trip Earnings:</span>
                        <span className="net-salary-total">
                          {formatCurrency(
                            (parseFloat(payrollFormData.baseSalary) || 0) +
                            (parseFloat(payrollFormData.distanceAllowance) || 0) -
                            (parseFloat(payrollFormData.otherDeductions) || 0)
                          )}
                        </span>
                      </div>
                    </div>
                    
                    <div className="modal-actions">
                      <button type="button" className="secondary-button" onClick={resetPayrollForm} disabled={processing}>
                        Cancel
                      </button>
                      <button type="submit" className="primary-button" disabled={processing}>
                        {processing ? 'Saving...' : editingPayroll ? 'Update Record' : 'Add Trip Record'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading payroll records...</p>
              </div>
            ) : (
              <div className="payroll-container">
                {Object.keys(groupedPayroll).length === 0 ? (
                  <div className="empty-payroll">
                    <div className="empty-icon">📊</div>
                    <h3>No payroll records yet</h3>
                    <p>Add your first payroll record to get started</p>
                  </div>
                ) : (
                  Object.keys(groupedPayroll).map(employeeId => {
                    const employeeData = groupedPayroll[employeeId];
                    const employee = employees.find(e => e.id === parseInt(employeeId));
                    const weekKeys = Object.keys(employeeData.weeks).sort().reverse();
                    
                    return (
                      <div key={employeeId} className="employee-payroll-card">
                        <div className="employee-payroll-header">
                          <div className="employee-header-info">
                            <div className="employee-header-name">
                              <span className="employee-avatar-small">
                                {employee?.first_name?.[0]}{employee?.last_name?.[0]}
                              </span>
                              <div>
                                <h3>{employeeData.employee}</h3>
                                <div className="employee-header-stats">
                                  <span className="trip-count-badge">
                                    {employeeData.allTrips.length} total trips
                                  </span>
                                  <span className="total-earnings-badge">
                                    Total: {formatCurrency(employeeData.netTotal)}
                                  </span>
                                  <span className="week-count-badge">
                                    {weekKeys.length} weeks
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="employee-header-actions">
                              <button 
                                className="primary-button small"
                                onClick={() => {
                                  setPayrollFormData({
                                    ...payrollFormData,
                                    employeeId: employeeId
                                  });
                                  setShowPayrollForm(true);
                                }}
                              >
                                + Add Trip
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Weekly Breakdown */}
                        <div className="weekly-breakdown">
                          <h4 className="weekly-breakdown-title">Weekly Summary</h4>
                          {weekKeys.map(weekKey => {
                            const weekData = employeeData.weeks[weekKey];
                            return (
                              <div key={weekKey} className="week-card">
                                <div className="week-header">
                                  <div className="week-label">
                                    <strong>{weekData.weekLabel}</strong>
                                    <div className="week-range">
                                      {formatWeekRange(weekData.weekRange.start, weekData.weekRange.end)}
                                    </div>
                                  </div>
                                  <div className="week-stats">
                                    <span className="week-trip-count">
                                      {weekData.trips.length} trips
                                    </span>
                                    <span className="week-net-pay">
                                      {formatCurrency(weekData.totalNetSalary)}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="week-trips-table">
                                  <table className="trips-table">
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Trip Type</th>
                                        <th>Description</th>
                                        <th>Base Salary</th>
                                        <th>Allowances</th>
                                        <th>Deductions</th>
                                        <th>Trip Earnings</th>
                                        <th>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {weekData.trips.map((trip, index) => (
                                        <tr key={trip.id}>
                                          <td>
                                            <div className="trip-date">
                                              {trip.tripDate}
                                            </div>
                                          </td>
                                          <td>
                                            <span className="trip-badge" data-trip-type={trip.tripType}>
                                              {getTripTypeLabel(trip.tripType)}
                                            </span>
                                          </td>
                                          <td>
                                            <div className="trip-description-cell" title={trip.tripDescription}>
                                              {trip.tripDescription || 'No description'}
                                            </div>
                                          </td>
                                          <td>{formatCurrency(trip.baseSalary)}</td>
                                          <td className="text-success">{formatCurrency(trip.allowances)}</td>
                                          <td className="text-danger">{formatCurrency(trip.deductions)}</td>
                                          <td className="trip-earnings">{formatCurrency(trip.netSalary)}</td>
                                          <td>
                                            <div className="action-buttons">
                                              <button 
                                                className="edit-button small"
                                                onClick={() => {
                                                  const payrollRecord = payroll.find(p => p.id === trip.id);
                                                  if (payrollRecord) handleEditPayroll(payrollRecord);
                                                }}
                                              >
                                                Edit
                                              </button>
                                              <button 
                                                className="danger-button small"
                                                onClick={() => handleDeletePayroll(trip.id)}
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="week-totals-row">
                                        <td colSpan="3" className="week-total-label">
                                          <strong>Week Totals:</strong>
                                        </td>
                                        <td><strong>{formatCurrency(weekData.totalBaseSalary)}</strong></td>
                                        <td className="text-success"><strong>{formatCurrency(weekData.totalAllowances)}</strong></td>
                                        <td className="text-danger"><strong>{formatCurrency(weekData.totalDeductions)}</strong></td>
                                        <td className="trip-earnings"><strong>{formatCurrency(weekData.totalNetSalary)}</strong></td>
                                        <td></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="employee-payroll-summary-footer">
                          <div className="summary-totals">
                            <div className="total-item">
                              <span className="total-label">Total Base Salary:</span>
                              <span className="total-value">
                                {formatCurrency(employeeData.totalEarnings - employeeData.totalDeductions)}
                              </span>
                            </div>
                            <div className="total-item">
                              <span className="total-label">Total Allowances:</span>
                              <span className="total-value text-success">
                                {formatCurrency(employeeData.totalEarnings - employeeData.totalDeductions)}
                              </span>
                            </div>
                            <div className="total-item">
                              <span className="total-label">Total Deductions:</span>
                              <span className="total-value text-danger">
                                {formatCurrency(employeeData.totalDeductions)}
                              </span>
                            </div>
                            <div className="total-item grand-total">
                              <span className="total-label">Grand Total:</span>
                              <span className="total-value grand-total-value">
                                {formatCurrency(employeeData.netTotal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;