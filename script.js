// ================= EXPENSE TRACKER SCRIPT =================
// API Configuration
const API_URL = 'https://finflow-expense-tracker-backend-production.up.railway.app/api';

let authToken = localStorage.getItem('token') || null;

// Configuration
let userId = null;
let monthlyIncome = 0;
let userCurrency = 'INR';
let currentUser = null;

// Data storage (now loaded from API)
let expenses = [];
let recurringExpenses = [];
let billReminders = [];
let splitExpenses = [];
let customCategories = [];

// Editing state variables
let editingExpenseId = null;
let editingCategoryIndex = -1;
let editingSplitExpenseId = null; // Added for split expense editing

// Currency symbols
const CURRENCY_SYMBOLS = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£'
};

// Default categories with icons
const DEFAULT_CATEGORIES = [
    { name: 'Food', icon: '🍔', color: '#4361ee' },
    { name: 'Transport', icon: '🚗', color: '#3a0ca3' },
    { name: 'Bills', icon: '📄', color: '#7209b7' },
    { name: 'Shopping', icon: '🛍️', color: '#4cc9f0' },
    { name: 'Entertainment', icon: '🎬', color: '#4cc9f0' },
    { name: 'Healthcare', icon: '🏥', color: '#560bad' },
    { name: 'Education', icon: '📚', color: '#b5179e' },
    { name: 'Other', icon: '📦', color: '#480ca8' }
];

// Theme management
let currentTheme = localStorage.getItem('theme') || 'light';

// Chart instances
let trendChart = null;
let incomeExpenseSavingsChart = null;
let monthlyTrendChart = null;
let categoryChart = null;
let detailedCategoryChart = null;

/* ======================
   API HELPER FUNCTIONS
====================== */
async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (authToken) {
        defaultOptions.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const config = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function loadUserData() {
    try {
        const data = await apiRequest('/auth/me');
        if (data.success) {
            currentUser = data.user;
            userId = data.user.id;
            monthlyIncome = data.user.monthlyIncome || 0;
            userCurrency = data.user.currency || 'INR';
            return true;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        // Redirect to login if token is invalid
        if (error.message.includes('Token') || error.message.includes('authorization')) {
            window.location.href = 'login.html';
        }
        return false;
    }
}

async function loadExpensesFromAPI() {
    try {
        const data = await apiRequest('/expenses');
        if (data.success) {
            expenses = data.expenses;
        }
    } catch (error) {
        console.error('Error loading expenses:', error);
        showNotification('Failed to load expenses', 'error');
    }
}

async function loadRecurringExpensesFromAPI() {
    try {
        const data = await apiRequest('/recurring');
        if (data.success) {
            recurringExpenses = data.recurringExpenses;
        }
    } catch (error) {
        console.error('Error loading recurring expenses:', error);
        showNotification('Failed to load recurring expenses', 'error');
    }
}

async function loadBillRemindersFromAPI() {
    try {
        const data = await apiRequest('/bills');
        if (data.success) {
            billReminders = data.bills;
        }
    } catch (error) {
        console.error('Error loading bill reminders:', error);
        showNotification('Failed to load bill reminders', 'error');
    }
}

async function loadSplitExpensesFromAPI() {
    try {
        const data = await apiRequest('/split');
        if (data.success) {
            splitExpenses = data.splitExpenses;
        }
    } catch (error) {
        console.error('Error loading split expenses:', error);
        showNotification('Failed to load split expenses', 'error');
    }
}

async function loadCategoriesFromAPI() {
    try {
        const data = await apiRequest('/categories');
        if (data.success) {
            customCategories = data.categories;
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showNotification('Failed to load categories', 'error');
    }
}

/* ======================
   INITIALIZATION
====================== */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Expense Tracker Initialized');
    
    // Check if user is authenticated
    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }
    
    // Apply theme
    applyTheme();
    
    // Set current date
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
    });
    
    // Set expense date to today
    document.getElementById('expenseDate').valueAsDate = now;
    
    // Load user data first
    const userLoaded = await loadUserData();
    if (!userLoaded) {
        return;
    }
    
    // Initialize currency
    document.getElementById('currencySelector').value = userCurrency;
    updateCurrencyDisplay();
    
    // Update user display
    if (currentUser) {
        document.getElementById('username').innerHTML = `Welcome back, <span class="text-primary">${currentUser.name}</span>`;
        document.getElementById('totalIncome').textContent = formatCurrency(monthlyIncome);
    }
    
    // Initialize categories
    await loadCategoriesFromAPI();
    initializeCategories();
    
    // Load all data from API
    await Promise.all([
        loadExpensesFromAPI(),
        loadRecurringExpensesFromAPI(),
        loadBillRemindersFromAPI(),
        loadSplitExpensesFromAPI()
    ]);
    
    // Load initial data
    updateAllDisplays();
    
    // Initialize analytics
    loadAnalytics();
    
    // Initialize filters
    initializeFilters();
    
    // Add event listeners for category dropdowns
    setupCategoryDropdownListeners();
    
    console.log('All functions loaded successfully');
});

/* ======================
   SETUP CATEGORY DROPDOWN LISTENERS
====================== */
function setupCategoryDropdownListeners() {
    const dropdownIds = ['category', 'recurringCategory', 'billCategory', 'splitCategory'];
    
    dropdownIds.forEach(id => {
        const dropdown = document.getElementById(id);
        if (dropdown) {
            dropdown.addEventListener('change', function() {
                if (this.value === '__add_new__') {
                    this.dataset.previousValue = this.value;
                    showAddCategoryModal();
                    setTimeout(() => {
                        this.value = this.dataset.originalValue || '';
                    }, 100);
                } else {
                    this.dataset.originalValue = this.value;
                }
            });
        }
    });
}

/* ======================
   BASIC UI FUNCTIONS
====================== */
function showSection(id) {
    // Hide all sections
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show selected section
    const section = document.getElementById(id);
    if (section) {
        section.classList.remove('hidden');
    }
    
    // Update active button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const btnIndex = {
        'dashboard': 0,
        'expenses': 1,
        'analytics': 2,
        'recurring': 3,
        'bills': 4,
        'split': 5
    }[id];
    
    const navButtons = document.querySelectorAll('.nav-btn');
    if (navButtons[btnIndex]) {
        navButtons[btnIndex].classList.add('active');
    }
    
    // Load data for the section
    switch(id) {
        case 'dashboard':
            loadExpenses();
            updateDashboard();
            break;
        case 'expenses':
            loadExpenses();
            break;
        case 'analytics':
            setTimeout(() => {
                loadAnalytics();
                updateChartSizes();
            }, 100);
            break;
        case 'recurring':
            updateRecurringExpensesDisplay();
            break;
        case 'bills':
            updateBillRemindersDisplay();
            updateBillCalendar();
            break;
        case 'split':
            updateSplitExpensesDisplay();
            break;
    }
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    
    const themeIcon = document.getElementById('themeIcon');
    themeIcon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    
    showNotification(`${currentTheme === 'light' ? 'Light' : 'Dark'} mode enabled`, 'info');
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

async function changeCurrency(currency) {
    try {
        const data = await apiRequest('/user/profile', {
            method: 'PUT',
            body: JSON.stringify({ currency })
        });
        
        if (data.success) {
            userCurrency = currency;
            updateCurrencyDisplay();
            showNotification(`Currency changed to ${currency}`, 'success');
            updateAllDisplays();
        }
    } catch (error) {
        showNotification('Failed to update currency', 'error');
    }
}

function updateCurrencyDisplay() {
    const symbol = CURRENCY_SYMBOLS[userCurrency];
    document.querySelectorAll('#currencySymbol').forEach(el => {
        el.textContent = symbol;
    });
}

function formatCurrency(amount) {
    if (isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/* ======================
   USER MANAGEMENT
====================== */
function toggleProfile() {
    const modal = document.getElementById('profileModal');
    const isHidden = modal.classList.contains('hidden');
    
    if (isHidden && currentUser) {
        document.getElementById('profileName').value = currentUser.name || '';
        document.getElementById('profileIncome').value = currentUser.monthlyIncome || '';
        document.getElementById('profileCurrency').value = currentUser.currency || 'INR';
        
        // Show email
        const emailDisplay = document.getElementById('profileEmail');
        if (emailDisplay) {
            emailDisplay.textContent = currentUser.email || '';
        }
    }
    
    modal.classList.toggle('hidden');
}

async function saveProfile() {
    const name = document.getElementById('profileName').value.trim();
    const income = document.getElementById('profileIncome').value;
    const currency = document.getElementById('profileCurrency').value;

    if (!name || !income) {
        showNotification('Please enter name and income', 'error');
        return;
    }

    try {
        const data = await apiRequest('/user/profile', {
            method: 'PUT',
            body: JSON.stringify({
                name,
                monthlyIncome: Number(income),
                currency
            })
        });

        if (data.success) {
            currentUser = data.user;
            monthlyIncome = data.user.monthlyIncome;
            userCurrency = data.user.currency;

            document.getElementById('username').innerHTML = `Welcome back, <span class="text-primary">${data.user.name}</span>`;
            document.getElementById('totalIncome').textContent = formatCurrency(monthlyIncome);
            document.getElementById('currencySelector').value = userCurrency;

            updateCurrencyDisplay();
            updateAllDisplays();
            toggleProfile();
            showNotification('Profile updated successfully', 'success');
        }
    } catch (error) {
        showNotification('Failed to update profile', 'error');
    }
}

async function deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently lost.')) {
        try {
            const data = await apiRequest('/user/delete', {
                method: 'DELETE'
            });
            
            if (data.success) {
                showNotification('Account deleted successfully', 'success');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            }
        } catch (error) {
            console.error('Delete account error:', error);
            showNotification(error.message || 'Failed to delete account', 'error');
        }
    }
}

