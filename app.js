// ============================================
// CONFIGURATION
// ============================================

// ✅ Your Render backend URL (tested and working!)
const BACKEND_URL = 'https://eb-tracker-backend.onrender.com';

// Firebase configuration
const firebaseConfig = { 
    apiKey: "AIzaSyAoRjQqAP-3QO9rjoQK7SSZ788lyMmhXmU", 
    authDomain: "eb-tracker-42881.firebaseapp.com", 
    projectId: "eb-tracker-42881", 
    storageBucket: "eb-tracker-42881.firebasestorage.app", 
    messagingSenderId: "922340749018", 
    appId: "1:922340749018:web:68296d8775a79e71b2bfe3" 
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Authorized users
const authorizedUsers = {
    estimator: ["estimator@edanbrook.com", "max@edanbrook.com"],
    coo: ["coo@edanbrook.com", "coo2@edanbrook.com"],
    director: ["director@edanbrook.com", "ajit@edanbrook.com"],
    design_lead: ["designmanager@edanbrook.com"],
    designer: [],
    accounts: ["accounts@edanbrook.com", "finance@edanbrook.com"],
    bdm: []
};

// Global state
let currentUser = null;
let currentUserRole = '';
let authToken = '';
let backendConnected = false;

// ============================================
// CONNECTION & ERROR HANDLING
// ============================================

function showConnectionBanner(message, type = 'error') {
    const banner = document.getElementById('connectionBanner');
    if (banner) {
        banner.textContent = message;
        banner.className = `connection-banner ${type}`;
        if (type === 'success') {
            setTimeout(() => banner.style.display = 'none', 3000);
        }
    }
}

async function testBackendConnection() {
    console.log('🔍 Testing backend connection...');
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        showConnectionBanner('⏳ Connecting to backend (may take 30-60s on first load)...', 'warning');
        
        const response = await fetch(`${BACKEND_URL}/health`, {
            signal: controller.signal,
            mode: 'cors'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);
        
        const data = await response.json();
        console.log('✅ Backend health check:', data);
        
        if (data.status === 'OK') {
            backendConnected = true;
            showConnectionBanner('✅ Backend connected!', 'success');
            return true;
        }
        throw new Error('Backend health check failed');
    } catch (error) {
        console.error('❌ Backend connection failed:', error);
        backendConnected = false;
        
        if (error.name === 'AbortError') {
            showConnectionBanner('⏳ Backend waking up... Please wait...', 'warning');
        } else {
            showConnectionBanner(`❌ Cannot connect: ${error.message}`, 'error');
        }
        
        const panel = document.getElementById('diagnosticPanel');
        if (panel) panel.style.display = 'block';
        return false;
    }
}

async function apiCall(endpoint, options = {}, retryCount = 0) {
    const MAX_RETRIES = 2;
    const url = `${BACKEND_URL}/api/${endpoint}`;

    // Get fresh token if needed
    if (!authToken && currentUser && !endpoint.includes('health')) {
        try {
            console.log('🔑 Getting fresh auth token...');
            authToken = await currentUser.getIdToken(true);
            console.log('✅ Token obtained:', authToken.substring(0, 20) + '...');
        } catch (error) {
            console.error('❌ Token error:', error);
            throw new Error('Authentication token expired. Please log in again.');
        }
    }

    // Build headers carefully
    const defaultHeaders = {};
    
    // Add auth token if available
    if (authToken) {
        defaultHeaders['Authorization'] = `Bearer ${authToken}`;
        console.log('🔐 Auth header added');
    } else {
        console.warn('⚠️ No auth token available');
    }
    
    // Add content-type for non-FormData
    if (!(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
    }

    const finalOptions = {
        method: options.method || 'GET',
        ...options,
        headers: { ...defaultHeaders, ...(options.headers || {}) },
        mode: 'cors'
        // ✅ Removed credentials: 'include' to match CORS config
    };

    try {
        console.log(`📤 API Call [${finalOptions.method}]: ${url}`);
        console.log('📋 Headers:', JSON.stringify(finalOptions.headers, null, 2));
        
        const response = await fetch(url, finalOptions);
        
        console.log(`📥 Response: ${response.status} ${response.statusText}`);
        console.log('📋 Response Headers:', {
            'content-type': response.headers.get('content-type'),
            'access-control-allow-origin': response.headers.get('access-control-allow-origin')
        });

        const contentType = response.headers.get('content-type');
        let responseData;

        if (contentType?.includes('application/json')) {
            const text = await response.text();
            console.log('📄 Response text preview:', text.substring(0, 200));
            responseData = text ? JSON.parse(text) : {};
        } else {
            responseData = await response.text();
        }

        if (!response.ok) {
            console.error('❌ Response not OK:', response.status, responseData);
            
            if (response.status === 401 && currentUser && retryCount === 0) {
                console.log('🔄 401 error - refreshing token...');
                authToken = await currentUser.getIdToken(true);
                return await apiCall(endpoint, options, retryCount + 1);
            }
            
            throw new Error(responseData.message || responseData.error || `Request failed: ${response.status}`);
        }

        console.log('✅ API call successful');
        return responseData;
        
    } catch (error) {
        console.error(`❌ API call failed:`, error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack?.substring(0, 200)
        });
        
        if (error.message.includes('Failed to fetch') && retryCount < MAX_RETRIES) {
            console.log(`🔄 Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return await apiCall(endpoint, options, retryCount + 1);
        }
        
        throw error;
    }
}

// ============================================
// UI UTILITIES
// ============================================

function showLoading() { 
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'flex'; 
}

function hideLoading() { 
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'none'; 
}

function showMessage(message, type = 'info') { 
    const container = document.getElementById('authMessages'); 
    if (container) container.innerHTML = `<div class="${type}-message">${message}</div>`; 
}

function clearMessages() { 
    const container = document.getElementById('authMessages'); 
    if (container) container.innerHTML = ''; 
}

function formatDate(ts) { 
    return (ts && ts.seconds) ? new Date(ts.seconds * 1000).toLocaleString() : 'N/A'; 
}

// ============================================
// AUTHENTICATION
// ============================================

async function handleLogin(e) {
    e.preventDefault();
    clearMessages();
    
    try {
        showMessage('Logging in...', 'info');
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        authToken = await userCredential.user.getIdToken(true);
        console.log('✅ Login successful');
    } catch (error) { 
        showMessage(
            error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' 
                ? 'Invalid email or password.' 
                : 'Login failed: ' + error.message, 
            'error'
        ); 
    }
}

async function logout() { 
    await auth.signOut(); 
}

// ============================================
// DASHBOARD
// ============================================

async function showDashboard() {
    const main = document.getElementById('mainContent');
    if (!main) {
        console.error('❌ mainContent element not found!');
        return;
    }
    
    showLoading();
    
    try {
        console.log('📊 Loading dashboard...');
        console.log('🔐 Current user:', currentUser?.email);
        console.log('🔑 Auth token exists:', !!authToken);
        console.log('👤 Current role:', currentUserRole);
        
        // First, test if backend is reachable at all
        console.log('🧪 Testing backend health first...');
        try {
            const healthResponse = await fetch(`${BACKEND_URL}/health`);
            const healthData = await healthResponse.json();
            console.log('✅ Backend health check:', healthData);
        } catch (healthError) {
            console.error('❌ Backend health check failed:', healthError);
            throw new Error('Cannot reach backend server');
        }
        
        // Now call the dashboard API
        console.log('📞 Calling dashboard API...');
        const response = await apiCall('dashboard');
        console.log('✅ Dashboard response received:', response);

        if (response.success && response.data) {
            console.log('📊 Rendering dashboard with data');
            renderDashboard(response.data);
        } else {
            console.error('❌ Invalid dashboard response:', response);
            throw new Error('Invalid dashboard response: ' + JSON.stringify(response));
        }
    } catch (error) {
        console.error('❌ Dashboard error:', error);
        main.innerHTML = `
            <div class="error-message">
                <h3>⚠️ Dashboard Load Error</h3>
                <p><strong>Error:</strong> ${error.message}</p>
                <details style="margin-top: 1rem;">
                    <summary style="cursor: pointer;">Technical Details</summary>
                    <pre style="margin-top: 0.5rem; background: #f5f5f5; padding: 1rem; border-radius: 5px; overflow-x: auto;">${error.stack || 'No stack trace available'}</pre>
                </details>
                <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                    <button onclick="showDashboard()" class="btn btn-primary">Retry</button>
                    <button onclick="logout()" class="btn btn-outline">Logout</button>
                </div>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

function renderDashboard(data) {
    const statsHtml = data.stats ? Object.entries(data.stats).map(([k, v]) => `
        <div class="stat-card">
            <div class="stat-number">${v}</div>
            <div class="stat-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
        </div>
    `).join('') : '';

    let actionsHtml = '';
    if (data.actionItems?.length) {
        actionsHtml = `
            <h3>Your Action Items</h3>
            ${data.actionItems.map(item => `
                <div class="action-item">
                    <div class="action-content">
                        <strong>${item.projectName}</strong>
                        <div class="action-meta">Client: ${item.clientCompany} | Status: ${item.status.replace(/_/g, ' ')}</div>
                    </div>
                    <div class="action-buttons">
                        ${getActionButtons(item, currentUserRole)}
                    </div>
                </div>
            `).join('')}
        `;
    }

    document.getElementById('mainContent').innerHTML = `
        <div class="page-header">
            <h2>Dashboard</h2>
            <div class="subtitle">Manage your project workflow</div>
        </div>
        <div class="dashboard-stats">${statsHtml}</div>
        <div class="action-section">${actionsHtml || '<p>No pending items</p>'}</div>
    `;
}

function getActionButtons(item, role) {
    let actionBtn = '';
    const viewId = item.proposalId || item.projectId;
    const viewButton = viewId ? `<button class="btn btn-outline btn-sm" onclick="alert('View feature coming soon')">VIEW</button>` : '';
    return `${actionBtn} ${viewButton}`;
}

// ============================================
// APP INITIALIZATION & UI
// ============================================

function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    
    // Build the full app UI
    document.getElementById('appContainer').innerHTML = `
        <div class="loading" id="loadingSpinner">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
        
        <header class="header">
            <div class="header-content">
                <div class="logo">
                    <div class="logo-circle">EB</div>
                    <div class="company-info">
                        <h1>EDANBROOK</h1>
                        <div class="subtitle">EBTrack - Project Management</div>
                    </div>
                </div>
                <div class="user-info">
                    <div>${currentUser.displayName || currentUser.email}</div>
                    <div style="font-size: 0.9rem; opacity: 0.8;">${currentUserRole.replace('_', ' ').toUpperCase()}</div>
                    <button onclick="logout()" class="btn-logout">Logout</button>
                </div>
            </div>
        </header>
        
        <div class="main-layout">
            <nav class="sidebar">
                <ul class="nav-menu">
                    <li><a href="#" onclick="showDashboard(); return false;">📊 Dashboard</a></li>
                    <li><a href="#" onclick="alert('Feature coming soon'); return false;">📋 Proposals</a></li>
                    <li><a href="#" onclick="alert('Feature coming soon'); return false;">📁 Files</a></li>
                    <li><a href="#" onclick="alert('Feature coming soon'); return false;">📝 Activities</a></li>
                </ul>
            </nav>
            
            <main class="main-content" id="mainContent">
                <p>Loading dashboard...</p>
            </main>
        </div>
    `;
    
    // Add styles dynamically
    if (!document.getElementById('appStyles')) {
        const style = document.createElement('style');
        style.id = 'appStyles';
        style.textContent = `
            .header { background: linear-gradient(135deg, #00BFFF, #0099CC); color: white; padding: 1rem 2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header-content { display: flex; justify-content: space-between; align-items: center; max-width: 1400px; margin: 0 auto; }
            .logo { display: flex; align-items: center; gap: 1rem; }
            .logo .logo-circle { width: 50px; height: 50px; font-size: 20px; background: white; color: #00BFFF; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
            .company-info h1 { font-size: 1.8rem; font-weight: 600; }
            .company-info .subtitle { font-size: 0.9rem; opacity: 0.8; }
            .user-info { text-align: right; }
            .btn-logout { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
            
            .main-layout { display: flex; max-width: 1400px; margin: 0 auto; }
            .sidebar { width: 250px; background: white; box-shadow: 2px 0 10px rgba(0,0,0,0.1); min-height: calc(100vh - 80px); }
            .nav-menu { list-style: none; padding: 0; margin: 0; }
            .nav-menu li { border-bottom: 1px solid #f0f0f0; }
            .nav-menu a { display: block; padding: 1.2rem 2rem; color: #2C3E50; text-decoration: none; transition: all 0.3s; }
            .nav-menu a:hover { background: #00BFFF; color: white; }
            
            .main-content { flex: 1; padding: 2rem; background: #F8FAFB; }
            .page-header { margin-bottom: 2rem; }
            .page-header h2 { font-size: 2rem; color: #2C3E50; margin-bottom: 0.5rem; }
            .page-header .subtitle { color: #7F8C8D; }
            
            .dashboard-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin-bottom: 2rem; }
            .stat-card { background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center; border-top: 4px solid #00BFFF; }
            .stat-number { font-size: 2.5rem; font-weight: 700; color: #00BFFF; margin-bottom: 0.5rem; }
            .stat-label { color: #7F8C8D; font-weight: 500; }
            
            .action-section { background: white; border-radius: 15px; padding: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .action-section h3 { font-size: 1.5rem; margin-bottom: 1.5rem; }
            .action-item { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; background: #f8fafc; border-radius: 10px; margin-bottom: 1rem; border-left: 4px solid #00BFFF; }
            .action-content strong { display: block; margin-bottom: 0.5rem; font-size: 1.1rem; }
            .action-meta { font-size: 0.9rem; color: #7F8C8D; }
            .action-buttons { display: flex; gap: 0.5rem; }
            
            .btn { padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s; }
            .btn-primary { background: #00BFFF; color: white; }
            .btn-outline { background: transparent; color: #00BFFF; border: 2px solid #00BFFF; }
            .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.85rem; }
            .error-message { background: #f8d7da; color: #721c24; padding: 1.5rem; border-radius: 10px; }
        `;
        document.head.appendChild(style);
    }
    
    // Load dashboard
    showDashboard();
}

function showLogin() { 
    document.getElementById('appContainer').style.display = 'none'; 
    document.getElementById('loginPage').style.display = 'flex'; 
    clearMessages(); 
}

// ============================================
// DIAGNOSTICS
// ============================================

async function runDiagnostics() {
    const resultsDiv = document.getElementById('diagnosticResults');
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = '<p>Running diagnostics...</p>';
    const results = [];
    
    // Test backend
    try {
        const response = await fetch(`${BACKEND_URL}/health`, { mode: 'cors' });
        const data = await response.json();
        results.push({
            test: 'Backend Health',
            status: data.status === 'OK' ? 'success' : 'warning',
            message: JSON.stringify(data, null, 2)
        });
    } catch (error) {
        results.push({
            test: 'Backend Health',
            status: 'error',
            message: error.message
        });
    }
    
    resultsDiv.innerHTML = results.map(r => `
        <div class="diagnostic-item ${r.status}">
            <strong>${r.test}</strong>
            <pre>${r.message}</pre>
        </div>
    `).join('');
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 EBTracker starting...');
    console.log('Backend:', BACKEND_URL);
    
    // Test backend
    await testBackendConnection();
    
    // Setup login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    // Auth state listener
    auth.onAuthStateChanged(async (user) => {
        console.log('🔄 Auth state changed');
        console.log('👤 User:', user ? user.email : 'Not logged in');
        
        if (user) {
            currentUser = user;
            try {
                console.log('🔑 Getting auth token...');
                authToken = await user.getIdToken(true);
                console.log('✅ Token obtained successfully');
                console.log('📋 Token preview:', authToken.substring(0, 30) + '...');
                console.log('📏 Token length:', authToken.length);
                
                console.log('📄 Fetching user document from Firestore...');
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    currentUserRole = userData.role;
                    console.log('✅ User role loaded:', currentUserRole);
                    console.log('👤 User data:', userData);
                    
                    // Small delay to ensure everything is ready
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    console.log('🎨 Showing app...');
                    showApp();
                } else {
                    console.error('❌ User document not found in Firestore');
                    await auth.signOut();
                    showMessage('User account not found. Please contact administrator.', 'error');
                }
            } catch (error) { 
                console.error('❌ Auth initialization error:', error);
                console.error('Error stack:', error.stack);
                showMessage('Failed to initialize session: ' + error.message, 'error'); 
                await auth.signOut();
            }
        } else {
            console.log('👋 User logged out');
            currentUser = null; 
            currentUserRole = ''; 
            authToken = ''; 
            showLogin();
        }
    });
    
    // Token refresh timer
    setInterval(async () => {
        if (currentUser) {
            try {
                authToken = await currentUser.getIdToken(true);
            } catch (error) {
                console.error('Token refresh failed');
            }
        }
    }, 50 * 60 * 1000);
});

// Export functions to window
window.showDashboard = showDashboard;
window.logout = logout;
window.runDiagnostics = runDiagnostics;
