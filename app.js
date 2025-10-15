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

// ============================================
// INITIALIZATION
// ============================================

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentUserRole = '';
let authToken = '';
let backendConnected = false;

// ============================================
// BACKEND CONNECTION UTILITIES
// ============================================

function showConnectionBanner(message, type = 'error') {
    const banner = document.getElementById('connectionBanner');
    banner.textContent = message;
    banner.className = `connection-banner ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            banner.style.display = 'none';
        }, 3000);
    }
}

async function testBackendConnection() {
    console.log('🔍 Testing backend connection...');
    console.log('Backend URL:', BACKEND_URL);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for cold start
        
        showConnectionBanner('⏳ Connecting to backend (this may take 30-60s on first load)...', 'warning');
        
        const response = await fetch(`${BACKEND_URL}/health`, {
            signal: controller.signal,
            mode: 'cors'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Backend health check:', data);
        
        if (data.status === 'OK') {
            backendConnected = true;
            showConnectionBanner('✅ Backend connected successfully!', 'success');
            return true;
        }
        
        throw new Error('Backend health check failed');
        
    } catch (error) {
        console.error('❌ Backend connection failed:', error);
        backendConnected = false;
        
        if (error.name === 'AbortError') {
            showConnectionBanner('⏳ Backend is waking up (Render cold start). Please wait 30-60 seconds...', 'warning');
        } else {
            showConnectionBanner(`❌ Cannot connect to backend: ${error.message}`, 'error');
        }
        
        // Show diagnostic panel
        document.getElementById('diagnosticPanel').style.display = 'block';
        
        return false;
    }
}

async function apiCall(endpoint, options = {}, retryCount = 0) {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 2000;
    const url = `${BACKEND_URL}/api/${endpoint}`;

    // Ensure we have auth token for authenticated requests
    if (!authToken && currentUser && !endpoint.includes('health')) {
        try {
            authToken = await currentUser.getIdToken(true);
            console.log('🔑 Token refreshed for API call');
        } catch (error) {
            console.error('❌ Failed to refresh token:', error);
            throw new Error('Authentication token expired. Please log in again.');
        }
    }

    // Build headers
    const defaultHeaders = {};
    if (authToken) {
        defaultHeaders['Authorization'] = `Bearer ${authToken}`;
    }
    if (!(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
    }

    const finalOptions = {
        method: options.method || 'GET',
        ...options,
        headers: {
            ...defaultHeaders,
            ...(options.headers || {})
        },
        credentials: 'include',
        mode: 'cors'
    };

    try {
        console.log(`📤 API Call [${finalOptions.method}]: ${url}`);
        
        const response = await fetch(url, finalOptions);
        console.log(`📥 Response: ${response.status} ${response.statusText}`);

        const contentType = response.headers.get('content-type');
        let responseData;

        if (contentType && contentType.includes('application/json')) {
            const responseText = await response.text();
            try {
                responseData = responseText ? JSON.parse(responseText) : {};
            } catch (parseError) {
                console.error('❌ JSON parse error:', parseError);
                throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
            }
        } else {
            responseData = await response.text();
        }

        if (!response.ok) {
            if (response.status === 401 && currentUser && retryCount === 0) {
                console.log('🔄 Token expired, refreshing...');
                authToken = await currentUser.getIdToken(true);
                return await apiCall(endpoint, options, retryCount + 1);
            }

            const errorMessage = responseData.message || responseData.error || `Request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }

        console.log('✅ API call successful');
        return responseData;

    } catch (error) {
        console.error(`❌ API call to ${endpoint} failed:`, error);

        // Retry on network errors
        if ((error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) && retryCount < MAX_RETRIES) {
            console.warn(`⚠️ Network error, retrying in ${RETRY_DELAY}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return await apiCall(endpoint, options, retryCount + 1);
        }

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            throw new Error(
                `Cannot connect to backend:\n${BACKEND_URL}\n\n` +
                `Possible causes:\n` +
                `• Backend is not deployed to Render\n` +
                `• Backend URL is incorrect (check Render dashboard)\n` +
                `• CORS is blocking the request\n` +
                `• Backend is starting up (wait 30-60 seconds)\n\n` +
                `Open ${BACKEND_URL}/health in a new tab to verify.`
            );
        }

        throw error;
    }
}

// ============================================
// DIAGNOSTIC UTILITIES
// ============================================

async function runDiagnostics() {
    const resultsDiv = document.getElementById('diagnosticResults');
    resultsDiv.innerHTML = '<p>Running diagnostics...</p>';
    
    const results = [];
    
    // Test 1: Frontend info
    results.push({
        test: 'Frontend Configuration',
        status: 'info',
        message: `URL: ${window.location.origin}\nBackend: ${BACKEND_URL}\nLogged in: ${!!currentUser}`
    });
    
    // Test 2: Backend root
    try {
        const response = await fetch(BACKEND_URL, { mode: 'cors' });
        const data = await response.json();
        results.push({
            test: 'Backend Root',
            status: 'success',
            message: `Status: ${response.status}\n${JSON.stringify(data, null, 2)}`
        });
    } catch (error) {
        results.push({
            test: 'Backend Root',
            status: 'error',
            message: `Failed: ${error.message}`
        });
    }
    
    // Test 3: Health endpoint
    try {
        const response = await fetch(`${BACKEND_URL}/health`, { mode: 'cors' });
        const data = await response.json();
        results.push({
            test: 'Health Endpoint',
            status: data.status === 'OK' ? 'success' : 'warning',
            message: `Status: ${response.status}\n${JSON.stringify(data, null, 2)}`
        });
    } catch (error) {
        results.push({
            test: 'Health Endpoint',
            status: 'error',
            message: `Failed: ${error.message}`
        });
    }
    
    // Test 4: CORS
    try {
        const response = await fetch(`${BACKEND_URL}/api/dashboard`, {
            method: 'OPTIONS',
            mode: 'cors',
            headers: {
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'content-type,authorization'
            }
        });
        
        const corsHeaders = {
            origin: response.headers.get('access-control-allow-origin'),
            methods: response.headers.get('access-control-allow-methods')
        };
        
        results.push({
            test: 'CORS Configuration',
            status: corsHeaders.origin ? 'success' : 'warning',
            message: JSON.stringify(corsHeaders, null, 2)
        });
    } catch (error) {
        results.push({
            test: 'CORS Configuration',
            status: 'error',
            message: `Failed: ${error.message}`
        });
    }
    
    // Render results
    resultsDiv.innerHTML = results.map(r => `
        <div class="diagnostic-item ${r.status}">
            <strong>${r.test}</strong>
            <pre style="margin-top: 0.5rem; white-space: pre-wrap;">${r.message}</pre>
        </div>
    `).join('');
    
    console.log('Diagnostic results:', results);
}

// ============================================
// UI UTILITIES
// ============================================

function showLoading() { 
    document.getElementById('loadingSpinner').style.display = 'flex'; 
}

function hideLoading() { 
    document.getElementById('loadingSpinner').style.display = 'none'; 
}

function showMessage(message, type = 'info') { 
    const container = document.getElementById('authMessages'); 
    if (container) {
        container.innerHTML = `<div class="${type}-message">${message}</div>`; 
    }
}

function clearMessages() { 
    const container = document.getElementById('authMessages'); 
    if (container) container.innerHTML = ''; 
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
        
        console.log('🔐 Attempting login for:', email);
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('✅ Login successful');
        
        // Get fresh token
        authToken = await userCredential.user.getIdToken(true);
        console.log('✅ Token obtained');
        
        // Auth state changed will handle the rest
    } catch (error) { 
        console.error('❌ Login error:', error);
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
// APP INITIALIZATION
// ============================================

function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('mainContent').innerHTML = `
        <h1>Welcome, ${currentUser.displayName || currentUser.email}!</h1>
        <p>Role: ${currentUserRole}</p>
        <p>Your dashboard will load here...</p>
        <button onclick="logout()" class="btn btn-primary">Logout</button>
    `;
}

function showLogin() { 
    document.getElementById('appContainer').style.display = 'none'; 
    document.getElementById('loginPage').style.display = 'flex'; 
    clearMessages(); 
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Application starting...');
    console.log('Backend URL:', BACKEND_URL);
    
    // Test backend connection immediately
    const connected = await testBackendConnection();
    
    if (!connected) {
        console.error('⚠️ WARNING: Cannot connect to backend!');
        console.error('Please check:');
        console.error('1. Backend is deployed to Render');
        console.error('2. Backend URL is correct:', BACKEND_URL);
        console.error('3. Backend is not sleeping (wait 30-60s)');
    }
    
    // Setup form handler
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Setup auth state listener
    auth.onAuthStateChanged(async (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        
        if (user) {
            currentUser = user;
            try {
                console.log('Getting fresh auth token...');
                authToken = await user.getIdToken(true);
                console.log('✅ Token obtained');
                
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (userDoc.exists) {
                    currentUserRole = userDoc.data().role;
                    console.log('User role:', currentUserRole);
                    showApp();
                } else {
                    console.error('User document not found');
                    await auth.signOut();
                    showMessage('User account not found. Please contact administrator.', 'error');
                }
            } catch (error) { 
                console.error('Auth initialization error:', error); 
                showMessage('Failed to initialize session: ' + error.message, 'error'); 
                await auth.signOut();
            }
        } else {
            currentUser = null; 
            currentUserRole = ''; 
            authToken = ''; 
            showLogin();
        }
    });
    
    // Token refresh every 50 minutes
    setInterval(async () => {
        if (currentUser) {
            try {
                authToken = await currentUser.getIdToken(true);
                console.log('🔄 Token auto-refreshed');
            } catch (error) {
                console.error('Token refresh failed:', error);
            }
        }
    }, 50 * 60 * 1000);
});

// ============================================
// GLOBAL EXPORTS
// ============================================

window.runDiagnostics = runDiagnostics;
window.logout = logout;
