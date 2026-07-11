// ================= GAMING SHOP MANAGER SCRIPT =================
// API Configuration - USE YOUR GAMING SHOP BACKEND
const API_URL = 'https://gaming-shop-monitoring-backend-three.vercel.app/api';

let authToken = localStorage.getItem('token') || null;
let currentUser = null;
let userCurrency = 'INR';
let monthlyIncome = 0;

// Data storage
let devices = [];
let bills = [];
let shopExpenses = [];
let currentSessionTimers = {};

// Editing states
let editingDeviceId = null;

// Currency symbols
const CURRENCY_SYMBOLS = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£'
};

// Theme management
let currentTheme = localStorage.getItem('theme') || 'light';

// Chart instances
let dailyEarningChart = null;
let monthlyEarningChart = null;
let billStatusChart = null;
let deviceUsageChart = null;

// Device types with icons
const DEVICE_ICONS = {
    'monitor': 'fa-desktop',
    'ps': 'fa-playstation',
    'xbox': 'fa-xbox',
    'pc': 'fa-laptop',
    'vr': 'fa-vr-cardboard',
    'other': 'fa-gamepad'
};

const DEVICE_COLORS = {
    'monitor': '#4361ee',
    'ps': '#0070cc',
    'xbox': '#107c10',
    'pc': '#6c2bd9',
    'vr': '#ff6b35',
    'other': '#6c757d'
};

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

/* ======================
   DATA LOADING - FROM API
====================== */
async function loadUserData() {
    try {
        const data = await apiRequest('/auth/me');
        if (data.success) {
            currentUser = data.user;
            monthlyIncome = data.user.monthlyIncome || 0;
            userCurrency = data.user.currency || 'INR';
            return true;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        if (error.message.includes('Token') || error.message.includes('authorization')) {
            window.location.href = 'login.html';
        }
        return false;
    }
}

async function loadDevices() {
    try {
        const data = await apiRequest('/devices');
        if (data.success) {
            devices = data.devices;
            return devices;
        }
        return [];
    } catch (error) {
        console.error('Error loading devices:', error);
        return [];
    }
}

async function loadBills() {
    try {
        const data = await apiRequest('/gaming-bills');
        if (data.success) {
            bills = data.bills;
            return bills;
        }
        return [];
    } catch (error) {
        console.error('Error loading bills:', error);
        return [];
    }
}

async function loadShopExpenses() {
    try {
        const data = await apiRequest('/shop-expenses');
        if (data.success) {
            shopExpenses = data.expenses;
            return shopExpenses;
        }
        return [];
    } catch (error) {
        console.error('Error loading shop expenses:', error);
        return [];
    }
}

/* ======================
   SAVE FUNCTIONS - TO API
====================== */
async function saveDevice(device) {
    try {
        if (device._id) {
            // Update existing
            const data = await apiRequest(`/devices/${device._id}`, {
                method: 'PUT',
                body: JSON.stringify(device)
            });
            return data;
        } else {
            // Create new
            const data = await apiRequest('/devices', {
                method: 'POST',
                body: JSON.stringify(device)
            });
            return data;
        }
    } catch (error) {
        console.error('Error saving device:', error);
        throw error;
    }
}

async function saveBill(bill) {
    try {
        const data = await apiRequest('/gaming-bills', {
            method: 'POST',
            body: JSON.stringify(bill)
        });
        return data;
    } catch (error) {
        console.error('Error saving bill:', error);
        throw error;
    }
}

async function updateBillStatus(billId) {
    try {
        const data = await apiRequest(`/gaming-bills/${billId}/paid`, {
            method: 'PATCH'
        });
        return data;
    } catch (error) {
        console.error('Error updating bill:', error);
        throw error;
    }
}

async function deleteBillFromAPI(billId) {
    try {
        const data = await apiRequest(`/gaming-bills/${billId}`, {
            method: 'DELETE'
        });
        return data;
    } catch (error) {
        console.error('Error deleting bill:', error);
        throw error;
    }
}

async function saveShopExpense(expense) {
    try {
        const data = await apiRequest('/shop-expenses', {
            method: 'POST',
            body: JSON.stringify(expense)
        });
        return data;
    } catch (error) {
        console.error('Error saving shop expense:', error);
        throw error;
    }
}

async function deleteShopExpenseFromAPI(expenseId) {
    try {
        const data = await apiRequest(`/shop-expenses/${expenseId}`, {
            method: 'DELETE'
        });
        return data;
    } catch (error) {
        console.error('Error deleting shop expense:', error);
        throw error;
    }
}

/* ======================
   INITIALIZATION
====================== */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('GameHub Manager Initialized');
    
    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }
    
    applyTheme();
    
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
    });
    
    const userLoaded = await loadUserData();
    if (!userLoaded) return;
    
    document.getElementById('currencySelector').value = userCurrency;
    updateCurrencyDisplay();
    
    if (currentUser) {
        document.getElementById('username').innerHTML = `Welcome back, <span class="text-primary">${currentUser.name}</span>`;
    }
    
    // Load all data from API
    await Promise.all([
        loadDevices(),
        loadBills(),
        loadShopExpenses()
    ]);
    
    // Update timers
    updateAllTimers();
    
    // Initial display
    updateAllDisplays();
    
    // Set date for expense form
    document.getElementById('expenseDate').valueAsDate = now;
    
    console.log('GameHub Manager loaded successfully');
    console.log('Devices:', devices);
    console.log('Bills:', bills);
    console.log('Shop Expenses:', shopExpenses);
});