/* ======================
   EXPENSE MANAGEMENT
====================== */
async function addExpense() {
    const description = document.getElementById('title').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const date = document.getElementById('expenseDate').value;

    if (!description || !amount || !category || !date) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const expenseData = {
            description,
            amount,
            category,
            date,
            type: 'expense',
            paymentMethod: 'cash'
        };

        // Check if we're updating an existing expense
        if (editingExpenseId) {
            const data = await apiRequest(`/expenses/${editingExpenseId}`, {
                method: 'PUT',
                body: JSON.stringify(expenseData)
            });

            if (data.success) {
                const index = expenses.findIndex(e => e._id === editingExpenseId);
                if (index !== -1) {
                    expenses[index] = data.expense;
                }
                showNotification(data.message, 'success');
            }
        } else {
            const data = await apiRequest('/expenses', {
                method: 'POST',
                body: JSON.stringify(expenseData)
            });

            if (data.success) {
                expenses.push(data.expense);
                showNotification(data.message, 'success');
            }
        }
        
        // Reset form
        document.getElementById('title').value = '';
        document.getElementById('amount').value = '';
        document.getElementById('category').value = '';
        document.getElementById('expenseDate').valueAsDate = new Date();
        
        // Reset button
        const addButton = document.querySelector('.btn-add');
        addButton.innerHTML = '<i class="fas fa-plus-circle"></i> Add Expense';
        addButton.onclick = addExpense;
        
        editingExpenseId = null;
        updateAllDisplays();
    } catch (error) {
        console.error('Add expense error:', error);
        showNotification(error.message || 'Failed to add expense', 'error');
    }
}

function loadExpenses() {
    const container = document.getElementById('expenseList');
    if (!container) return;

    // Calculate total
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyExpenses = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
    });
    
    const total = monthlyExpenses.reduce((sum, e) => {
        return e.type === 'income' ? sum + e.amount : sum - e.amount;
    }, 0);
    
    // Update total display
    const expenseTotalEl = document.getElementById('expenseTotal');
    if (expenseTotalEl) {
        expenseTotalEl.innerHTML = `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(Math.abs(total))}`;
    }

    if (expenses.length === 0) {
        container.innerHTML = '<div class="empty-state">No expenses added yet</div>';
        return;
    }

    const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const html = `
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${sortedExpenses.map(expense => {
                    const categoryInfo = getAllCategories().find(c => c.name === expense.category) || DEFAULT_CATEGORIES[7];
                    return `
                        <tr>
                            <td>${expense.description}</td>
                            <td><span class="badge">${categoryInfo.icon} ${expense.category}</span></td>
                            <td>${formatDate(expense.date)}</td>
                            <td><span class="badge ${expense.type === 'income' ? 'badge-success' : 'badge-danger'}">${expense.type}</span></td>
                            <td class="${expense.type === 'income' ? 'text-success' : 'text-danger'}">
                                ${expense.type === 'income' ? '+' : '-'}${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(expense.amount)}
                            </td>
                            <td>
                                <button class="btn-icon" onclick="editExpense('${expense._id}')" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon delete" onclick="deleteExpense('${expense._id}')" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
        const data = await apiRequest(`/expenses/${id}`, {
            method: 'DELETE'
        });

        if (data.success) {
            expenses = expenses.filter(e => e._id !== id);
            showNotification(data.message, 'success');
            updateAllDisplays();
        }
    } catch (error) {
        showNotification('Failed to delete expense', 'error');
    }
}

function editExpense(id) {
    const expense = expenses.find(e => e._id === id);
    if (!expense) {
        showNotification('Expense not found', 'error');
        return;
    }

    // Fill form with expense data
    document.getElementById('title').value = expense.description;
    document.getElementById('amount').value = expense.amount;
    document.getElementById('category').value = expense.category;
    
    // Format date properly
    const date = new Date(expense.date);
    const formattedDate = date.toISOString().split('T')[0];
    document.getElementById('expenseDate').value = formattedDate;
    
    // Change button to update mode
    const addButton = document.querySelector('.btn-add');
    addButton.innerHTML = '<i class="fas fa-save"></i> Update Expense';
    
    // Set editing expense ID
    editingExpenseId = id;
    
    // Scroll to form
    showSection('expenses');
    document.querySelector('.add-expense-card').scrollIntoView({ behavior: 'smooth' });
    
    showNotification('Edit expense details and click Update', 'info');
}

/* ======================
   DASHBOARD FUNCTIONS
====================== */
function updateDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyExpenses = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return e.type === 'expense' && 
               expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
    });

    const monthlyIncomeTransactions = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return e.type === 'income' && 
               expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
    });

    const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalMonthlyIncome = monthlyIncomeTransactions.reduce((sum, e) => sum + e.amount, 0);
    const actualIncome = monthlyIncome > 0 ? monthlyIncome : totalMonthlyIncome;
    const savings = actualIncome - totalExpenses;
    const savingsRate = actualIncome > 0 ? ((savings / actualIncome) * 100) : 0;

    // Update dashboard stats with correct IDs
    const totalExpenseEl = document.getElementById('totalExpense');
    const balanceEl = document.getElementById('balance');
    const savingsRateEl = document.getElementById('savingsRate');

    if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(totalExpenses);
    if (balanceEl) balanceEl.textContent = formatCurrency(savings);
    if (savingsRateEl) savingsRateEl.textContent = `${savingsRate.toFixed(1)}%`;

    updateRecentTransactions();
    updateCategoryBreakdown();
    updateUpcomingBills();
}

