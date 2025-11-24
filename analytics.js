// ============================================
// EBTRACKER ANALYTICS DASHBOARD (V2)
// This file is loaded by index.html
// It provides analytics for BDM, COO, and Director roles.
// ============================================

// Chart.js Global Colors
const CHART_COLORS = {
    blue: 'rgba(0, 191, 255, 0.7)',
    darkBlue: 'rgba(0, 153, 204, 1)',
    green: 'rgba(39, 174, 96, 0.7)',
    red: 'rgba(231, 76, 60, 0.7)',
    yellow: 'rgba(243, 156, 18, 0.7)',
    grey: 'rgba(127, 140, 141, 0.7)',
    purple: 'rgba(155, 89, 182, 0.7)',
    orange: 'rgba(230, 126, 34, 0.7)',
};

let analyticsCharts = {}; // Global object to hold Chart.js instances

/**
 * Main function to show the Analytics Dashboard.
 * This is called by the 'Analytics' link in the nav menu.
 */
async function showAnalyticsDashboard() {
    setActiveNav('nav-analytics'); // Assumes setActiveNav is global in index.html
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    showLoading(); // Assumes showLoading is global

    try {
        // 1. Render the dashboard UI skeleton
        // The HTML skeleton is now dynamic based on role
        renderAnalyticsDashboardUI(currentUserRole);

        // 2. Load and process data
        await loadAnalyticsData(currentUserRole);

    } catch (error) {
        console.error("❌ Error loading analytics:", error);
        document.getElementById('analyticsDashboard').innerHTML = `
            <div class="error-message">
                <h2>Error Loading Dashboard</h2>
                <p>An error occurred: ${error.message}</p>
                <p>Please check the console for details, or verify your data sources.</p>
            </div>
        `;
    } finally {
        hideLoading(); // Assumes hideLoading is global
    }
}

/**
 * Renders the initial HTML structure for the analytics dashboard based on the user's role.
 */
function renderAnalyticsDashboardUI(role) {
    const main = document.getElementById('mainContent');
    const isBDM = role === 'bdm';

    // Base dashboard structure
    let html = `
        <div class="page-header">
            <h2>📈 Analytics Dashboard</h2>
            <p class="subtitle">Key performance indicators for ${role.toUpperCase()} role.</p>
        </div>
        <div id="analyticsDashboard" class="analytics-layout">
            
            <div class="analytics-card kpi-card">
                <h3>Total Revenue Generated</h3>
                <p id="kpiTotalRevenue" class="kpi-value">...</p>
            </div>
            <div class="analytics-card kpi-card">
                <h3>Total Proposals Won</h3>
                <p id="kpiProposalsWon" class="kpi-value">...</p>
            </div>
            <div class="analytics-card kpi-card">
                <h3>Win Rate (Proposals)</h3>
                <p id="kpiWinRate" class="kpi-value">...</p>
            </div>
            
            <div class="analytics-card chart-container">
                <h3>Revenue by Month</h3>
                <canvas id="monthlyRevenueChart"></canvas>
            </div>
    `;

    // Non-BDM specific charts (COO/Director)
    if (!isBDM) {
        html += `
            <div class="analytics-card kpi-card">
                <h3>Avg. Proposal Value</h3>
                <p id="kpiAvgValue" class="kpi-value">...</p>
            </div>
            <div class="analytics-card kpi-card">
                <h3>Avg. Time to Close</h3>
                <p id="kpiAvgCloseTime" class="kpi-value">...</p>
            </div>
            <div class="analytics-card kpi-card">
                <h3>Pending Proposals Value</h3>
                <p id="kpiPendingValue" class="kpi-value">...</p>
            </div>
            
            <div class="analytics-card chart-container full-width">
                <h3>Revenue by Week</h3>
                <canvas id="weeklyRevenueChart"></canvas>
            </div>
            
            <div class="analytics-card chart-container">
                <h3>Proposals by Status</h3>
                <canvas id="statusPieChart"></canvas>
            </div>
            
            <div class="analytics-card chart-container">
                <h3>Revenue by BDM</h3>
                <canvas id="bdmRevenueChart"></canvas>
            </div>
        `;
    }

    html += `</div>`;
    main.innerHTML = html;
}

/**
 * Fetches data and updates the dashboard.
 */