/* ======================
   BASIC UI FUNCTIONS
====================== */
function showSection(id) {
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.add('hidden');
    });
    
    const section = document.getElementById(id);
    if (section) {
        section.classList.remove('hidden');
    }
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const btnIndex = {
        'dashboard': 0,
        'devices': 1,
        'analytics': 2,
        'expenses': 3,
        'bills': 4
    }[id];
    
    const navButtons = document.querySelectorAll('.nav-btn');
    if (navButtons[btnIndex]) {
        navButtons[btnIndex].classList.add('active');
    }
    
    switch(id) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'devices':
            renderDevices();
            break;
        case 'analytics':
            setTimeout(() => {
                updateAnalytics();
                updateChartSizes();
            }, 100);
            break;
        case 'expenses':
            renderExpenses();
            break;
        case 'bills':
            renderBills();
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

function updateCurrencyDisplay() {
    const symbol = CURRENCY_SYMBOLS[userCurrency] || '₹';
    document.querySelectorAll('#currencySymbol').forEach(el => {
        el.textContent = symbol;
    });
}

function formatCurrency(amount) {
    if (isNaN(amount) || amount === undefined) return '0.00';
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateShort(dateString) {
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

function showGlobalMessage(message, type = 'success') {
    const messageEl = document.getElementById('globalMessage');
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
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
            document.getElementById('currencySelector').value = userCurrency;

            updateCurrencyDisplay();
            toggleProfile();
            showNotification('Profile updated successfully', 'success');
        }
    } catch (error) {
        showNotification('Failed to update profile', 'error');
    }
}

async function deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
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
            showNotification(error.message || 'Failed to delete account', 'error');
        }
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
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

/* ======================
   DEVICE MANAGEMENT
====================== */
function showAddDeviceModal() {
    document.getElementById('deviceName').value = '';
    document.getElementById('deviceType').value = 'monitor';
    document.getElementById('deviceRate').value = '';
    editingDeviceId = null;
    document.getElementById('addDeviceModal').classList.remove('hidden');
}

function closeAddDeviceModal() {
    document.getElementById('addDeviceModal').classList.add('hidden');
}