function updateRecentTransactions() {
    const container = document.getElementById('recentExpenseList');
    if (!container) return;

    const recent = [...expenses]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state">No recent transactions</div>';
        return;
    }

    const html = recent.map(expense => {
        const categoryInfo = getAllCategories().find(c => c.name === expense.category) || DEFAULT_CATEGORIES[7];
        return `
            <div class="transaction-item">
                <div class="transaction-icon" style="background: ${categoryInfo.color}20; color: ${categoryInfo.color}">
                    ${categoryInfo.icon}
                </div>
                <div class="transaction-details">
                    <div class="transaction-name">${expense.description}</div>
                    <div class="transaction-date">${formatDate(expense.date)}</div>
                </div>
                <div class="transaction-amount ${expense.type === 'income' ? 'text-success' : 'text-danger'}">
                    ${expense.type === 'income' ? '+' : '-'}${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(expense.amount)}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function updateCategoryBreakdown() {
    const container = document.getElementById('categoryBreakdown');
    if (!container) {
        console.log('categoryBreakdown container not found - skipping');
        return;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyExpenses = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return e.type === 'expense' && 
               expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
    });

    const categoryTotals = {};
    monthlyExpenses.forEach(expense => {
        if (!categoryTotals[expense.category]) {
            categoryTotals[expense.category] = 0;
        }
        categoryTotals[expense.category] += expense.amount;
    });

    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (sortedCategories.length === 0) {
        container.innerHTML = '<div class="empty-state">No expenses this month</div>';
        return;
    }

    const totalExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

    const html = sortedCategories.map(([category, amount]) => {
        const categoryInfo = getAllCategories().find(c => c.name === category) || DEFAULT_CATEGORIES[7];
        const percentage = (amount / totalExpenses) * 100;
        
        return `
            <div class="category-breakdown-item">
                <div class="category-breakdown-header">
                    <span class="category-icon">${categoryInfo.icon}</span>
                    <span class="category-name">${category}</span>
                    <span class="category-amount">${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(amount)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%; background: ${categoryInfo.color}"></div>
                </div>
                <div class="category-percentage">${percentage.toFixed(1)}%</div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function updateUpcomingBills() {
    const container = document.getElementById('upcomingBills');
    if (!container) {
        console.log('upcomingBills container not found - skipping');
        return;
    }

    const now = new Date();
    const upcoming = billReminders
        .filter(bill => !bill.isPaid && new Date(bill.dueDate) >= now)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 3);

    if (upcoming.length === 0) {
        container.innerHTML = '<div class="empty-state">No upcoming bills</div>';
        return;
    }

    const html = upcoming.map(bill => {
        const dueDate = new Date(bill.dueDate);
        const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        const isOverdue = daysUntil < 0;
        const isDueSoon = daysUntil <= bill.reminderDays && daysUntil >= 0;

        return `
            <div class="bill-item ${isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : ''}">
                <div class="bill-info">
                    <div class="bill-name">${bill.billName}</div>
                    <div class="bill-date">${formatDate(bill.dueDate)}</div>
                </div>
                <div class="bill-amount">
                    ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(bill.amount)}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/* ======================
   ANALYTICS FUNCTIONS
====================== */
function loadAnalytics() {
    updateExpenseStats();
    updateTrendChart();
    updateIncomeExpenseSavingsChart();
    updateMonthlyTrendChart();
    updateCategoryChart();
    updateDetailedCategoryBreakdown();
}

function updateExpenseStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyExpenses = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return e.type === 'expense' && 
               expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
    });

    const monthlyIncomeTransactions = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return e.type === 'income' && 
               expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
    });

    const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalMonthlyIncome = monthlyIncomeTransactions.reduce((sum, e) => sum + e.amount, 0);
    const actualIncome = monthlyIncome > 0 ? monthlyIncome : totalMonthlyIncome;
    const savings = actualIncome - totalExpenses;

    const statsExpensesEl = document.getElementById('statsExpenses');
    const statsIncomeEl = document.getElementById('statsIncome');
    const statsSavingsEl = document.getElementById('statsSavings');
    const statsAverageEl = document.getElementById('statsAverage');

    if (statsExpensesEl) statsExpensesEl.textContent = `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(totalExpenses)}`;
    if (statsIncomeEl) statsIncomeEl.textContent = `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(actualIncome)}`;
    if (statsSavingsEl) statsSavingsEl.textContent = `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(savings)}`;
    
    const avgExpense = monthlyExpenses.length > 0 ? totalExpenses / monthlyExpenses.length : 0;
    if (statsAverageEl) statsAverageEl.textContent = `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(avgExpense)}`;
}

function updateTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    if (trendChart) {
        trendChart.destroy();
    }

    // Get last 6 months data
    const last6Months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push(date);
    }

    const monthlyData = last6Months.map(date => {
        const month = date.getMonth();
        const year = date.getFullYear();
        
        // Calculate expenses for the month
        const monthExpenses = expenses.filter(e => {
            const expenseDate = new Date(e.date);
            return e.type === 'expense' &&
                   expenseDate.getMonth() === month &&
                   expenseDate.getFullYear() === year;
        }).reduce((sum, e) => sum + e.amount, 0);

        // Calculate income for the month
        const monthIncome = expenses.filter(e => {
            const expenseDate = new Date(e.date);
            return e.type === 'income' &&
                   expenseDate.getMonth() === month &&
                   expenseDate.getFullYear() === year;
        }).reduce((sum, e) => sum + e.amount, 0);

        // Use actual income from transactions or user's monthly income
        const actualIncome = monthIncome > 0 ? monthIncome : (month === now.getMonth() && year === now.getFullYear() ? monthlyIncome : monthlyIncome);
        const savings = Math.max(0, actualIncome - monthExpenses);

        return {
            income: actualIncome,
            expenses: monthExpenses,
            savings: savings
        };
    });

    trendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: last6Months.map(d => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })),
            datasets: [
                {
                    label: 'Income',
                    data: monthlyData.map(d => d.income),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 2
                },
                {
                    label: 'Expenses',
                    data: monthlyData.map(d => d.expenses),
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 2
                },
                {
                    label: 'Savings',
                    data: monthlyData.map(d => d.savings),
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + CURRENCY_SYMBOLS[userCurrency] + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return CURRENCY_SYMBOLS[userCurrency] + formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function updateIncomeExpenseSavingsChart() {
    const canvas = document.getElementById('incomeExpenseChart');
    if (!canvas) {
        console.log('incomeExpenseChart canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    
    if (incomeExpenseSavingsChart) {
        incomeExpenseSavingsChart.destroy();
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyExpenses = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return e.type === 'expense' && 
               expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
    });

    const monthlyIncomeTransactions = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return e.type === 'income' && 
               expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
    });

    const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalMonthlyIncome = monthlyIncomeTransactions.reduce((sum, e) => sum + e.amount, 0);
    const actualIncome = monthlyIncome > 0 ? monthlyIncome : totalMonthlyIncome;
    const savings = actualIncome - totalExpenses;

    incomeExpenseSavingsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Income', 'Expenses', 'Savings'],
            datasets: [{
                data: [actualIncome, totalExpenses, Math.max(0, savings)],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(59, 130, 246, 0.8)'
                ],
                borderColor: [
                    'rgb(16, 185, 129)',
                    'rgb(239, 68, 68)',
                    'rgb(59, 130, 246)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return `${label}: ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(value)}`;
                        }
                    }
                }
            }
        }
    });
}

function updateMonthlyTrendChart() {
    const canvas = document.getElementById('monthlyTrendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    if (monthlyTrendChart) {
        monthlyTrendChart.destroy();
    }

    const now = new Date();
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push(date);
    }

    const monthlyData = last6Months.map(date => {
        const month = date.getMonth();
        const year = date.getFullYear();
        
        const monthExpenses = expenses.filter(e => {
            const expenseDate = new Date(e.date);
            return e.type === 'expense' &&
                   expenseDate.getMonth() === month &&
                   expenseDate.getFullYear() === year;
        }).reduce((sum, e) => sum + e.amount, 0);

        const monthIncome = expenses.filter(e => {
            const expenseDate = new Date(e.date);
            return e.type === 'income' &&
                   expenseDate.getMonth() === month &&
                   expenseDate.getFullYear() === year;
        }).reduce((sum, e) => sum + e.amount, 0);

        return {
            expenses: monthExpenses,
            income: monthIncome || monthlyIncome
        };
    });

    monthlyTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last6Months.map(d => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })),
            datasets: [
                {
                    label: 'Income',
                    data: monthlyData.map(d => d.income),
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Expenses',
                    data: monthlyData.map(d => d.expenses),
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return CURRENCY_SYMBOLS[userCurrency] + formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function updateCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    if (categoryChart) {
        categoryChart.destroy();
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyExpenses = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return e.type === 'expense' && 
               expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
    });

    const categoryTotals = {};
    monthlyExpenses.forEach(expense => {
        if (!categoryTotals[expense.category]) {
            categoryTotals[expense.category] = 0;
        }
        categoryTotals[expense.category] += expense.amount;
    });

    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1]);

    const labels = sortedCategories.map(([category]) => category);
    const data = sortedCategories.map(([, amount]) => amount);
    const colors = sortedCategories.map(([category]) => {
        const categoryInfo = getAllCategories().find(c => c.name === category) || DEFAULT_CATEGORIES[7];
        return categoryInfo.color;
    });

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updateDetailedCategoryBreakdown() {
    const canvas = document.getElementById('detailedCategoryChart');
    if (!canvas) {
        console.log('detailedCategoryChart canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    
    if (detailedCategoryChart) {
        detailedCategoryChart.destroy();
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyExpenses = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return e.type === 'expense' && 
               expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
    });

    const categoryData = {};
    monthlyExpenses.forEach(expense => {
        if (!categoryData[expense.category]) {
            categoryData[expense.category] = {
                total: 0,
                count: 0
            };
        }
        categoryData[expense.category].total += expense.amount;
        categoryData[expense.category].count++;
    });

    const sortedCategories = Object.entries(categoryData)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 8); // Top 8 categories

    if (sortedCategories.length === 0) {
        detailedCategoryChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['No Data'],
                datasets: [{
                    label: 'Expenses',
                    data: [0],
                    backgroundColor: 'rgba(67, 97, 238, 0.8)'
                }]
            }
        });
        return;
    }

    const labels = sortedCategories.map(([category]) => category);
    const data = sortedCategories.map(([, data]) => data.total);
    const colors = sortedCategories.map(([category]) => {
        const categoryInfo = getAllCategories().find(c => c.name === category) || DEFAULT_CATEGORIES[7];
        return categoryInfo.color;
    });

    detailedCategoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Amount Spent',
                data: data,
                backgroundColor: colors.map(c => c + 'CC'),
                borderColor: colors,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y || 0;
                            return `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(value)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return CURRENCY_SYMBOLS[userCurrency] + formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

/* ======================
   CHART RESIZING FUNCTION
====================== */
function updateChartSizes() {
    const charts = [
        trendChart,
        incomeExpenseSavingsChart,
        monthlyTrendChart,
        categoryChart,
        detailedCategoryChart
    ];
    
    charts.forEach(chart => {
        if (chart) {
            chart.resize();
            chart.update();
        }
    });
}

/* ======================
   CATEGORY MANAGEMENT
====================== */
function initializeCategories() {
    updateCategoryDropdowns();
    updateCategoryManagement();
}

