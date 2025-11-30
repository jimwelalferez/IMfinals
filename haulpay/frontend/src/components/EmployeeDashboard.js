import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './EmployeeDashboard.css';

const EmployeeDashboard = () => {
  const { user, logout } = useAuth();
  const [payroll, setPayroll] = useState([]);

  useEffect(() => {
    fetchPayroll();
  }, []);

  const fetchPayroll = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/employee/payroll', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayroll(response.data);
    } catch (error) {
      console.error('Error fetching payroll:', error);
    }
  };

  return (
    <div className="employee-dashboard">
      <header className="dashboard-header">
        <h1>Haulpay Employee Portal</h1>
        <div className="user-info">
          <span>Welcome, {user?.firstName} {user?.lastName}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="payroll-section">
          <h2>My Payroll History</h2>
          
          {payroll.length === 0 ? (
            <p>No payroll records found.</p>
          ) : (
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>Pay Period</th>
                  <th>Base Salary</th>
                  <th>Deductions</th>
                  <th>Bonuses</th>
                  <th>Net Salary</th>
                </tr>
              </thead>
              <tbody>
                {payroll.map(record => (
                  <tr key={record.id}>
                    <td>{new Date(record.pay_period).toLocaleDateString()}</td>
                    <td>${record.salary_amount}</td>
                    <td>${record.deductions}</td>
                    <td>${record.bonuses}</td>
                    <td className="net-salary">${record.net_salary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;