async function addDevice() {
    const name = document.getElementById('deviceName').value.trim();
    const type = document.getElementById('deviceType').value;
    const rate = parseFloat(document.getElementById('deviceRate').value);

    if (!name || !rate || rate <= 0) {
        showNotification('Please fill all fields correctly', 'error');
        return;
    }

    try {
        const deviceData = {
            name,
            type,
            ratePerHour: rate,
            isActive: false,
            totalEarning: 0,
            totalTime: 0
        };

        const result = await saveDevice(deviceData);
        if (result.success) {
            devices.push(result.device);
            closeAddDeviceModal();
            showNotification(`Device "${name}" added successfully!`, 'success');
            updateAllDisplays();
        }
    } catch (error) {
        showNotification('Failed to add device: ' + error.message, 'error');
    }
}

async function deleteDevice(id) {
    if (!confirm('Are you sure you want to remove this device?')) return;
    
    const device = devices.find(d => d._id === id);
    if (device && device.isActive) {
        showNotification('Cannot delete an active device. End the session first.', 'error');
        return;
    }
    
    try {
        const result = await apiRequest(`/devices/${id}`, {
            method: 'DELETE'
        });
        
        if (result.success) {
            devices = devices.filter(d => d._id !== id);
            showNotification('Device removed successfully', 'success');
            updateAllDisplays();
        }
    } catch (error) {
        showNotification('Failed to delete device: ' + error.message, 'error');
    }
}

async function startDeviceSession(id) {
    const device = devices.find(d => d._id === id);
    if (!device) return;
    
    if (device.isActive) {
        showNotification('Device is already in use', 'warning');
        return;
    }
    
    try {
        device.isActive = true;
        device.sessionStart = new Date().toISOString();
        
        const result = await saveDevice(device);
        if (result.success) {
            Object.assign(device, result.device);
            startTimer(id);
            showNotification(`Session started on ${device.name}!`, 'success');
            updateAllDisplays();
        }
    } catch (error) {
        showNotification('Failed to start session: ' + error.message, 'error');
    }
}

// Store pending bill data for summary modal
let pendingBillData = null;

async function endDeviceSession(id) {
    const device = devices.find(d => d._id === id);
    if (!device || !device.isActive) {
        showNotification('Device is not active', 'error');
        return;
    }
    
    const startTime = new Date(device.sessionStart);
    const endTime = new Date();
    const durationMs = endTime - startTime;
    const durationHours = durationMs / (1000 * 60 * 60);
    
    // Calculate bill (minimum 30 minutes)
    const minHours = Math.max(durationHours, 0.5);
    const amount = Math.round((minHours * device.ratePerHour) * 100) / 100;
    
    // Store bill data for summary
    pendingBillData = {
        deviceId: device._id,
        deviceName: device.name,
        deviceType: device.type,
        startTime: device.sessionStart,
        endTime: endTime.toISOString(),
        duration: durationMs,
        durationHours: minHours,
        amount: amount,
        ratePerHour: device.ratePerHour
    };
    
    // Stop the timer
    stopTimer(id);
    
    // Show bill summary modal
    showBillSummary(pendingBillData);
}

function showBillSummary(data) {
    // Set device icon
    const icon = DEVICE_ICONS[data.deviceType] || 'fa-gamepad';
    document.getElementById('summaryDeviceIcon').className = `fas ${icon}`;
    
    // Set device name and type
    document.getElementById('summaryDeviceName').textContent = data.deviceName;
    document.getElementById('summaryDeviceType').textContent = 
        data.deviceType.charAt(0).toUpperCase() + data.deviceType.slice(1);
    
    // Set times
    document.getElementById('summaryStartTime').textContent = formatDate(data.startTime);
    document.getElementById('summaryEndTime').textContent = formatDate(data.endTime);
    
    // Set duration
    const hours = Math.floor(data.durationHours);
    const minutes = Math.round((data.durationHours - hours) * 60);
    document.getElementById('summaryDuration').textContent = `${hours}h ${minutes}m`;
    
    // Set amount
    document.getElementById('summaryAmount').textContent = 
        `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(data.amount)}`;
    
    // Show modal
    document.getElementById('billSummaryModal').classList.remove('hidden');
}