function getAllCategories() {
    return [...DEFAULT_CATEGORIES, ...customCategories];
}

function updateCategoryDropdowns() {
    const dropdowns = ['category', 'recurringCategory', 'billCategory', 'splitCategory'];
    const allCategories = getAllCategories();

    dropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        const currentValue = dropdown.value;
        
        dropdown.innerHTML = `
            <option value="">Select Category</option>
            ${allCategories.map(cat => 
                `<option value="${cat.name}">${cat.icon} ${cat.name}</option>`
            ).join('')}
            <option value="__add_new__" class="add-category-option">➕ Add New Category</option>
        `;

        if (currentValue && currentValue !== '__add_new__') {
            dropdown.value = currentValue;
        }
    });
}

function showAddCategoryModal() {
    editingCategoryIndex = -1;
    document.getElementById('newCategoryName').value = '';
    document.getElementById('newCategoryIcon').value = '📝';
    document.getElementById('newCategoryColor').value = '#FF6B6B';
    document.getElementById('addCategoryModal').classList.remove('hidden');
}

function closeAddCategoryModal() {
    document.getElementById('addCategoryModal').classList.add('hidden');
    editingCategoryIndex = -1;
}

function showManageCategoriesModal() {
    updateCategoryManagement();
    updateDefaultCategoriesDisplay();
    document.getElementById('manageCategoriesModal').classList.remove('hidden');
}

function closeManageCategoriesModal() {
    document.getElementById('manageCategoriesModal').classList.add('hidden');
}

async function saveNewCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    const icon = document.getElementById('newCategoryIcon').value;
    const color = document.getElementById('newCategoryColor').value;

    if (!name) {
        showNotification('Please enter a category name', 'error');
        return;
    }

    try {
        const categoryData = { name, icon, color };

        if (editingCategoryIndex >= 0) {
            // Update existing category
            const categoryId = customCategories[editingCategoryIndex]._id;
            const data = await apiRequest(`/categories/${categoryId}`, {
                method: 'PUT',
                body: JSON.stringify(categoryData)
            });

            if (data.success) {
                customCategories[editingCategoryIndex] = data.category;
                showNotification(data.message, 'success');
            }
        } else {
            // Create new category
            const data = await apiRequest('/categories', {
                method: 'POST',
                body: JSON.stringify(categoryData)
            });

            if (data.success) {
                customCategories.push(data.category);
                showNotification(data.message, 'success');
            }
        }

        closeAddCategoryModal();
        updateCategoryDropdowns();
        updateCategoryManagement();
    } catch (error) {
        console.error('Save category error:', error);
        showNotification(error.message || 'Failed to save category', 'error');
    }
}

function updateDefaultCategoriesDisplay() {
    const container = document.getElementById('defaultCategoriesList');
    if (!container) return;

    const html = DEFAULT_CATEGORIES.map(category => {
        const categoryExpenses = expenses.filter(e => e.category === category.name);
        const count = categoryExpenses.length;

        return `
            <div class="category-item">
                <span class="category-icon" style="color: ${category.color}">${category.icon}</span>
                <div class="category-info">
                    <div class="category-name">${category.name}</div>
                    <div class="category-count">${count} expense${count !== 1 ? 's' : ''}</div>
                </div>
                <span class="category-badge">Default</span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function updateCategoryManagement() {
    const container = document.getElementById('customCategoriesList');
    if (!container) return;

    if (customCategories.length === 0) {
        container.innerHTML = '<div class="empty-state">No custom categories yet</div>';
        return;
    }

    const html = customCategories.map((category, index) => {
        const categoryExpenses = expenses.filter(e => e.category === category.name);
        const count = categoryExpenses.length;

        return `
            <div class="category-item">
                <span class="category-icon" style="color: ${category.color}">${category.icon}</span>
                <div class="category-info">
                    <div class="category-name">${category.name}</div>
                    <div class="category-count">${count} expense${count !== 1 ? 's' : ''}</div>
                </div>
                <div class="category-actions">
                    <button class="btn-icon edit" onclick="editCategory(${index})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteCategory('${category._id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function editCategory(index) {
    editingCategoryIndex = index;
    const category = customCategories[index];
    
    document.getElementById('newCategoryName').value = category.name;
    document.getElementById('newCategoryIcon').value = category.icon;
    document.getElementById('newCategoryColor').value = category.color;
    document.getElementById('addCategoryModal').classList.remove('hidden');
}

async function deleteCategory(id) {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
        const data = await apiRequest(`/categories/${id}`, {
            method: 'DELETE'
        });

        if (data.success) {
            customCategories = customCategories.filter(c => c._id !== id);
            showNotification(data.message, 'success');
            updateCategoryDropdowns();
            updateCategoryManagement();
        }
    } catch (error) {
        console.error('Delete category error:', error);
        showNotification(error.message || 'Failed to delete category', 'error');
    }
}

function manageCategories() {
    showManageCategoriesModal();
}

/* ======================
   RECURRING EXPENSES
====================== */
function showAddRecurringModal() {
    const modal = document.getElementById('addRecurringModal');
    if (modal) modal.classList.remove('hidden');
}

function closeAddRecurringModal() {
    const modal = document.getElementById('addRecurringModal');
    if (modal) modal.classList.add('hidden');
}

async function addRecurringExpense() {
    const description = document.getElementById('recurringTitle').value.trim();
    const amount = parseFloat(document.getElementById('recurringAmount').value);
    const category = document.getElementById('recurringCategory').value;
    const frequency = document.getElementById('recurringFrequency').value;
    const startDate = document.getElementById('recurringStartDate').value;

    if (!description || !amount || !category || !frequency || !startDate) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const recurringData = {
            description,
            amount,
            category,
            frequency,
            startDate
        };

        const data = await apiRequest('/recurring', {
            method: 'POST',
            body: JSON.stringify(recurringData)
        });

        if (data.success) {
            recurringExpenses.push(data.recurringExpense);
            
            // Reset form
            document.getElementById('recurringTitle').value = '';
            document.getElementById('recurringAmount').value = '';
            document.getElementById('recurringCategory').value = '';
            document.getElementById('recurringFrequency').value = '';
            document.getElementById('recurringStartDate').value = '';
            
            closeAddRecurringModal();
            showNotification(data.message, 'success');
            updateRecurringExpensesDisplay();
        }
    } catch (error) {
        console.error('Add recurring expense error:', error);
        showNotification(error.message || 'Failed to add recurring expense', 'error');
    }
}

// Alias for HTML compatibility
async function saveRecurringExpense() {
    await addRecurringExpense();
}