async function loadAnalyticsData(role) {
    const isBDM = role === 'bdm';
    const currentUserId = currentUser.uid;

    // 1. Fetch Proposals (All for management, filtered for BDM)
    let url = 'proposals/all-with-projects';
    if (isBDM) {
        url = `proposals?bdmId=${currentUserId}`;
    }
    
    const response = await apiCall(url);
    if (!response.success) {
        throw new Error(response.error || 'Failed to fetch proposal data.');
    }

    const proposals = response.data || [];
    const wonProposals = proposals.filter(p => p.status === 'Won' && p.pricing?.quoteValue > 0);
    const totalProposals = proposals.length;
    const lostProposals = proposals.filter(p => p.status === 'Lost');
    const pendingProposals = proposals.filter(p => p.status === 'Pending' || p.status === 'Draft' || p.status === 'Sent');
    
    // ============================================
    // 2. CALCULATE KPIS
    // ============================================

    const totalRevenue = wonProposals.reduce((sum, p) => sum + (p.pricing?.quoteValue || 0), 0);
    const winRate = totalProposals > 0 ? (wonProposals.length / totalProposals) * 100 : 0;
    const avgProposalValue = wonProposals.length > 0 ? totalRevenue / wonProposals.length : 0;
    const pendingValue = pendingProposals.reduce((sum, p) => sum + (p.pricing?.quoteValue || 0), 0);
    
    // Update KPI cards
    document.getElementById('kpiTotalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('kpiProposalsWon').textContent = wonProposals.length;
    document.getElementById('kpiWinRate').textContent = `${winRate.toFixed(1)}%`;
    
    if (!isBDM) {
        document.getElementById('kpiAvgValue').textContent = formatCurrency(avgProposalValue);
        document.getElementById('kpiPendingValue').textContent = formatCurrency(pendingValue);
    }
    
    // ============================================
    // 3. MONTHLY REVENUE CALCULATION
    // ============================================
    const monthlyRevenue = initializeMonthlyData(6); // Last 6 months
    
    // --- Monthly Revenue Loop (FIXED) ---
    wonProposals.forEach(p => {
        let date;
        // Use wonDate, or fallback to updatedAt/createdAt for date
        if (p.wonDate) {
            date = new Date(p.wonDate.seconds ? p.wonDate.seconds * 1000 : p.wonDate);
        } else if (p.updatedAt) {
            date = new Date(p.updatedAt.seconds ? p.updatedAt.seconds * 1000 : p.updatedAt);
        }

        // FIX: Ensure date is valid before using it
        if (date && !isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const label = `${year}-${month}`;
            if (monthlyRevenue.hasOwnProperty(label)) {
                monthlyRevenue[label] += (p.pricing?.quoteValue || 0);
            }
        }
    });

    // 4. RENDER MONTHLY REVENUE CHART
    renderRevenueChart(
        'monthlyRevenueChart', 
        Object.keys(monthlyRevenue).map(label => formatMonthLabel(label)), 
        Object.values(monthlyRevenue), 
        'Monthly Revenue'
    );
    
    // ============================================
    // 5. COO/DIRECTOR SPECIFIC ANALYTICS
    // ============================================

    if (!isBDM) {
        
        // --- WEEKLY REVENUE CALCULATION ---
        const weeklyRevenue = initializeWeeklyData(12); // Last 12 weeks
        
        // --- Weekly Revenue Loop (FIXED with Date Validation) ---
        wonProposals.forEach(p => {
            let date;
            if (p.wonDate) {
                // Handle Firestore Timestamp or ISO string
                date = new Date(p.wonDate.seconds ? p.wonDate.seconds * 1000 : p.wonDate);
            }
            
            // FIX: Add robust date validation to prevent RangeError
            if (date && !isNaN(date.getTime())) {
                const weekStart = getWeekStartDate(date);
                if (weeklyRevenue.hasOwnProperty(weekStart)) {
                    weeklyRevenue[weekStart] += (p.pricing?.quoteValue || 0);
                }
            }
        });

        // RENDER WEEKLY REVENUE CHART
        renderRevenueChart(
            'weeklyRevenueChart', 
            Object.keys(weeklyRevenue).map(date => formatWeekLabel(date)), 
            Object.values(weeklyRevenue), 
            'Weekly Revenue'
        );
        
        // --- STATUS PIE CHART CALCULATION ---
        const statusCounts = {
            'Won': wonProposals.length,
            'Lost': lostProposals.length,
            'Pending/Draft': pendingProposals.length
        };

        renderPieChart('statusPieChart', statusCounts, 'Proposal Status Distribution');

        // --- BDM REVENUE CALCULATION ---
        const bdmRevenue = {};
        wonProposals.forEach(p => {
            const bdmName = p.bdmName || 'Unassigned';
            const revenue = p.pricing?.quoteValue || 0;
            bdmRevenue[bdmName] = (bdmRevenue[bdmName] || 0) + revenue;
        });

        renderBarChart('bdmRevenueChart', bdmRevenue, 'Revenue by BDM');
        
        // --- AVG TIME TO CLOSE CALCULATION ---
        const closeTimes = wonProposals
            .filter(p => p.createdAt && p.wonDate)
            .map(p => {
                const created = new Date(p.createdAt.seconds ? p.createdAt.seconds * 1000 : p.createdAt);
                const won = new Date(p.wonDate.seconds ? p.wonDate.seconds * 1000 : p.wonDate);
                // Difference in days
                return (won.getTime() - created.getTime()) / (1000 * 3600 * 24); 
            });
            
        const avgCloseTime = closeTimes.length > 0 ? closeTimes.reduce((a, b) => a + b) / closeTimes.length : 0;
        document.getElementById('kpiAvgCloseTime').textContent = `${avgCloseTime.toFixed(1)} days`;
    }
}


// ============================================
// CHART RENDERING FUNCTIONS
// ============================================

function renderRevenueChart(canvasId, labels, data, title) {
    const ctx = document.getElementById(canvasId);
    
    // Destroy previous chart instance if it exists
    if (analyticsCharts[canvasId]) {
        analyticsCharts[canvasId].destroy();
    }
    
    analyticsCharts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue',
                data: data,
                backgroundColor: CHART_COLORS.blue,
                borderColor: CHART_COLORS.darkBlue,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: title },
                tooltip: { callbacks: { label: (context) => formatTooltipAsCurrency(context, 'Revenue') } }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Value (USD)' } }
            }
        }
    });
}

