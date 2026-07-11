// ================= APPLICATION INITIALIZATION =================

// Global state
let APP_STATE = {
    user: null,
    expenses: [],
    categories: [],
    recurring: [],
    bills: [],
    split: [],
    currency: 'INR',
    theme: 'light',
    isLoading: false
};

// Show loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.toggle('hidden', !show);
    }
    APP_STATE.isLoading = show;
}

// Show global message
function showGlobalMessage(message, type = 'success') {
    const messageEl = document.getElementById('globalMessage');
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    // Auto hide
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

// Check authentication and initialize app
async function initializeApp() {
    console.log('Initializing FinFlow...');
    
    try {
        showLoading(true);
        
        // Check if we have a token
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }
        
        // Get current user
        const user = await checkAuth();
        if (!user) {
            showGlobalMessage('Session expired. Please login again.', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        // Store user in state
        APP_STATE.user = user;
        APP_STATE.currency = user.currency || 'INR';
        APP_STATE.theme = user.theme || 'light';
        
        // Initialize UI with user data
        initUI();
        
        // Load all data
        await loadAllData();
        
        // Show welcome message
        showGlobalMessage(`Welcome back, ${user.name}!`, 'success');
        
        console.log('App initialized successfully');
        
    } catch (error) {
        console.error('App initialization failed:', error);
        showGlobalMessage('Failed to load application. Please try refreshing.', 'error');
    } finally {
        showLoading(false);
    }
}

// Initialize UI elements
function initUI() {
    const user = APP_STATE.user;
    if (!user) return;
    
    // Set username
    const usernameEl = document.getElementById('username');
    if (usernameEl) {
        usernameEl.textContent = `Welcome, ${user.name}`;
    }
    
    // Set profile form
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileIncome = document.getElementById('profileIncome');
    const profileCurrency = document.getElementById('profileCurrency');
    const currencySelector = document.getElementById('currencySelector');
    
    if (profileName) profileName.value = user.name;
    if (profileEmail) {
        profileEmail.innerHTML = `
            <span>${user.email}</span>
            <small class="text-muted">(cannot be changed)</small>
        `;
    }
    if (profileIncome) profileIncome.value = user.monthlyIncome || '';
    if (profileCurrency) profileCurrency.value = user.currency || 'INR';
    if (currencySelector) currencySelector.value = user.currency || 'INR';
    
    // Set theme
    if (user.theme === 'dark') {
        document.body.classList.add('dark-theme');
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) themeIcon.className = 'fas fa-sun';
    }
    
    // Update currency symbol
    updateCurrencySymbol();
    
    // Update date display
    updateDateDisplay();
}

// Update currency symbol display
function updateCurrencySymbol() {
    const symbol = CONFIG.getCurrencySymbol(APP_STATE.currency);
    const symbolElements = document.querySelectorAll('#currencySymbol');
    symbolElements.forEach(el => {
        el.textContent = symbol;
    });
}

// Update date display
function updateDateDisplay() {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        dateEl.textContent = now.toLocaleDateString('en-US', options);
    }
}

// Load all data from APIs
async function loadAllData() {
    try {
        showLoading(true);
        
        // Load data in parallel
        const promises = [
            ExpenseAPI.getAll(),
            CategoriesAPI.getAll(),
            RecurringAPI.getAll(),
            BillsAPI.getAll(),
            SplitAPI.getAll(),
            ExpenseAPI.getStats()
        ];
        
        const results = await Promise.allSettled(promises);
        
        // Process results
        const [expensesResult, categoriesResult, recurringResult, 
               billsResult, splitResult, statsResult] = results;
        
        // Handle expenses
        if (expensesResult.status === 'fulfilled' && expensesResult.value.success) {
            APP_STATE.expenses = expensesResult.value.expenses || [];
        }
        
        // Handle categories
        if (categoriesResult.status === 'fulfilled' && categoriesResult.value.success) {
            APP_STATE.categories = categoriesResult.value.categories || CONFIG.DEFAULT_CATEGORIES;
        } else {
            // Use default categories as fallback
            APP_STATE.categories = CONFIG.DEFAULT_CATEGORIES;
        }
        
        // Handle recurring expenses
        if (recurringResult.status === 'fulfilled' && recurringResult.value.success) {
            APP_STATE.recurring = recurringResult.value.recurringExpenses || [];
        }
        
        // Handle bills
        if (billsResult.status === 'fulfilled' && billsResult.value.success) {
            APP_STATE.bills = billsResult.value.bills || [];
        }
        
        // Handle split expenses
        if (splitResult.status === 'fulfilled' && splitResult.value.success) {
            APP_STATE.split = splitResult.value.splitExpenses || [];
        }
        
        // Update UI with loaded data
        updateDashboard();
        populateCategoriesDropdowns();
        
        // Update charts if they exist
        if (window.updateCharts) {
            window.updateCharts();
        }
        
        console.log('Data loaded successfully');
        
    } catch (error) {
        console.error('Failed to load data:', error);
        showGlobalMessage('Some data failed to load. Please try refreshing.', 'warning');
    } finally {
        showLoading(false);
    }
}

