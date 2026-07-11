// ================= API SERVICE =================
// Production API URL
const API_URL = 'https://finflow-expense-tracker-backend-production.up.railway.app/api';

// For local development, use:
// const API_URL = window.location.hostname === 'localhost' || 
//                 window.location.hostname === '127.0.0.1'
//                 ? 'http://localhost:5000/api'
//                 : 'https://finflow-expense-tracker-backend-production.up.railway.app/api';

/* ================= TOKEN HELPERS ================= */

// Get JWT token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Build auth headers
function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
    };
}

// Handle API response
async function handleResponse(response) {
    // Check for network/CORS errors
    if (response.status === 0) {
        throw new Error('Network error. Please check your connection.');
    }

    const data = await response.json();

    if (response.status === 401 || 
        data.message?.includes('token') || 
        data.message?.includes('authorization') ||
        data.message === 'No token, authorization denied') {
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        showGlobalMessage('Session expired. Please login again.', 'error');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        
        throw new Error('Unauthorized');
    }

    return data;
}

// Global error handler
function handleApiError(error) {
    console.error('API Error:', error);
    
    let userMessage = 'An error occurred. Please try again.';
    
    if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
        userMessage = 'Cannot connect to server. Please check your internet connection.';
    } else if (error.message.includes('Unauthorized') || error.message.includes('Session expired')) {
        userMessage = 'Session expired. Please login again.';
    } else if (error.message) {
        userMessage = error.message;
    }
    
    showGlobalMessage(userMessage, 'error');
    return { success: false, message: userMessage };
}

/* ================= AUTH CHECK ================= */

async function checkAuth() {
    const token = getAuthToken();
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }

    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: getAuthHeaders(),
            mode: 'cors'
        });
        
        if (!res.ok) {
            if (res.status === 401) {
                logout();
                return false;
            }
            throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await handleResponse(res);
        return data.user;
    } catch (err) {
        console.error('Auth check failed', err);
        return false;
    }
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

/* ================= EXPENSE API ================= */

const ExpenseAPI = {
    async getAll() {
        try {
            const res = await fetch(`${API_URL}/expenses`, {
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async create(data) {
        try {
            const res = await fetch(`${API_URL}/expenses`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async update(id, data) {
        try {
            const res = await fetch(`${API_URL}/expenses/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async delete(id) {
        try {
            const res = await fetch(`${API_URL}/expenses/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async getStats() {
        try {
            const res = await fetch(`${API_URL}/expenses/stats/summary`, {
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    }
};

/* ================= RECURRING API ================= */

const RecurringAPI = {
    async getAll() {
        try {
            const res = await fetch(`${API_URL}/recurring`, {
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async create(data) {
        try {
            const res = await fetch(`${API_URL}/recurring`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async delete(id) {
        try {
            const res = await fetch(`${API_URL}/recurring/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async toggle(id) {
        try {
            const res = await fetch(`${API_URL}/recurring/${id}/toggle`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    }
};

/* ================= BILLS API ================= */

const BillsAPI = {
    async getAll() {
        try {
            const res = await fetch(`${API_URL}/bills`, {
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async create(data) {
        try {
            const res = await fetch(`${API_URL}/bills`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async markPaid(id) {
        try {
            const res = await fetch(`${API_URL}/bills/${id}/pay`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async delete(id) {
        try {
            const res = await fetch(`${API_URL}/bills/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    }
};

/* ================= SPLIT API ================= */

const SplitAPI = {
    async getAll() {
        try {
            const res = await fetch(`${API_URL}/split`, {
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async create(data) {
        try {
            const res = await fetch(`${API_URL}/split`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async markPaid(id, memberIndex) {
        try {
            const res = await fetch(`${API_URL}/split/${id}/member/${memberIndex}/pay`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async delete(id) {
        try {
            const res = await fetch(`${API_URL}/split/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    }
};

/* ================= CATEGORY API ================= */

const CategoriesAPI = {
    async getAll() {
        try {
            const res = await fetch(`${API_URL}/categories`, {
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async create(data) {
        try {
            const res = await fetch(`${API_URL}/categories`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async delete(id) {
        try {
            const res = await fetch(`${API_URL}/categories/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    }
};

/* ================= USER API ================= */

const UserAPI = {
    async updateProfile(data) {
        try {
            const res = await fetch(`${API_URL}/user/profile`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    },

    async changePassword(data) {
        try {
            const res = await fetch(`${API_URL}/user/password`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
                mode: 'cors'
            });
            return await handleResponse(res);
        } catch (error) {
            return handleApiError(error);
        }
    }
};

/* ================= TEST BACKEND CONNECTION ================= */

async function testBackendConnection() {
    try {
        const response = await fetch(`${API_URL}/health`, {
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend connected:', data);
            return true;
        } else {
            console.warn('⚠️ Backend responded with error:', response.status);
            return false;
        }
    } catch (error) {
        console.error('❌ Backend connection failed:', error);
        return false;
    }
}


console.log('✅ API Service Loaded Successfully');
console.log('API URL:', API_URL);