function closeBillSummary() {
    document.getElementById('billSummaryModal').classList.add('hidden');
    pendingBillData = null;
}

async function confirmBillPaid() {
    if (!pendingBillData) return;
    
    try {
        const billData = {
            deviceId: pendingBillData.deviceId,
            deviceName: pendingBillData.deviceName,
            deviceType: pendingBillData.deviceType,
            startTime: pendingBillData.startTime,
            endTime: pendingBillData.endTime,
            duration: pendingBillData.duration,
            durationHours: pendingBillData.durationHours,
            amount: pendingBillData.amount,
            status: 'paid'
        };
        
        const result = await saveBill(billData);
        
        if (result.success) {
            bills.push(result.bill);
            
            // Update device
            const device = devices.find(d => d._id === pendingBillData.deviceId);
            if (device) {
                device.isActive = false;
                device.sessionStart = null;
                device.totalEarning += pendingBillData.amount;
                device.totalTime += pendingBillData.duration;
                await saveDevice(device);
            }
            
            closeBillSummary();
            showNotification(`Bill paid! ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(pendingBillData.amount)}`, 'success');
            updateAllDisplays();
        }
    } catch (error) {
        showNotification('Failed to save bill: ' + error.message, 'error');
    }
}

async function confirmBillPending() {
    if (!pendingBillData) return;
    
    try {
        const billData = {
            deviceId: pendingBillData.deviceId,
            deviceName: pendingBillData.deviceName,
            deviceType: pendingBillData.deviceType,
            startTime: pendingBillData.startTime,
            endTime: pendingBillData.endTime,
            duration: pendingBillData.duration,
            durationHours: pendingBillData.durationHours,
            amount: pendingBillData.amount,
            status: 'pending'
        };
        
        const result = await saveBill(billData);
        
        if (result.success) {
            bills.push(result.bill);
            
            // Update device
            const device = devices.find(d => d._id === pendingBillData.deviceId);
            if (device) {
                device.isActive = false;
                device.sessionStart = null;
                device.totalEarning += pendingBillData.amount;
                device.totalTime += pendingBillData.duration;
                await saveDevice(device);
            }
            
            closeBillSummary();
            showNotification(`Bill added to pending! ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(pendingBillData.amount)}`, 'warning');
            updateAllDisplays();
        }
    } catch (error) {
        showNotification('Failed to save bill: ' + error.message, 'error');
    }
}

/* ======================
   TIMER FUNCTIONS
====================== */
function startTimer(deviceId) {
    if (currentSessionTimers[deviceId]) {
        clearInterval(currentSessionTimers[deviceId]);
    }
    
    currentSessionTimers[deviceId] = setInterval(() => {
        updateDeviceTimer(deviceId);
    }, 1000);
}

function stopTimer(deviceId) {
    if (currentSessionTimers[deviceId]) {
        clearInterval(currentSessionTimers[deviceId]);
        delete currentSessionTimers[deviceId];
    }
}

function updateDeviceTimer(deviceId) {
    const device = devices.find(d => d._id === deviceId);
    if (!device || !device.isActive) return;
    
    const timerElement = document.getElementById(`timer-${deviceId}`);
    if (!timerElement) return;
    
    const startTime = new Date(device.sessionStart);
    const now = new Date();
    const elapsed = Math.floor((now - startTime) / 1000);
    
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    timerElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    const durationHours = elapsed / 3600;
    const minHours = Math.max(durationHours, 0.5);
    const currentAmount = minHours * device.ratePerHour;
    
    const amountElement = document.getElementById(`current-amount-${deviceId}`);
    if (amountElement) {
        amountElement.textContent = `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(currentAmount)}`;
    }
}

function updateAllTimers() {
    devices.forEach(device => {
        if (device.isActive) {
            startTimer(device._id);
        }
    });
}