// Populate category dropdowns
function populateCategoriesDropdowns() {
    const categorySelectors = [
        'category', 'recurringCategory', 'billCategory', 'splitCategory'
    ];
    
    categorySelectors.forEach(selectorId => {
        const select = document.getElementById(selectorId);
        if (!select) return;
        
        // Clear existing options except first
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Add categories
        APP_STATE.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = `${category.icon || '📝'} ${category.name}`;
            select.appendChild(option);
        });
    });
}

// Update dashboard
function updateDashboard() {
    // Calculate totals
    const totalIncome = APP_STATE.expenses
        .filter(e => e.type === 'income')
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const totalExpense = APP_STATE.expenses
        .filter(e => e.type === 'expense')
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : 0;
    
    // Update DOM
    const totalIncomeEl = document.getElementById('totalIncome');
    const totalExpenseEl = document.getElementById('totalExpense');
    const balanceEl = document.getElementById('balance');
    const savingsRateEl = document.getElementById('savingsRate');
    const expenseTotalEl = document.getElementById('expenseTotal');
    
    if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(totalIncome);
    if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(totalExpense);
    if (balanceEl) balanceEl.textContent = formatCurrency(balance);
    if (savingsRateEl) savingsRateEl.textContent = `${savingsRate}%`;
    if (expenseTotalEl) expenseTotalEl.innerHTML = `
        ${CONFIG.getCurrencySymbol(APP_STATE.currency)}${formatCurrency(totalExpense)}
    `;
    
    // Update recent expenses
    updateRecentExpenses();
}

// Format currency
function formatCurrency(amount) {
    return parseFloat(amount || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Update recent expenses list
function updateRecentExpenses() {
    const container = document.getElementById('recentExpenseList');
    if (!container) return;
    
    const recentExpenses = APP_STATE.expenses
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    
    if (recentExpenses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <p>No expenses yet</p>
                <p class="text-muted">Add your first expense to get started</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recentExpenses.map(expense => `
        <div class="expense-item">
            <div class="expense-info">
                <div class="expense-icon">
                    <i class="fas fa-${expense.type === 'income' ? 'money-bill-wave' : 'shopping-cart'}"></i>
                </div>
                <div class="expense-details">
                    <h4>${expense.description}</h4>
                    <p class="expense-category">
                        <i class="fas fa-tag"></i> ${expense.category}
                    </p>
                </div>
            </div>
            <div class="expense-amount ${expense.type}">
                ${expense.type === 'income' ? '+' : '-'}${CONFIG.getCurrencySymbol(APP_STATE.currency)}${formatCurrency(expense.amount)}
            </div>
        </div>
    `).join('');
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Change currency
function changeCurrency(currency) {
    APP_STATE.currency = currency;
    updateCurrencySymbol();
    updateDashboard();
    
    // Save to user profile if logged in
    if (APP_STATE.user) {
        UserAPI.updateProfile({ currency })
            .then(() => {
                // Update local user data
                APP_STATE.user.currency = currency;
                localStorage.setItem('user', JSON.stringify(APP_STATE.user));
            })
            .catch(err => console.error('Failed to update currency:', err));
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // First, make sure config is loaded
    if (typeof CONFIG === 'undefined') {
        console.error('Configuration not loaded');
        showGlobalMessage('Application configuration failed to load.', 'error');
        return;
    }
    
    console.log('Starting app initialization...');
    initializeApp();
});