function updateRecurringExpensesDisplay() {
    const container = document.getElementById('recurringGrid');
    if (!container) {
        console.log('recurringGrid container not found');
        return;
    }

    if (recurringExpenses.length === 0) {
        container.innerHTML = '<div class="empty-state">No recurring expenses added yet</div>';
        return;
    }

    const html = recurringExpenses.map(expense => {
        const categoryInfo = getAllCategories().find(c => c.name === expense.category) || DEFAULT_CATEGORIES[7];
        const nextDue = new Date(expense.startDate);
        const now = new Date();
        const daysUntil = Math.ceil((nextDue - now) / (1000 * 60 * 60 * 24));
        
        // Calculate next due date
        let frequencyText = '';
        let nextDueDate = new Date(nextDue);
        
        if (expense.frequency === 'monthly') {
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            frequencyText = 'MONTHLY';
        } else if (expense.frequency === 'weekly') {
            nextDueDate.setDate(nextDueDate.getDate() + 7);
            frequencyText = 'WEEKLY';
        } else if (expense.frequency === 'yearly') {
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
            frequencyText = 'YEARLY';
        }
        
        // Show "Deactivated" instead of due date if not active
        const statusText = expense.isActive ? 
            `Due in ${daysUntil > 0 ? daysUntil : 0} days` : 
            'Deactivated';
        
        return `
            <div class="recurring-card ${expense.isActive ? 'active' : 'inactive'}">
                <div class="recurring-header">
                    <h3>${expense.description}</h3>
                    <span class="recurring-badge ${expense.frequency}">${frequencyText}</span>
                </div>
                <div class="recurring-content">
                    <div class="recurring-amount">
                        <span class="amount-label">Amount:</span>
                        <span class="amount-value">${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(expense.amount)}</span>
                    </div>
                    <div class="recurring-details">
                        <div class="detail-item">
                            <i class="fas fa-calendar"></i>
                            <span>${expense.isActive ? 'Next Due:' : 'Status:'} ${expense.isActive ? formatDate(nextDueDate.toISOString()) : 'Deactivated'}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-redo"></i>
                            <span>Frequency: ${expense.frequency}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-tag"></i>
                            <span>Category: ${expense.category}</span>
                        </div>
                    </div>
                    <div class="due-status ${expense.isActive ? '' : 'text-danger'}">
                        ${statusText}
                    </div>
                </div>
                <div class="recurring-actions">
                    <button class="btn-icon ${expense.isActive ? 'pause' : 'play'}" onclick="toggleRecurringExpense('${expense._id}')" title="${expense.isActive ? 'Deactivate' : 'Activate'}">
                        <i class="fas fa-${expense.isActive ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteRecurringExpense('${expense._id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

async function toggleRecurringExpense(id) {
    try {
        const data = await apiRequest(`/recurring/${id}/toggle`, {
            method: 'PATCH'
        });

        if (data.success) {
            const index = recurringExpenses.findIndex(e => e._id === id);
            if (index !== -1) {
                recurringExpenses[index] = data.recurringExpense;
            }
            showNotification(data.message, 'success');
            updateRecurringExpensesDisplay();
        }
    } catch (error) {
        showNotification('Failed to toggle recurring expense', 'error');
    }
}

async function deleteRecurringExpense(id) {
    if (!confirm('Are you sure you want to delete this recurring expense?')) return;

    try {
        const data = await apiRequest(`/recurring/${id}`, {
            method: 'DELETE'
        });

        if (data.success) {
            recurringExpenses = recurringExpenses.filter(e => e._id !== id);
            showNotification(data.message, 'success');
            updateRecurringExpensesDisplay();
        }
    } catch (error) {
        showNotification('Failed to delete recurring expense', 'error');
    }
}

/* ======================
   BILL REMINDERS
====================== */
function showAddBillModal() {
    const modal = document.getElementById('addBillModal');
    if (modal) modal.classList.remove('hidden');
}

function closeAddBillModal() {
    const modal = document.getElementById('addBillModal');
    if (modal) modal.classList.add('hidden');
}

async function addBillReminder() {
    const billName = document.getElementById('billTitle').value.trim();
    const amount = parseFloat(document.getElementById('billAmount').value);
    const category = document.getElementById('billCategory').value;
    const dueDate = document.getElementById('billDueDate').value;
    const reminderDays = parseInt(document.getElementById('billReminderDays').value) || 3;

    if (!billName || !amount || !category || !dueDate) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const billData = {
            billName,
            amount,
            category,
            dueDate,
            reminderDays
        };

        const data = await apiRequest('/bills', {
            method: 'POST',
            body: JSON.stringify(billData)
        });

        if (data.success) {
            billReminders.push(data.bill);
            
            // Reset form
            document.getElementById('billTitle').value = '';
            document.getElementById('billAmount').value = '';
            document.getElementById('billCategory').value = '';
            document.getElementById('billDueDate').value = '';
            
            closeAddBillModal();
            showNotification(data.message, 'success');
            updateBillRemindersDisplay();
            updateBillCalendar();
        }
    } catch (error) {
        console.error('Add bill error:', error);
        showNotification(error.message || 'Failed to add bill reminder', 'error');
    }
}

// Alias for HTML compatibility
async function saveBillReminder() {
    await addBillReminder();
}

function updateBillRemindersDisplay() {
    const container = document.getElementById('remindersContainer');
    if (!container) {
        console.log('remindersContainer not found');
        return;
    }

    if (billReminders.length === 0) {
        container.innerHTML = '<div class="empty-state">No bill reminders added yet</div>';
        return;
    }

    const sortedBills = [...billReminders].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    const html = sortedBills.map(bill => {
        const categoryInfo = getAllCategories().find(c => c.name === bill.category) || DEFAULT_CATEGORIES[7];
        const dueDate = new Date(bill.dueDate);
        const now = new Date();
        const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        const isOverdue = daysUntil < 0;
        const isDueSoon = daysUntil <= bill.reminderDays && daysUntil >= 0;

        return `
            <div class="bill-reminder-card ${bill.isPaid ? 'paid' : isOverdue ? 'overdue' : isDueSoon ? 'upcoming' : ''}">
                <div class="bill-header">
                    <div class="bill-title">
                        <h4>${bill.billName}</h4>
                        <span class="bill-status ${bill.isPaid ? 'paid' : isOverdue ? 'overdue' : isDueSoon ? 'upcoming' : ''}">
                            ${bill.isPaid ? 'Paid' : isOverdue ? 'Overdue' : isDueSoon ? 'Upcoming' : 'Pending'}
                        </span>
                    </div>
                    <div class="bill-amount">
                        ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(bill.amount)}
                    </div>
                </div>
                <div class="bill-details">
                    <div class="detail-row">
                        <span class="label">Due:</span>
                        <span class="value">${formatDate(bill.dueDate)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Status:</span>
                        <span class="value ${bill.isPaid ? 'text-success' : isOverdue ? 'text-danger' : 'text-warning'}">
                            ${bill.isPaid ? 'Paid' : isOverdue ? 'Overdue' : `Due in ${daysUntil} days`}
                        </span>
                    </div>
                </div>
                <div class="bill-actions">
                    ${!bill.isPaid ? `
                        <button class="btn-success btn-sm" onclick="markBillAsPaid('${bill._id}')">
                            <i class="fas fa-check"></i> Mark Paid
                        </button>
                    ` : ''}
                    <button class="btn-icon delete" onclick="deleteBillReminder('${bill._id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    updateBillCalendar();
}

async function markBillAsPaid(id) {
    try {
        const data = await apiRequest(`/bills/${id}/pay`, {
            method: 'PATCH'
        });

        if (data.success) {
            const index = billReminders.findIndex(b => b._id === id);
            if (index !== -1) {
                billReminders[index] = data.bill;
            }
            showNotification(data.message, 'success');
            updateBillRemindersDisplay();
            updateBillCalendar();
        }
    } catch (error) {
        showNotification('Failed to mark bill as paid', 'error');
    }
}

async function deleteBillReminder(id) {
    if (!confirm('Are you sure you want to delete this bill reminder?')) return;

    try {
        const data = await apiRequest(`/bills/${id}`, {
            method: 'DELETE'
        });

        if (data.success) {
            billReminders = billReminders.filter(b => b._id !== id);
            showNotification(data.message, 'success');
            updateBillRemindersDisplay();
            updateBillCalendar();
        }
    } catch (error) {
        showNotification('Failed to delete bill reminder', 'error');
    }
}

function updateBillCalendar() {
    const container = document.getElementById('billCalendar');
    if (!container) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get first day of month
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    // Get days in month
    const daysInMonth = lastDay.getDate();
    
    // Get day of week for first day (0 = Sunday, 6 = Saturday)
    const firstDayIndex = firstDay.getDay();
    
    // Get month name
    const monthName = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Update the calendar section title
    const calendarTitle = document.querySelector('.calendar-section h3');
    if (calendarTitle) {
        calendarTitle.textContent = `Bill Calendar - ${monthName}`;
    }
    
    let html = '';
    
    // Add day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });
    
    // Add empty cells for days before first day of month
    for (let i = 0; i < firstDayIndex; i++) {
        html += '<div class="calendar-day empty"></div>';
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(currentYear, currentMonth, day);
        
        // Check if any bills are due on this day
        const billsOnDay = billReminders.filter(bill => {
            const billDate = new Date(bill.dueDate);
            return !bill.isPaid && 
                   billDate.getDate() === day && 
                   billDate.getMonth() === currentMonth && 
                   billDate.getFullYear() === currentYear;
        });
        
        const isToday = day === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear();
        const hasBill = billsOnDay.length > 0;
        
        // Create tooltip for bills on this day
        let tooltip = '';
        if (hasBill) {
            const billNames = billsOnDay.map(bill => bill.billName).join(', ');
            tooltip = `title="${billNames}"`;
        }
        
        let dayClass = 'calendar-day';
        if (isToday) dayClass += ' today';
        if (hasBill) dayClass += ' has-bill';
        
        html += `
            <div class="${dayClass}" ${tooltip}>
                ${day}
                ${hasBill ? '<span class="bill-indicator"></span>' : ''}
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Add click handler to bill days
    const billDays = container.querySelectorAll('.calendar-day.has-bill');
    billDays.forEach(day => {
        day.addEventListener('click', function() {
            const dayNumber = parseInt(this.textContent);
            const billsOnDay = billReminders.filter(bill => {
                const billDate = new Date(bill.dueDate);
                return !bill.isPaid && 
                       billDate.getDate() === dayNumber && 
                       billDate.getMonth() === currentMonth && 
                       billDate.getFullYear() === currentYear;
            });
            
            if (billsOnDay.length > 0) {
                const billList = billsOnDay.map(bill => 
                    `• ${bill.billName}: ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(bill.amount)}`
                ).join('\n');
                
                alert(`Bills due on ${dayNumber}/${currentMonth + 1}/${currentYear}:\n\n${billList}`);
            }
        });
    });
}

/* ======================
   SPLIT EXPENSES
====================== */
function showSplitExpenseModal() {
    const modal = document.getElementById('splitExpenseModal');
    if (modal) modal.classList.remove('hidden');
    // Initialize split calculation
    updateSplitCalculation();
}

function closeSplitExpenseModal() {
    const modal = document.getElementById('splitExpenseModal');
    if (modal) modal.classList.add('hidden');
    
    // Reset editing state
    editingSplitExpenseId = null;
    
    // Reset form
    document.getElementById('splitTitle').value = '';
    document.getElementById('splitTotalAmount').value = '';
    document.getElementById('splitCategory').value = '';
    document.getElementById('numPeople').value = '1';
    document.getElementById('splitMethod').value = 'equal';
    
    // Reset button text
    const saveButton = document.querySelector('#splitExpenseModal .btn-primary');
    if (saveButton) {
        saveButton.innerHTML = '<i class="fas fa-save"></i> Save Split Expense';
    }
}

function updateSplitCalculation() {
    const totalAmount = parseFloat(document.getElementById('splitTotalAmount').value) || 0;
    const numPeople = parseInt(document.getElementById('numPeople').value) || 1;
    const splitMethod = document.getElementById('splitMethod').value;
    
    const container = document.getElementById('splitMembersContainer');
    let html = '';
    let summary = '';
    
    if (splitMethod === 'equal') {
        const perPerson = totalAmount / numPeople;
        
        for (let i = 0; i < numPeople; i++) {
            const isYou = i === 0;
            html += `
                <div class="split-member-row">
                    <div class="member-name">
                        ${isYou ? 'You (You)' : `Person ${i + 1}`}
                    </div>
                    <div class="member-amount">
                        ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(perPerson)}
                    </div>
                </div>
            `;
        }
        
        summary = `
            <div class="summary-total">
                <span>Total:</span>
                <span>${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(totalAmount)}</span>
            </div>
            <div class="summary-per-person">
                <span>Each person pays:</span>
                <span>${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(perPerson)}</span>
            </div>
        `;
    } else if (splitMethod === 'percentage') {
        const defaultPercentage = 100 / numPeople;
        
        for (let i = 0; i < numPeople; i++) {
            const isYou = i === 0;
            const amount = (totalAmount * defaultPercentage) / 100;
            html += `
                <div class="split-member-row">
                    <div class="member-name">
                        ${isYou ? 'You (You)' : `Person ${i + 1}`}
                    </div>
                    <div class="member-input-group">
                        <input type="number" class="percentage-input" value="${defaultPercentage.toFixed(2)}" min="0" max="100" oninput="updatePercentageSplit()" /> %
                    </div>
                    <div class="member-amount">
                        ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(amount)}
                    </div>
                </div>
            `;
        }
        
        summary = `
            <div class="summary-total">
                <span>Total:</span>
                <span>${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(totalAmount)}</span>
            </div>
        `;
    } else if (splitMethod === 'custom') {
        const defaultAmount = totalAmount / numPeople;
        
        for (let i = 0; i < numPeople; i++) {
            const isYou = i === 0;
            html += `
                <div class="split-member-row">
                    <div class="member-name">
                        ${isYou ? 'You (You)' : `Person ${i + 1}`}
                    </div>
                    <div class="member-input-group">
                        <input type="number" class="custom-amount-input" value="${defaultAmount.toFixed(2)}" min="0" oninput="updateCustomSplit()" />
                    </div>
                </div>
            `;
        }
        
        summary = `
            <div class="summary-total">
                <span>Total:</span>
                <span>${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(totalAmount)}</span>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    const summaryContainer = document.getElementById('splitSummary');
    if (summaryContainer) {
        summaryContainer.innerHTML = summary;
    }
    
    // Update calculations
    if (splitMethod === 'percentage') {
        updatePercentageSplit();
    } else if (splitMethod === 'custom') {
        updateCustomSplit();
    }
}