/* ======================
   RENDER FUNCTIONS
====================== */
function renderDevices() {
    const container = document.getElementById('devicesGrid');
    if (!container) return;
    
    if (devices.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-desktop"></i>
                <h3>No Devices Added</h3>
                <p class="text-muted">Add your gaming devices to start tracking sessions</p>
                <button class="btn-primary" onclick="showAddDeviceModal()">
                    <i class="fas fa-plus-circle"></i> Add Your First Device
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = devices.map(device => {
        const icon = DEVICE_ICONS[device.type] || 'fa-gamepad';
        const color = DEVICE_COLORS[device.type] || '#6c757d';
        const statusClass = device.isActive ? 'active' : 'inactive';
        const statusText = device.isActive ? 'In Use' : 'Available';
        
        let totalTimeStr = '0h';
        if (device.totalTime > 0) {
            const totalHours = Math.floor(device.totalTime / (1000 * 60 * 60));
            const totalMinutes = Math.floor((device.totalTime % (1000 * 60 * 60)) / (1000 * 60));
            totalTimeStr = `${totalHours}h ${totalMinutes}m`;
        }
        
        return `
            <div class="device-card ${statusClass}">
                <div class="device-header">
                    <div class="device-icon" style="background: ${color}20; color: ${color}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="device-info">
                        <h3>${device.name}</h3>
                        <p class="device-type">${device.type.charAt(0).toUpperCase() + device.type.slice(1)}</p>
                    </div>
                    <span class="device-status ${statusClass}">${statusText}</span>
                </div>
                
                <div class="device-details">
                    <div class="detail-item">
                        <span class="label">Rate:</span>
                        <span class="value">${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(device.ratePerHour)}/hr</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Total Earning:</span>
                        <span class="value">${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(device.totalEarning)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Total Time:</span>
                        <span class="value">${totalTimeStr}</span>
                    </div>
                </div>
                
                ${device.isActive ? `
                    <div class="device-session-info">
                        <div class="timer-display">
                            <i class="fas fa-clock"></i>
                            <span id="timer-${device._id}">00:00:00</span>
                        </div>
                        <div class="current-bill">
                            Current: <span id="current-amount-${device._id}">${CURRENCY_SYMBOLS[userCurrency]}0.00</span>
                        </div>
                    </div>
                ` : ''}
                
                <div class="device-actions">
                    ${device.isActive ? `
                        <button class="btn-danger" onclick="endDeviceSession('${device._id}')">
                            <i class="fas fa-stop"></i> End Session
                        </button>
                    ` : `
                        <button class="btn-success" onclick="startDeviceSession('${device._id}')">
                            <i class="fas fa-play"></i> Start
                        </button>
                    `}
                    <button class="btn-icon delete" onclick="deleteDevice('${device._id}')" title="Remove Device">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderBills() {
    const pendingList = document.getElementById('pendingBillsList');
    const paidList = document.getElementById('paidBillsList');
    const pendingCount = document.getElementById('pendingCount');
    const paidCount = document.getElementById('paidCount');
    
    if (!pendingList || !paidList) return;
    
    const pendingBills = bills.filter(b => b.status === 'pending');
    const paidBills = bills.filter(b => b.status === 'paid');
    
    pendingCount.textContent = pendingBills.length;
    paidCount.textContent = paidBills.length;
    
    if (pendingBills.length === 0) {
        pendingList.innerHTML = `
            <div class="empty-state small">
                <i class="fas fa-check-circle"></i>
                <p>No pending bills</p>
            </div>
        `;
    } else {
        pendingList.innerHTML = pendingBills.map(bill => `
            <div class="bill-item pending">
                <div class="bill-info">
                    <div class="bill-device">${bill.deviceName}</div>
                    <div class="bill-time">${formatDate(bill.startTime)} - ${formatDate(bill.endTime)}</div>
                    <div class="bill-duration">Duration: ${bill.durationHours.toFixed(1)} hours</div>
                </div>
                <div class="bill-amount">${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(bill.amount)}</div>
                <div class="bill-actions">
                    <button class="btn-success btn-sm" onclick="markBillPaid('${bill._id}')">
                        <i class="fas fa-check"></i> Paid
                    </button>
                    <button class="btn-danger btn-sm" onclick="deleteBill('${bill._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    if (paidBills.length === 0) {
        paidList.innerHTML = `
            <div class="empty-state small">
                <i class="fas fa-receipt"></i>
                <p>No paid bills yet</p>
            </div>
        `;
    } else {
        paidList.innerHTML = paidBills.map(bill => `
            <div class="bill-item paid">
                <div class="bill-info">
                    <div class="bill-device">${bill.deviceName}</div>
                    <div class="bill-time">${formatDate(bill.startTime)} - ${formatDate(bill.endTime)}</div>
                    <div class="bill-duration">Duration: ${bill.durationHours.toFixed(1)} hours</div>
                </div>
                <div class="bill-amount">${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(bill.amount)}</div>
                <div class="bill-status-badge paid">Paid</div>
            </div>
        `).join('');
    }
}

async function markBillPaid(id) {
    try {
        const result = await updateBillStatus(id);
        if (result.success) {
            const bill = bills.find(b => b._id === id);
            if (bill) {
                bill.status = 'paid';
            }
            showNotification('Bill marked as paid!', 'success');
            renderBills();
            updateDashboard();
            updateAnalytics();
        }
    } catch (error) {
        showNotification('Failed to mark bill as paid: ' + error.message, 'error');
    }
}

async function deleteBill(id) {
    if (!confirm('Delete this bill?')) return;
    try {
        const result = await deleteBillFromAPI(id);
        if (result.success) {
            bills = bills.filter(b => b._id !== id);
            showNotification('Bill deleted', 'info');
            renderBills();
            updateDashboard();
            updateAnalytics();
        }
    } catch (error) {
        showNotification('Failed to delete bill: ' + error.message, 'error');
    }
}

function renderExpenses() {
    const container = document.getElementById('expenseList');
    if (!container) return;
    
    const total = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
    document.getElementById('expenseTotal').innerHTML = `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(total)}`;
    
    if (shopExpenses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-wallet"></i>
                <p>No shop expenses recorded</p>
                <p class="text-muted">Add your shop expenses like rent, electricity, etc.</p>
            </div>
        `;
        return;
    }
    
    const sorted = [...shopExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map(expense => `
                    <tr>
                        <td>${expense.title}</td>
                        <td><span class="badge">${expense.category}</span></td>
                        <td>${formatDateShort(expense.date)}</td>
                        <td class="text-danger">${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(expense.amount)}</td>
                        <td>
                            <button class="btn-icon delete" onclick="deleteExpense('${expense._id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    try {
        const result = await deleteShopExpenseFromAPI(id);
        if (result.success) {
            shopExpenses = shopExpenses.filter(e => e._id !== id);
            showNotification('Expense deleted', 'info');
            renderExpenses();
            updateDashboard();
        }
    } catch (error) {
        showNotification('Failed to delete expense: ' + error.message, 'error');
    }
}

/* ======================
   SHOP EXPENSES
====================== */
function showAddExpenseModal() {
    document.getElementById('expenseTitle').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseCategory').value = 'Electricity';
    document.getElementById('expenseDate').valueAsDate = new Date();
    document.getElementById('addExpenseModal').classList.remove('hidden');
}

function closeAddExpenseModal() {
    document.getElementById('addExpenseModal').classList.add('hidden');
}

async function addShopExpense() {
    const title = document.getElementById('expenseTitle').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;
    const date = document.getElementById('expenseDate').value;

    if (!title || !amount || !date) {
        showNotification('Please fill all fields', 'error');
        return;
    }

    try {
        const expenseData = {
            title,
            amount,
            category,
            date
        };

        const result = await saveShopExpense(expenseData);
        if (result.success) {
            shopExpenses.push(result.expense);
            closeAddExpenseModal();
            showNotification('Expense added successfully!', 'success');
            renderExpenses();
            updateDashboard();
        }
    } catch (error) {
        showNotification('Failed to add expense: ' + error.message, 'error');
    }
}

/* ======================
   DASHBOARD
====================== */
function updateDashboard() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Active sessions
    const activeSessions = devices.filter(d => d.isActive).length;
    document.getElementById('activeSessions').textContent = activeSessions;
    
    // Today's earning
    const todayBills = bills.filter(b => {
        const billDate = new Date(b.createdAt);
        return billDate >= today && b.status === 'paid';
    });
    const todayEarning = todayBills.reduce((sum, b) => sum + b.amount, 0);
    document.getElementById('todayEarning').textContent = formatCurrency(todayEarning);
    
    // Total devices
    document.getElementById('totalDevices').textContent = devices.length;
    
    // Pending bills
    const pendingBills = bills.filter(b => b.status === 'pending').length;
    document.getElementById('pendingBills').textContent = pendingBills;
    
    // Quick stats
    const todaySessions = bills.filter(b => new Date(b.createdAt) >= today).length;
    document.getElementById('todaySessions').textContent = todaySessions;
    
    const weekBills = bills.filter(b => new Date(b.createdAt) >= weekStart && b.status === 'paid');
    const weekEarning = weekBills.reduce((sum, b) => sum + b.amount, 0);
    document.getElementById('weekEarning').textContent = formatCurrency(weekEarning);
    
    const monthBills = bills.filter(b => new Date(b.createdAt) >= monthStart && b.status === 'paid');
    const monthEarning = monthBills.reduce((sum, b) => sum + b.amount, 0);
    document.getElementById('monthEarning').textContent = formatCurrency(monthEarning);
    
    const paidBills = bills.filter(b => b.status === 'paid').length;
    document.getElementById('paidBillCount').textContent = paidBills;
    
    // Recent sessions
    updateRecentSessions();
}

function updateRecentSessions() {
    const container = document.getElementById('recentSessions');
    if (!container) return;
    
    const recent = [...bills]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-gamepad"></i>
                <p>No sessions yet</p>
                <p class="text-muted">Start a gaming session to track time and earnings</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recent.map(session => `
        <div class="activity-item ${session.status}">
            <div class="activity-icon">
                <i class="fas ${DEVICE_ICONS[session.deviceType] || 'fa-gamepad'}"></i>
            </div>
            <div class="activity-info">
                <div class="activity-device">${session.deviceName}</div>
                <div class="activity-time">${formatDate(session.startTime)}</div>
                <div class="activity-duration">${session.durationHours.toFixed(1)} hours</div>
            </div>
            <div class="activity-amount ${session.status}">
                ${session.status === 'paid' ? '✅' : '⏳'} ${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(session.amount)}
            </div>
        </div>
    `).join('');
}

/* ======================
   ANALYTICS
====================== */
function updateAnalytics() {
    updateDailyEarningChart();
    updateMonthlyEarningChart();
    updateBillStatusChart();
    updateDeviceUsageChart();
}

function updateDailyEarningChart() {
    const canvas = document.getElementById('dailyEarningChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (dailyEarningChart) {
        dailyEarningChart.destroy();
    }
    
    const days = [];
    const earnings = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        days.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
        
        const dayBills = bills.filter(b => {
            const billDate = new Date(b.createdAt).toISOString().split('T')[0];
            return billDate === dateStr && b.status === 'paid';
        });
        earnings.push(dayBills.reduce((sum, b) => sum + b.amount, 0));
    }
    
    dailyEarningChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Daily Earning',
                data: earnings,
                backgroundColor: 'rgba(108, 43, 217, 0.8)',
                borderColor: 'rgba(108, 43, 217, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(value)}`;
                        }
                    }
                }
            }
        }
    });
}