function renderPieChart(canvasId, data, title) {
    const ctx = document.getElementById(canvasId);
    const labels = Object.keys(data);
    const values = Object.values(data);
    const colors = [CHART_COLORS.green, CHART_COLORS.red, CHART_COLORS.grey];

    if (analyticsCharts[canvasId]) {
        analyticsCharts[canvasId].destroy();
    }

    analyticsCharts[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Proposals',
                data: values,
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: title },
                tooltip: { callbacks: { label: (context) => `${context.label}: ${context.parsed}` } }
            }
        }
    });
}

function renderBarChart(canvasId, data, title) {
    const ctx = document.getElementById(canvasId);
    const labels = Object.keys(data);
    const values = Object.values(data);
    
    // Randomize colors for visual distinction
    const colors = labels.map((_, i) => Object.values(CHART_COLORS)[i % Object.values(CHART_COLORS).length]);

    if (analyticsCharts[canvasId]) {
        analyticsCharts[canvasId].destroy();
    }

    analyticsCharts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Revenue',
                data: values,
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'none' },
                title: { display: true, text: title },
                tooltip: { callbacks: { label: (context) => formatTooltipAsCurrency(context, context.label) } }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Value (USD)' } }
            }
        }
    });
}


// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Helper to get the start of the week (Monday) for a given date
 */
function getWeekStartDate(d) {
    const date = new Date(d);
    const day = date.getDay();
    // 0 = Sunday, 1 = Monday. Calculate the difference to Monday.
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(date.setDate(diff));
    // Return date in YYYY-MM-DD format
    return monday.toISOString().split('T')[0]; 
}

/**
 * Helper to initialize data structure for the last N months.
 */
function initializeMonthlyData(months) {
    const data = {};
    const now = new Date();
    for (let i = 0; i < months; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        data[`${year}-${month}`] = 0;
    }
    // Reverse the keys to ensure charts are ordered chronologically
    return Object.keys(data).sort().reduce((obj, key) => {
        obj[key] = data[key];
        return obj;
    }, {});
}

/**
 * Helper to initialize data structure for the last N weeks.
 */
function initializeWeeklyData(weeks) {
    const data = {};
    const now = new Date();
    for (let i = 0; i < weeks; i++) {
        // Calculate the Monday of the current week (i=0 is this week, i=1 is last week)
        const date = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const weekStart = getWeekStartDate(date);
        data[weekStart] = 0;
    }
    // Reverse the keys to ensure charts are ordered chronologically
    return Object.keys(data).sort().reduce((obj, key) => {
        obj[key] = data[key];
        return obj;
    }, {});
}

/**
 * Helper to format a YYYY-MM label into something readable.
 */
function formatMonthLabel(label) {
    const [year, month] = label.split('-');
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Helper to format a YYYY-MM-DD week start date for chart labels.
 */
function formatWeekLabel(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Helper to format Chart.js tooltips as currency
 */
function formatTooltipAsCurrency(context, labelPrefix = '') {
    let label = labelPrefix || context.dataset.label || '';
    if (label) {
        label += ': ';
    }
    if (context.parsed.y !== null) {
        label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
    } else if (context.raw !== null) {
        label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.raw);
    }
    return label;
}

/**
 * Helper to format a number as currency
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}