function updatePercentageSplit() {
    const totalAmount = parseFloat(document.getElementById('splitTotalAmount').value) || 0;
    const percentageInputs = document.querySelectorAll('.percentage-input');
    
    let totalPercentage = 0;
    percentageInputs.forEach(input => {
        totalPercentage += parseFloat(input.value) || 0;
    });
    
    // Update amounts
    percentageInputs.forEach(input => {
        const percentage = parseFloat(input.value) || 0;
        const amount = (totalAmount * percentage) / 100;
        const row = input.closest('.split-member-row');
        const amountElement = row.querySelector('.member-amount');
        if (amountElement) {
            amountElement.textContent = `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(amount)}`;
        }
    });
    
    // Update summary
    const summaryContainer = document.getElementById('splitSummary');
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="summary-total">
                <span>Total:</span>
                <span>${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(totalAmount)}</span>
            </div>
            <div class="summary-percentage">
                <span>Total Percentage:</span>
                <span class="${Math.abs(totalPercentage - 100) > 0.01 ? 'text-danger' : 'text-success'}">
                    ${totalPercentage.toFixed(2)}%
                </span>
            </div>
        `;
    }
}

function updateCustomSplit() {
    const totalAmount = parseFloat(document.getElementById('splitTotalAmount').value) || 0;
    const customInputs = document.querySelectorAll('.custom-amount-input');
    
    let totalEntered = 0;
    customInputs.forEach(input => {
        totalEntered += parseFloat(input.value) || 0;
    });
    
    // Update summary
    const summaryContainer = document.getElementById('splitSummary');
    if (summaryContainer) {
        const difference = totalAmount - totalEntered;
        summaryContainer.innerHTML = `
            <div class="summary-total">
                <span>Total:</span>
                <span>${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(totalAmount)}</span>
            </div>
            <div class="summary-entered">
                <span>Entered Total:</span>
                <span>${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(totalEntered)}</span>
            </div>
            <div class="summary-difference ${Math.abs(difference) > 0.01 ? 'text-danger' : 'text-success'}">
                <span>Difference:</span>
                <span>${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(difference)}</span>
            </div>
        `;
    }
}

async function saveSplitExpense() {
    const title = document.getElementById('splitTitle').value.trim();
    const totalAmount = parseFloat(document.getElementById('splitTotalAmount').value);
    const category = document.getElementById('splitCategory').value;
    const numPeople = parseInt(document.getElementById('numPeople').value) || 1;
    const splitMethod = document.getElementById('splitMethod').value;

    if (!title || !totalAmount || !category) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    // Calculate amounts based on split method
    const members = [];
    
    if (splitMethod === 'equal') {
        const perPerson = totalAmount / numPeople;
        for (let i = 0; i < numPeople; i++) {
            members.push({
                name: i === 0 ? 'You' : `Person ${i + 1}`,
                amount: perPerson,
                isPaid: i === 0 // You are marked as paid by default
            });
        }
    } else if (splitMethod === 'percentage') {
        const percentageInputs = document.querySelectorAll('.percentage-input');
        let totalPercentage = 0;
        
        percentageInputs.forEach((input, index) => {
            const percentage = parseFloat(input.value) || 0;
            totalPercentage += percentage;
            const amount = (totalAmount * percentage) / 100;
            members.push({
                name: index === 0 ? 'You' : `Person ${index + 1}`,
                amount: amount,
                isPaid: index === 0
            });
        });
        
        if (Math.abs(totalPercentage - 100) > 0.01) {
            showNotification('Percentages must add up to 100%', 'error');
            return;
        }
    } else if (splitMethod === 'custom') {
        const customInputs = document.querySelectorAll('.custom-amount-input');
        let totalEntered = 0;
        
        customInputs.forEach((input, index) => {
            const amount = parseFloat(input.value) || 0;
            totalEntered += amount;
            members.push({
                name: index === 0 ? 'You' : `Person ${index + 1}`,
                amount: amount,
                isPaid: index === 0
            });
        });
        
        if (Math.abs(totalEntered - totalAmount) > 0.01) {
            showNotification('Custom amounts must add up to total amount', 'error');
            return;
        }
    }

    if (members.length === 0) {
        showNotification('Please configure split correctly', 'error');
        return;
    }

    try {
        const splitData = {
            title,
            totalAmount,
            category,
            splitMethod,
            members
        };

        let data;
        
        // Check if we're updating or creating
        if (editingSplitExpenseId) {
            // Update existing split expense
            data = await apiRequest(`/split/${editingSplitExpenseId}`, {
                method: 'PUT',
                body: JSON.stringify(splitData)
            });

            if (data.success) {
                const index = splitExpenses.findIndex(e => e._id === editingSplitExpenseId);
                if (index !== -1) {
                    splitExpenses[index] = data.splitExpense;
                }
                showNotification('Split expense updated successfully', 'success');
            }
        } else {
            // Create new split expense
            data = await apiRequest('/split', {
                method: 'POST',
                body: JSON.stringify(splitData)
            });

            if (data.success) {
                splitExpenses.push(data.splitExpense);
                showNotification('Split expense added successfully', 'success');
            }
        }

        if (data.success) {
            // Reset form
            document.getElementById('splitTitle').value = '';
            document.getElementById('splitTotalAmount').value = '';
            document.getElementById('splitCategory').value = '';
            document.getElementById('numPeople').value = '1';
            document.getElementById('splitMethod').value = 'equal';
            
            // Reset editing state
            editingSplitExpenseId = null;
            
            // Reset button text
            const saveButton = document.querySelector('#splitExpenseModal .btn-primary');
            if (saveButton) {
                saveButton.innerHTML = '<i class="fas fa-save"></i> Save Split Expense';
            }
            
            closeSplitExpenseModal();
            updateSplitExpensesDisplay();
        }
    } catch (error) {
        console.error('Save split expense error:', error);
        showNotification(error.message || 'Failed to save split expense', 'error');
    }
}

function editSplitExpense(id) {
    const expense = splitExpenses.find(e => e._id === id);
    if (!expense) return;

    // Store the expense ID we're editing
    editingSplitExpenseId = id;
    
    // Fill the split expense modal with existing data
    document.getElementById('splitTitle').value = expense.title;
    document.getElementById('splitTotalAmount').value = expense.totalAmount;
    document.getElementById('splitCategory').value = expense.category;
    document.getElementById('numPeople').value = expense.members.length;
    document.getElementById('splitMethod').value = expense.splitMethod;
    
    // Show the modal
    showSplitExpenseModal();
    
    // Update the form to show existing members
    setTimeout(() => {
        updateSplitCalculation();
        
        // Pre-fill member amounts based on split method
        if (expense.splitMethod === 'equal') {
            // Already handled by updateSplitCalculation
        } else if (expense.splitMethod === 'percentage') {
            expense.members.forEach((member, index) => {
                const percentage = (member.amount / expense.totalAmount) * 100;
                const input = document.querySelectorAll('.percentage-input')[index];
                if (input) {
                    input.value = percentage.toFixed(2);
                }
            });
            updatePercentageSplit();
        } else if (expense.splitMethod === 'custom') {
            expense.members.forEach((member, index) => {
                const input = document.querySelectorAll('.custom-amount-input')[index];
                if (input) {
                    input.value = member.amount.toFixed(2);
                }
            });
            updateCustomSplit();
        }
    }, 100);
    
    // Update button text to indicate editing
    const saveButton = document.querySelector('#splitExpenseModal .btn-primary');
    if (saveButton) {
        saveButton.innerHTML = '<i class="fas fa-save"></i> Update Split Expense';
    }
    
    showNotification('Edit split expense details', 'info');
}

function updateSplitExpensesDisplay() {
    const container = document.getElementById('splitContainer');
    if (!container) {
        console.log('splitContainer not found');
        return;
    }

    if (splitExpenses.length === 0) {
        container.innerHTML = '<div class="empty-state">No split expenses added yet</div>';
        return;
    }

    const html = splitExpenses.map(expense => {
        const categoryInfo = getAllCategories().find(c => c.name === expense.category) || DEFAULT_CATEGORIES[7];
        const paidMembers = expense.members.filter(m => m.isPaid).length;
        const totalMembers = expense.members.length;
        const isSettled = paidMembers === totalMembers;

        return `
            <div class="split-card">
                <div class="split-header">
                    <div>
                        <h3>${expense.title}</h3>
                        <p class="split-subtitle">Split among ${totalMembers} people • Total: ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(expense.totalAmount)}</p>
                    </div>
                    <span class="split-status ${isSettled ? 'settled' : 'pending'}">
                        ${isSettled ? 'Settled' : 'Pending'}
                    </span>
                </div>
                
                <div class="split-details">
                    <div class="split-members-list">
                        ${expense.members.map((member, index) => `
                            <div class="split-member-detail">
                                <div class="member-info">
                                    <span class="member-name">${member.name}</span>
                                    <span class="member-status ${member.isPaid ? 'paid' : 'unpaid'}">
                                        ${member.isPaid ? 'Paid' : 'Unpaid'}
                                    </span>
                                </div>
                                <div class="member-amount">
                                    ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(member.amount)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="split-actions">
                    <button class="btn-secondary" onclick="editSplitExpense('${expense._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    ${!isSettled ? `
                        <button class="btn-success" onclick="settleSplitExpense('${expense._id}')">
                            <i class="fas fa-check"></i> Settle Up
                        </button>
                    ` : ''}
                    <button class="btn-danger" onclick="deleteSplitExpense('${expense._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

async function toggleMemberPayment(expenseId, memberIndex) {
    try {
        const data = await apiRequest(`/split/${expenseId}/member/${memberIndex}/pay`, {
            method: 'PATCH'
        });

        if (data.success) {
            const index = splitExpenses.findIndex(e => e._id === expenseId);
            if (index !== -1) {
                splitExpenses[index] = data.splitExpense;
            }
            showNotification(data.message, 'success');
            updateSplitExpensesDisplay();
        }
    } catch (error) {
        showNotification('Failed to update member payment status', 'error');
    }
}

async function settleSplitExpense(id) {
    const expense = splitExpenses.find(e => e._id === id);
    if (!expense) return;

    try {
        const data = await apiRequest(`/split/${id}/settle`, {
            method: 'PATCH'
        });

        if (data.success) {
            const index = splitExpenses.findIndex(e => e._id === id);
            if (index !== -1) {
                splitExpenses[index] = data.splitExpense;
            }
            showNotification(data.message, 'success');
            updateSplitExpensesDisplay();
        }
    } catch (error) {
        showNotification('Failed to settle expense', 'error');
    }
}

async function unsettleSplitExpense(id) {
    try {
        const data = await apiRequest(`/split/${id}/unsettle`, {
            method: 'PATCH'
        });

        if (data.success) {
            const index = splitExpenses.findIndex(e => e._id === id);
            if (index !== -1) {
                splitExpenses[index] = data.splitExpense;
            }
            showNotification(data.message, 'success');
            updateSplitExpensesDisplay();
        }
    } catch (error) {
        showNotification('Failed to unsettle expense', 'error');
    }
}

async function deleteSplitExpense(id) {
    if (!confirm('Are you sure you want to delete this split expense?')) return;
    
    try {
        const data = await apiRequest(`/split/${id}`, {
            method: 'DELETE'
        });

        if (data.success) {
            splitExpenses = splitExpenses.filter(e => e._id !== id);
            showNotification(data.message, 'success');
            updateSplitExpensesDisplay();
        }
    } catch (error) {
        showNotification('Failed to delete split expense', 'error');
    }
}

/* ======================
   FILTERS
====================== */
function initializeFilters() {
    const filterType = document.getElementById('filterType');
    const filterCategory = document.getElementById('filterCategory');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');

    if (filterType) filterType.addEventListener('change', applyFilters);
    if (filterCategory) filterCategory.addEventListener('change', applyFilters);
    if (filterStartDate) filterStartDate.addEventListener('change', applyFilters);
    if (filterEndDate) filterEndDate.addEventListener('change', applyFilters);

    // Populate filter category dropdown
    if (filterCategory) {
        const allCategories = getAllCategories();
        filterCategory.innerHTML = `
            <option value="">All Categories</option>
            ${allCategories.map(cat => 
                `<option value="${cat.name}">${cat.icon} ${cat.name}</option>`
            ).join('')}
        `;
    }
}

function applyFilters() {
    loadExpenses();
}

function clearFilters() {
    document.getElementById('filterType').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    loadExpenses();
}

/* ======================
   CHART DOWNLOAD FUNCTION
====================== */
function downloadChart(chartId) {
    const canvas = document.getElementById(chartId);
    if (!canvas) {
        showNotification('Chart not found', 'error');
        return;
    }

    try {
        // Create a link element
        const link = document.createElement('a');
        link.download = `${chartId}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        showNotification('Chart downloaded successfully', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Failed to download chart', 'error');
    }
}

/* ======================
   UTILITY FUNCTIONS
====================== */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updateAllDisplays() {
    loadExpenses();
    updateDashboard();
    loadAnalytics();
    updateRecurringExpensesDisplay();
    updateBillRemindersDisplay();
    updateSplitExpensesDisplay();
    updateBillCalendar();
}

async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await apiRequest('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }
}

function switchAccount() {
    if (confirm('Switch to another account? You will be logged out.')) {
        logout();
    }
}

// Add notification styles
const style = document.createElement('style');
style.textContent = `
/* Profile modal button alignment */
.modal-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}

.modal-actions .btn-secondary {
    order: 1;
}

.modal-actions .btn-primary {
    order: 2;
}

/* Analytics grid layout update */
.analytics-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
}

.analytics-card.full-width {
    grid-column: 1 / -1;
    min-height: 400px;
}

.analytics-card.half-width {
    min-height: 350px;
}

/* For larger screens, show two charts side by side */
@media (min-width: 1024px) {
    .analytics-grid {
        grid-template-columns: 1fr 1fr;
    }
    
    .analytics-card.full-width {
        grid-column: 1 / -1;
    }
}

/* Chart wrapper adjustments for better visibility */
.chart-wrapper {
    position: relative;
    height: 300px;
    width: 100%;
}

.analytics-card.full-width .chart-wrapper {
    height: 350px;
}

/* Button styles for delete account */
.btn-danger {
    background: var(--danger);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
}

.btn-danger:hover {
    background: #dc2626;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 1rem;
}

/* Profile email display */
.profile-email {
    padding: 0.75rem;
    background: var(--bg-hover);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    font-weight: 500;
    color: var(--text-primary);
}

.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    background: white;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transform: translateX(120%);
    transition: transform 0.3s ease;
    z-index: 10000;
    min-width: 280px;
    max-width: 350px;
    border-left: 4px solid #4361ee;
    font-size: 0.875rem;
}

.notification.show {
    transform: translateX(0);
}

.notification-success {
    border-left-color: #10b981;
    background: #d1fae5;
}

.notification-error {
    border-left-color: #ef4444;
    background: #fee2e2;
}

.notification-info {
    border-left-color: #3b82f6;
    background: #dbeafe;
}

.notification i {
    font-size: 1.1rem;
}

/* Category Management Styles */
.categories-management {
    padding: 0.5rem;
}

.categories-section {
    margin-bottom: 1.5rem;
}

.categories-section h4 {
    margin-bottom: 1rem;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.categories-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--bg-hover);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;
}

.category-item:hover {
    transform: translateX(4px);
    background: var(--bg-card);
    border-color: var(--primary);
}

.category-info {
    display: flex;
    flex-direction: column;
    flex: 1;
}

.category-icon {
    font-size: 1.25rem;
    width: 40px;
    text-align: center;
}

.category-name {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.category-count {
    color: var(--text-secondary);
    font-size: 0.75rem;
}

.category-badge {
    padding: 0.25rem 0.75rem;
    background: var(--primary-light);
    color: var(--primary);
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
}

.category-actions {
    display: flex;
    gap: 0.5rem;
}

.category-actions .btn-icon {
    padding: 0.375rem;
    font-size: 0.875rem;
}

.category-actions .btn-icon.edit {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
}

.category-actions .btn-icon.delete {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
}

.category-actions .btn-icon:hover {
    transform: scale(1.1);
}

.add-category-option {
    color: var(--primary) !important;
    font-weight: 600 !important;
    background: var(--bg-hover) !important;
}

/* Category form styles */
.category-form .form-group {
    margin-bottom: 1.5rem;
}

.category-form select {
    font-size: 1.1rem;
    padding: 0.75rem;
}

.category-form option {
    font-size: 1rem;
    padding: 0.5rem;
}

/* Color picker styling */
.category-form input[type="color"] {
    width: 100%;
    height: 50px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    cursor: pointer;
}

/* Badge styles */
.badge {
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--bg-hover);
    color: var(--text-secondary);
}

.badge-success {
    background: var(--success-light);
    color: var(--success);
}

.badge-danger {
    background: var(--danger-light);
    color: var(--danger);
}

.badge-warning {
    background: var(--warning-light);
    color: var(--warning);
}

/* Recurring card styles */
.recurring-card {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    margin-bottom: 1rem;
    border-left: 4px solid var(--primary);
    box-shadow: var(--shadow-md);
}

.recurring-card.inactive {
    border-left-color: var(--text-secondary);
    opacity: 0.8;
}

.recurring-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.recurring-header h3 {
    font-size: 1.25rem;
    color: var(--text-primary);
}

.recurring-badge {
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.recurring-badge.monthly {
    background: var(--primary-light);
    color: var(--primary);
}

.recurring-badge.yearly {
    background: var(--warning-light);
    color: var(--warning);
}

.recurring-badge.weekly {
    background: var(--success-light);
    color: var(--success);
}

.recurring-content {
    margin-bottom: 1rem;
}

.recurring-amount {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.amount-label {
    color: var(--text-secondary);
    font-weight: 500;
}

.amount-value {
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--text-primary);
}

.recurring-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.detail-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
}

.detail-item i {
    width: 20px;
    color: var(--primary);
}

.due-status {
    padding: 0.5rem;
    background: var(--bg-hover);
    border-radius: var(--radius-md);
    text-align: center;
    font-weight: 500;
    color: var(--primary);
}

.due-status.text-danger {
    background: var(--danger-light);
    color: var(--danger);
}

.recurring-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}

/* Bill reminder styles */
.bill-reminder-card {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
    margin-bottom: 1rem;
    border-left: 4px solid var(--warning);
    box-shadow: var(--shadow-md);
}

.bill-reminder-card.paid {
    border-left-color: var(--success);
    opacity: 0.8;
}

.bill-reminder-card.overdue {
    border-left-color: var(--danger);
    animation: pulse 2s infinite;
}

.bill-reminder-card.upcoming {
    border-left-color: var(--warning);
}

.bill-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.bill-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.bill-title h4 {
    margin: 0;
    font-size: 1.1rem;
}

.bill-status {
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
}

.bill-status.paid {
    background: var(--success-light);
    color: var(--success);
}

.bill-status.overdue {
    background: var(--danger-light);
    color: var(--danger);
}

.bill-status.upcoming {
    background: var(--warning-light);
    color: var(--warning);
}

.bill-amount {
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--text-primary);
}

.bill-details {
    margin-bottom: 1rem;
}

.detail-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
}

.detail-row .label {
    color: var(--text-secondary);
}

.detail-row .value {
    color: var(--text-primary);
    font-weight: 500;
}

.bill-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}

/* Calendar styles - Full view */
.calendar-section {
    margin-top: 2rem;
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    box-shadow: var(--shadow-md);
}

.calendar-section h3 {
    margin-bottom: 1rem;
    font-size: 1.25rem;
    color: var(--text-primary);
}

.calendar {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.5rem;
    margin-top: 1rem;
}

.calendar-day-header {
    text-align: center;
    font-weight: 600;
    color: var(--text-secondary);
    padding: 0.5rem;
    font-size: 0.875rem;
    text-transform: uppercase;
}

.calendar-day {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: var(--bg-hover);
    color: var(--text-secondary);
    font-weight: 500;
    position: relative;
    transition: all 0.2s ease;
    cursor: pointer;
}

.calendar-day:hover {
    transform: scale(1.05);
    box-shadow: var(--shadow-sm);
}

.calendar-day.today {
    background: var(--warning);
    color: white;
    font-weight: 600;
}

.calendar-day.has-bill {
    background: var(--danger-light);
    color: var(--danger);
    font-weight: 600;
    border: 2px solid var(--danger);
}

.calendar-day.has-bill:hover {
    background: var(--danger);
    color: white;
}

.calendar-day.has-bill .bill-indicator {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 6px;
    height: 6px;
    background: var(--danger);
    border-radius: 50%;
}

.calendar-day.has-bill:hover .bill-indicator {
    background: white;
}

.calendar-day.empty {
    background: transparent;
    cursor: default;
}

.calendar-day.empty:hover {
    transform: none;
    box-shadow: none;
}

/* Split expense styles */
.split-card {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    margin-bottom: 1rem;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-color);
}

.split-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
}

.split-header h3 {
    font-size: 1.25rem;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.split-subtitle {
    color: var(--text-secondary);
    font-size: 0.875rem;
}

.split-status {
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.split-status.settled {
    background: var(--success-light);
    color: var(--success);
}

.split-status.pending {
    background: var(--warning-light);
    color: var(--warning);
}

.split-details {
    margin: 1rem 0;
}

.split-members-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.split-member-detail {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: var(--bg-hover);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
}

.member-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.member-name {
    font-weight: 500;
    color: var(--text-primary);
}

.member-status {
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 500;
}

.member-status.paid {
    background: var(--success-light);
    color: var(--success);
}

.member-status.unpaid {
    background: var(--warning-light);
    color: var(--warning);
}

.member-amount {
    font-weight: 700;
    color: var(--text-primary);
}

.split-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}

.split-actions .btn-secondary,
.split-actions .btn-success,
.split-actions .btn-danger {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
}

/* Split form styles */
.split-members-section {
    margin: 1.5rem 0;
}

.split-members-section h4 {
    margin-bottom: 1rem;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.split-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
}

.split-member-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: var(--bg-hover);
    border-radius: var(--radius-md);
    margin-bottom: 0.5rem;
    border: 1px solid var(--border-color);
}

.member-name {
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
}

.member-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 1rem;
}

.member-input-group input {
    width: 80px;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    color: var(--text-primary);
    text-align: right;
}

.member-amount {
    font-weight: 700;
    color: var(--text-primary);
    min-width: 100px;
    text-align: right;
}

.split-summary {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    margin: 1.5rem 0;
    border: 1px solid var(--border-color);
}

.summary-total,
.summary-per-person,
.summary-percentage,
.summary-entered,
.summary-difference {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-light);
}

.summary-total {
    font-size: 1.25rem;
    font-weight: 700;
}

.summary-total:last-child,
.summary-per-person:last-child,
.summary-percentage:last-child,
.summary-entered:last-child,
.summary-difference:last-child {
    border-bottom: none;
}
`;
document.head.appendChild(style);


console.log('Expense Tracker fully loaded!');