function updateMonthlyEarningChart() {
    const canvas = document.getElementById('monthlyEarningChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (monthlyEarningChart) {
        monthlyEarningChart.destroy();
    }
    
    const months = [];
    const earnings = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = date.toISOString().split('T')[0].slice(0, 7);
        months.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
        
        const monthBills = bills.filter(b => {
            const billDate = new Date(b.createdAt).toISOString().slice(0, 7);
            return billDate === monthStr && b.status === 'paid';
        });
        earnings.push(monthBills.reduce((sum, b) => sum + b.amount, 0));
    }
    
    monthlyEarningChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Monthly Earning',
                data: earnings,
                backgroundColor: 'rgba(108, 43, 217, 0.1)',
                borderColor: 'rgba(108, 43, 217, 1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(108, 43, 217, 1)',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(value)}`;
                        }
                    }
                }
            }
        }
    });
}

function updateBillStatusChart() {
    const canvas = document.getElementById('billStatusChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (billStatusChart) {
        billStatusChart.destroy();
    }
    
    const paid = bills.filter(b => b.status === 'paid').length;
    const pending = bills.filter(b => b.status === 'pending').length;
    
    billStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Paid Bills', 'Pending Bills'],
            datasets: [{
                data: [paid, pending],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    'rgb(16, 185, 129)',
                    'rgb(239, 68, 68)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateDeviceUsageChart() {
    const canvas = document.getElementById('deviceUsageChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (deviceUsageChart) {
        deviceUsageChart.destroy();
    }
    
    const deviceStats = {};
    devices.forEach(device => {
        const deviceBills = bills.filter(b => b.deviceId === device._id && b.status === 'paid');
        const totalEarning = deviceBills.reduce((sum, b) => sum + b.amount, 0);
        if (totalEarning > 0) {
            deviceStats[device.name] = totalEarning;
        }
    });
    
    const labels = Object.keys(deviceStats);
    const data = Object.values(deviceStats);
    const colors = labels.map((_, i) => {
        const hue = (i * 137.5) % 360;
        return `hsla(${hue}, 70%, 60%, 0.8)`;
    });
    
    if (labels.length === 0) {
        deviceUsageChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['No Data'],
                datasets: [{
                    data: [0],
                    backgroundColor: ['rgba(200, 200, 200, 0.5)']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
        return;
    }
    
    deviceUsageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Earning by Device',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.8', '1')),
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return `${CURRENCY_SYMBOLS[userCurrency]}${formatCurrency(value)}`;
                        }
                    }
                }
            }
        }
    });
}

/* ======================
   CHART DOWNLOAD
====================== */
function downloadChart(chartId) {
    const canvas = document.getElementById(chartId);
    if (!canvas) {
        showNotification('Chart not found', 'error');
        return;
    }

    try {
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

function updateChartSizes() {
    const charts = [
        dailyEarningChart,
        monthlyEarningChart,
        billStatusChart,
        deviceUsageChart
    ];
    
    charts.forEach(chart => {
        if (chart) {
            chart.resize();
            chart.update();
        }
    });
}

/* ======================
   UPDATE ALL DISPLAYS
====================== */
function updateAllDisplays() {
    renderDevices();
    renderBills();
    renderExpenses();
    updateDashboard();
    updateAnalytics();
}

/* ======================
   STYLES FOR NOTIFICATIONS
====================== */
const style = document.createElement('style');
style.textContent = `
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

.notification-warning {
    border-left-color: #f59e0b;
    background: #fef3c7;
}

.notification i {
    font-size: 1.1rem;
}

.empty-state.small {
    padding: 1.5rem;
}

.empty-state.small i {
    font-size: 2rem;
}

.badge {
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    background: #f1f5f9;
    color: #64748b;
}

.btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-weight: 500;
}

.btn-sm.btn-success {
    background: #10b981;
    color: white;
}

.btn-sm.btn-success:hover {
    background: #059669;
}

.btn-sm.btn-danger {
    background: #ef4444;
    color: white;
}

.btn-sm.btn-danger:hover {
    background: #dc2626;
}
`;
document.head.appendChild(style);

console.log('GameHub Manager fully loaded!');
