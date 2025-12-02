import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import './EmployeeDashboard.css';

// Import for PDF generation
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const EmployeeDashboard = () => {
  const { user, logout } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const [payroll, setPayroll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRecords: 0,
    averageSalary: 0,
    totalEarnings: 0
  });
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);

  useEffect(() => {
    fetchPayroll();
  }, []);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/employee/payroll', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayroll(response.data);
      
      if (response.data.length > 0) {
        const totalEarnings = response.data.reduce((sum, record) => {
          const salaryAmount = parseFloat(record.salary_amount) || 0;
          const deductions = parseFloat(record.deductions) || 0;
          const bonuses = parseFloat(record.bonuses) || 0;
          const netSalary = parseFloat(record.net_salary) || (salaryAmount - deductions + bonuses);
          return sum + (isNaN(netSalary) ? 0 : netSalary);
        }, 0);
        
        const averageSalary = totalEarnings / response.data.length;
        
        setStats({
          totalRecords: response.data.length,
          averageSalary: isNaN(averageSalary) ? 0 : averageSalary,
          totalEarnings: isNaN(totalEarnings) ? 0 : totalEarnings
        });
      }
    } catch (error) {
      console.error('Error fetching payroll:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '₱0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `₱${isNaN(num) ? '0.00' : num.toFixed(2)}`;
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

  const getTripTypeLabel = (tripType) => {
    const tripTypes = {
      'regular': 'Regular Trip',
      'long_haul': 'Long Haul',
      'intercity': 'Intercity',
      'local': 'Local Delivery',
      'special': 'Special Delivery',
      'corporate': 'Corporate Contract'
    };
    return tripTypes[tripType] || tripType;
  };

  // Get week number and year from a date
  const getWeekNumber = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  };

  // Get start and end of week from a date
  const getWeekRange = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
  };

  // Format week range for display
  const formatWeekRange = (startDate, endDate) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    return `${start} - ${end}`;
  };

  // Format week label for display
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

  // Group payroll by week
  const groupPayrollByWeek = () => {
    const grouped = {};
    
    payroll.forEach(record => {
      if (!record.pay_period) return;
      
      const date = new Date(record.pay_period);
      const weekKey = getWeekNumber(date);
      const weekRange = getWeekRange(date);
      
      if (!grouped[weekKey]) {
        grouped[weekKey] = {
          weekLabel: formatWeekLabel(weekRange.start, weekRange.end),
          weekRange: weekRange,
          records: [],
          totalBaseSalary: 0,
          totalBonuses: 0,
          totalDeductions: 0,
          totalNetSalary: 0,
        };
      }
      
      const salaryAmount = parseFloat(record.salary_amount) || 0;
      const deductions = parseFloat(record.deductions) || 0;
      const bonuses = parseFloat(record.bonuses) || 0;
      const netSalary = parseFloat(record.net_salary) || (salaryAmount - deductions + bonuses);
      
      grouped[weekKey].records.push({
        ...record,
        salaryAmount,
        deductions,
        bonuses,
        netSalary
      });
      
      grouped[weekKey].totalBaseSalary += salaryAmount;
      grouped[weekKey].totalBonuses += bonuses;
      grouped[weekKey].totalDeductions += deductions;
      grouped[weekKey].totalNetSalary += netSalary;
    });
    
    return grouped;
  };

  const handleViewPayslip = (weekKey) => {
    setSelectedWeek(weekKey);
    setShowPayslipModal(true);
  };

  const handleClosePayslip = () => {
    setShowPayslipModal(false);
    setSelectedWeek(null);
  };

  const generatePayslipPDF = (weekKey) => {
    const groupedPayroll = groupPayrollByWeek();
    const weekData = groupedPayroll[weekKey];
    if (!weekData) return;
    
    const doc = new jsPDF();
    
    // Payslip Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('MJJ FREIGHT CARGO FORWARDING - PAYSLIP', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Weekly Payroll Summary', 105, 28, { align: 'center' });
    
    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);
    
    // Employee Details
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text('EMPLOYEE DETAILS', 20, 45);
    
    doc.setFontSize(10);
    doc.text(`Name: ${user?.firstName} ${user?.lastName}`, 20, 55);
    doc.text(`Employee ID: ${user?.id || 'N/A'}`, 20, 62);
    doc.text(`Position: ${user?.role || 'Employee'}`, 20, 69);
    doc.text(`Department: Logistics & Delivery`, 20, 76);
    
    // Payroll Details
    doc.setFontSize(12);
    doc.text('PAYROLL DETAILS', 20, 90);
    
    doc.setFontSize(10);
    doc.text(`Pay Period: ${weekData.weekLabel}`, 20, 100);
    doc.text(`Week Range: ${formatDateFull(weekData.weekRange.start)} - ${formatDateFull(weekData.weekRange.end)}`, 20, 107);
    doc.text(`Payment Date: ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })}`, 20, 114);
    doc.text(`Total Trips: ${weekData.records.length}`, 20, 121);
    
    // Salary Breakdown Summary
    doc.setFontSize(12);
    doc.text('WEEKLY EARNINGS SUMMARY', 20, 135);
    
    // Summary Table
    doc.autoTable({
      startY: 142,
      head: [['Description', 'Amount (₱)']],
      body: [
        ['Total Base Salary', formatCurrency(weekData.totalBaseSalary).replace('₱', '')],
        ['Total Allowances (Bonuses)', formatCurrency(weekData.totalBonuses).replace('₱', '')],
        ['Gross Earnings', formatCurrency(weekData.totalBaseSalary + weekData.totalBonuses).replace('₱', '')],
        ['Total Deductions', formatCurrency(weekData.totalDeductions).replace('₱', '')],
        ['Net Pay', formatCurrency(weekData.totalNetSalary).replace('₱', '')],
      ],
      theme: 'grid',
      headStyles: { fillColor: [70, 130, 180] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 50 }
      }
    });
    
    // Trip Details Table
    const summaryY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text('TRIP DETAILS', 20, summaryY);
    
    const tripRows = weekData.records.map(record => [
      formatDate(record.pay_period),
      getTripTypeLabel(record.trip_type),
      formatCurrency(record.salaryAmount).replace('₱', ''),
      formatCurrency(record.bonuses).replace('₱', ''),
      formatCurrency(record.deductions).replace('₱', ''),
      formatCurrency(record.netSalary).replace('₱', '')
    ]);
    
    doc.autoTable({
      startY: summaryY + 5,
      head: [['Date', 'Trip Type', 'Base Salary', 'Allowances', 'Deductions', 'Net Amount']],
      body: tripRows,
      theme: 'grid',
      headStyles: { fillColor: [70, 130, 180] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 }
      }
    });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text('This is a computer-generated document. No signature required.', 105, finalY, { align: 'center' });
    doc.text('MJJ Freight Cargo Forwarding • admin@mjjfreight.com', 105, finalY + 5, { align: 'center' });
    
    // Save PDF
    const weekLabel = weekData.weekLabel.replace(/[^a-zA-Z0-9]/g, '-');
    doc.save(`Payslip-${user?.lastName}-${weekLabel}.pdf`);
  };

  const getPrintPayslipHTML = (weekKey) => {
    const groupedPayroll = groupPayrollByWeek();
    const weekData = groupedPayroll[weekKey];
    if (!weekData) return '';
    
    return `
      <div class="info-grid">
        <div>
          <div class="section">
            <div class="section-title">EMPLOYEE INFORMATION</div>
            <div class="info-item"><span class="info-label">Name:</span> ${user?.firstName} ${user?.lastName}</div>
            <div class="info-item"><span class="info-label">Employee ID:</span> ${user?.id || 'N/A'}</div>
            <div class="info-item"><span class="info-label">Position:</span> ${user?.role || 'Employee'}</div>
            <div class="info-item"><span class="info-label">Department:</span> Logistics & Delivery</div>
          </div>
        </div>
        
        <div>
          <div class="section">
            <div class="section-title">PAYMENT INFORMATION</div>
            <div class="info-item"><span class="info-label">Pay Period:</span> ${weekData.weekLabel}</div>
            <div class="info-item"><span class="info-label">Week Range:</span> ${formatDateFull(weekData.weekRange.start)} - ${formatDateFull(weekData.weekRange.end)}</div>
            <div class="info-item"><span class="info-label">Payment Date:</span> ${new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}</div>
            <div class="info-item"><span class="info-label">Total Trips:</span> ${weekData.records.length}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">WEEKLY EARNINGS SUMMARY</div>
        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount (₱)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total Base Salary</td>
              <td>${formatCurrency(weekData.totalBaseSalary)}</td>
            </tr>
            <tr>
              <td>Total Allowances (Bonuses)</td>
              <td>${formatCurrency(weekData.totalBonuses)}</td>
            </tr>
            <tr>
              <td>Total Deductions</td>
              <td>${formatCurrency(weekData.totalDeductions)}</td>
            </tr>
            <tr class="total-row">
              <td>Gross Earnings</td>
              <td>${formatCurrency(weekData.totalBaseSalary + weekData.totalBonuses)}</td>
            </tr>
            <tr class="total-row" style="background-color: #e8f5e9;">
              <td><strong>NET PAY</strong></td>
              <td><strong>${formatCurrency(weekData.totalNetSalary)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">TRIP DETAILS (${weekData.records.length} trips)</div>
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Trip Type</th>
              <th>Base Salary</th>
              <th>Allowances</th>
              <th>Deductions</th>
              <th>Net Amount</th>
            </tr>
          </thead>
          <tbody>
            ${weekData.records.map(record => `
              <tr>
                <td>${formatDate(record.pay_period)}</td>
                <td>${getTripTypeLabel(record.trip_type)}</td>
                <td>${formatCurrency(record.salaryAmount)}</td>
                <td>${formatCurrency(record.bonuses)}</td>
                <td>${formatCurrency(record.deductions)}</td>
                <td>${formatCurrency(record.netSalary)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const printPayslip = () => {
    if (!selectedWeek) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Weekly Payslip - ${user?.firstName} ${user?.lastName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
            .payslip-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .company-name { font-size: 24px; font-weight: bold; color: #333; }
            .payslip-title { font-size: 28px; margin: 10px 0; color: #4682B4; }
            .section { margin: 25px 0; }
            .section-title { font-size: 18px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .info-item { margin: 8px 0; }
            .info-label { font-weight: bold; color: #555; }
            .table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
            .table th { background-color: #4682B4; color: white; padding: 10px; text-align: left; }
            .table td { padding: 8px; border: 1px solid #ddd; }
            .total-row { font-weight: bold; background-color: #f8f9fa; }
            .footer { text-align: center; margin-top: 40px; color: #666; font-size: 12px; border-top: 1px solid #ccc; padding-top: 20px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="payslip-header">
            <div class="company-name">MJJ FREIGHT CARGO FORWARDING</div>
            <div class="payslip-title">WEEKLY EMPLOYEE PAYSLIP</div>
            <div>Official Payroll Summary Document</div>
          </div>
          
          ${getPrintPayslipHTML(selectedWeek)}
          
          <div class="footer">
            <p>This is a computer-generated document. No signature required.</p>
            <p>MJJ Freight Cargo Forwarding • admin@mjjfreight.com</p>
          </div>
          
          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #4682B4; color: white; border: none; cursor: pointer; margin: 10px;">
              Print Payslip
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; cursor: pointer; margin: 10px;">
              Close Window
            </button>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  const generatePayslipJSX = (weekKey) => {
    const groupedPayroll = groupPayrollByWeek();
    const weekData = groupedPayroll[weekKey];
    if (!weekData) return null;
    
    return (
      <div className="payslip-content">
        <div className="info-grid">
          <div>
            <div className="section">
              <div className="section-title">EMPLOYEE INFORMATION</div>
              <div className="info-item"><span className="info-label">Name:</span> {user?.firstName} {user?.lastName}</div>
              <div className="info-item"><span className="info-label">Employee ID:</span> {user?.id || 'N/A'}</div>
              <div className="info-item"><span className="info-label">Position:</span> {user?.role || 'Employee'}</div>
              <div className="info-item"><span className="info-label">Department:</span> Logistics & Delivery</div>
            </div>
          </div>
          
          <div>
            <div className="section">
              <div className="section-title">PAYMENT INFORMATION</div>
              <div className="info-item"><span className="info-label">Pay Period:</span> {weekData.weekLabel}</div>
              <div className="info-item"><span className="info-label">Week Range:</span> {formatDateFull(weekData.weekRange.start)} - {formatDateFull(weekData.weekRange.end)}</div>
              <div className="info-item"><span className="info-label">Payment Date:</span> {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}</div>
              <div className="info-item"><span className="info-label">Total Trips:</span> {weekData.records.length}</div>
            </div>
          </div>
        </div>
        
        <div className="section">
          <div className="section-title">WEEKLY EARNINGS SUMMARY</div>
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Amount (₱)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Base Salary</td>
                <td>{formatCurrency(weekData.totalBaseSalary)}</td>
              </tr>
              <tr>
                <td>Total Allowances (Bonuses)</td>
                <td>{formatCurrency(weekData.totalBonuses)}</td>
              </tr>
              <tr>
                <td>Total Deductions</td>
                <td>{formatCurrency(weekData.totalDeductions)}</td>
              </tr>
              <tr className="total-row">
                <td>Gross Earnings</td>
                <td>{formatCurrency(weekData.totalBaseSalary + weekData.totalBonuses)}</td>
              </tr>
              <tr className="total-row" style={{ backgroundColor: '#e8f5e9' }}>
                <td><strong>NET PAY</strong></td>
                <td><strong>{formatCurrency(weekData.totalNetSalary)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="section">
          <div className="section-title">TRIP DETAILS ({weekData.records.length} trips)</div>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Trip Type</th>
                <th>Base Salary</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {weekData.records.map((record, index) => (
                <tr key={index}>
                  <td>{formatDate(record.pay_period)}</td>
                  <td>{getTripTypeLabel(record.trip_type)}</td>
                  <td>{formatCurrency(record.salaryAmount)}</td>
                  <td>{formatCurrency(record.bonuses)}</td>
                  <td>{formatCurrency(record.deductions)}</td>
                  <td>{formatCurrency(record.netSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const groupedPayroll = groupPayrollByWeek();
  const sortedWeeks = Object.keys(groupedPayroll).sort().reverse();

  return (
    <div className="employee-dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">M</span>
            <span className="logo-text">MJJ Freight Cargo Forwarding</span>
          </div>
          <h1 className="dashboard-title">Employee Portal</h1>
        </div>
        
        <div className="header-right">
          <div className="theme-toggle">
            <button className="theme-toggle-button" onClick={toggleTheme} title="Toggle dark mode">
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
          <div className="user-menu">
            <div className="user-info">
              <div className="user-avatar">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="user-details">
                <div className="user-name">{user?.firstName} {user?.lastName}</div>
                <div className="user-role">{user?.role}</div>
              </div>
            </div>
            <button className="logout-button" onClick={logout}>Sign Out</button>
          </div>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="section">
          <h2 className="section-title">Weekly Payroll Summary</h2>
          
          {payroll.length > 0 && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.totalRecords}</div>
                <div className="stat-label">Total Trips</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{formatCurrency(stats.averageSalary)}</div>
                <div className="stat-label">Average Per Trip</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{formatCurrency(stats.totalEarnings)}</div>
                <div className="stat-label">Total Earnings</div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading payroll data...</p>
            </div>
          ) : payroll.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h3>No payroll records found</h3>
              <p>Contact your administrator if you believe this is an error</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Date Range</th>
                    <th>Trips</th>
                    <th>Total Base Salary</th>
                    <th>Total Allowances</th>
                    <th>Total Deductions</th>
                    <th>Net Pay</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWeeks.map(weekKey => {
                    const weekData = groupedPayroll[weekKey];
                    return (
                      <tr key={weekKey}>
                        <td>
                          <strong>{weekData.weekLabel}</strong>
                        </td>
                        <td>
                          {formatWeekRange(weekData.weekRange.start, weekData.weekRange.end)}
                        </td>
                        <td>
                          <span className="trip-count-badge">{weekData.records.length}</span>
                        </td>
                        <td>{formatCurrency(weekData.totalBaseSalary)}</td>
                        <td className="text-success">{formatCurrency(weekData.totalBonuses)}</td>
                        <td className="text-danger">{formatCurrency(weekData.totalDeductions)}</td>
                        <td className="net-salary">{formatCurrency(weekData.totalNetSalary)}</td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="edit-button small"
                              onClick={() => handleViewPayslip(weekKey)}
                            >
                              View Payslip
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
      </main>

      {/* Payslip Modal */}
      {showPayslipModal && selectedWeek && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>
                Weekly Payslip - {groupedPayroll[selectedWeek]?.weekLabel}
                <br />
                <small>{user?.firstName} {user?.lastName}</small>
              </h3>
              <button 
                className="modal-close"
                onClick={handleClosePayslip}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="payslip-container">
                <div className="payslip-header">
                  <div className="payslip-company">MJJ FREIGHT CARGO FORWARDING</div>
                  <div className="payslip-title">WEEKLY EMPLOYEE PAYSLIP</div>
                </div>
                
                {generatePayslipJSX(selectedWeek)}
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="secondary-button"
                onClick={handleClosePayslip}
              >
                Close
              </button>
              <button 
                className="secondary-button"
                onClick={printPayslip}
              >
                Print
              </button>
              <button 
                className="primary-button"
                onClick={() => generatePayslipPDF(selectedWeek)}
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;