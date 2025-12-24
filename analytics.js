// ============================================
// EBTRACKER ANALYTICS DASHBOARD (V3 - Apple Style)
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

/**
 * Format number in compact Apple-style (e.g., $66.5K, $1.2M)
 */
function formatCompactCurrency(value) {
    if (value >= 1000000) {
        return '$' + (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
        return '$' + (value / 1000).toFixed(1) + 'K';
    } else {
        return '$' + value.toFixed(0);
    }
}

/**
 * Format full currency for tooltips
 */
function formatFullCurrency(value) {
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        maximumFractionDigits: 0 
    }).format(value);
}

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
        main.innerHTML = getAnalyticsHTML(currentUserRole);

        // 2. Inject Apple-style CSS
        injectAnalyticsStyles();

        // 3. Fetch and process the data
        const analyticsData = await loadAnalyticsData(currentUserRole);

        // 4. Render the KPI cards with animation
        renderKpiCards(analyticsData.kpis, currentUserRole);

        // 5. Render the base charts (Monthly Revenue & Status)
        renderMonthlyRevenueChart(analyticsData.monthlyRevenue);
        renderStatusPieChart(analyticsData.statusCounts);

        // 6. Render COO/Director charts if data exists for them
        if (currentUserRole !== 'bdm') {
            if (analyticsData.bdmPerformance) {
                renderBdmPerformanceChart(analyticsData.bdmPerformance);
            }
            if (analyticsData.weeklyRevenue) {
                renderWeeklyRevenueChart(analyticsData.weeklyRevenue);
            }
            if (analyticsData.regionalData) {
                renderRegionalPieChart(analyticsData.regionalData);
            }
        }

    } catch (error) {
        console.error('❌ Error loading analytics:', error);
        main.innerHTML = `<div class="error-message"><h3>Error Loading Analytics</h3><p>${error.message}</p></div>`;
    } finally {
        hideLoading(); // Assumes hideLoading is global
    }
}

/**
 * Inject Apple-style CSS for analytics cards
 */
function injectAnalyticsStyles() {
    // Remove existing style if present
    const existingStyle = document.getElementById('analytics-apple-style');
    if (existingStyle) existingStyle.remove();

    const style = document.createElement('style');
    style.id = 'analytics-apple-style';
    style.textContent = `
        /* ============================== */
        /* APPLE-STYLE KPI CARDS */
        /* ============================== */
        
        .analytics-kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1.25rem;
            margin-bottom: 2.5rem;
        }
        
        .kpi-card {
            background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
            border-radius: 20px;
            padding: 1.5rem;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.8);
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            position: relative;
            overflow: visible;
            backdrop-filter: blur(10px);
        }
        
        .kpi-card:hover {
            transform: translateY(-6px) scale(1.02);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
        }
        
        .kpi-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--card-accent, #3b82f6), var(--card-accent-end, #60a5fa));
            border-radius: 20px 20px 0 0;
        }
        
        .kpi-icon {
            width: 48px;
            height: 48px;
            margin: 0 auto 1rem;
            background: linear-gradient(135deg, var(--icon-bg, #dbeafe) 0%, var(--icon-bg-end, #bfdbfe) 100%);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }
        
        .kpi-value {
            font-size: clamp(1.75rem, 4vw, 2.5rem);
            font-weight: 700;
            color: var(--value-color, #1e3a8a);
            line-height: 1.1;
            margin-bottom: 0.5rem;
            letter-spacing: -0.02em;
            white-space: nowrap;
        }
        
        .kpi-value-full {
            font-size: 0.75rem;
            color: #64748b;
            font-weight: 500;
            margin-bottom: 0.75rem;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .kpi-card:hover .kpi-value-full {
            opacity: 1;
        }
        
        .kpi-label {
            font-size: 0.8rem;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        /* Color variants */
        .kpi-card.revenue {
            --card-accent: #3b82f6;
            --card-accent-end: #60a5fa;
            --icon-bg: #dbeafe;
            --icon-bg-end: #bfdbfe;
            --value-color: #1e40af;
        }
        
        .kpi-card.avg-revenue {
            --card-accent: #8b5cf6;
            --card-accent-end: #a78bfa;
            --icon-bg: #ede9fe;
            --icon-bg-end: #ddd6fe;
            --value-color: #6d28d9;
        }
        
        .kpi-card.win-rate {
            --card-accent: #10b981;
            --card-accent-end: #34d399;
            --icon-bg: #d1fae5;
            --icon-bg-end: #a7f3d0;
            --value-color: #047857;
        }
        
        .kpi-card.total {
            --card-accent: #f59e0b;
            --card-accent-end: #fbbf24;
            --icon-bg: #fef3c7;
            --icon-bg-end: #fde68a;
            --value-color: #b45309;
        }
        
        .kpi-card.won {
            --card-accent: #10b981;
            --card-accent-end: #34d399;
            --icon-bg: #d1fae5;
            --icon-bg-end: #a7f3d0;
            --value-color: #047857;
        }
        
        .kpi-card.lost {
            --card-accent: #ef4444;
            --card-accent-end: #f87171;
            --icon-bg: #fee2e2;
            --icon-bg-end: #fecaca;
            --value-color: #b91c1c;
        }
        
        /* Animation */
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .kpi-card {
            animation: slideUp 0.5s ease forwards;
        }
        
        .kpi-card:nth-child(1) { animation-delay: 0.05s; }
        .kpi-card:nth-child(2) { animation-delay: 0.1s; }
        .kpi-card:nth-child(3) { animation-delay: 0.15s; }
        .kpi-card:nth-child(4) { animation-delay: 0.2s; }
        .kpi-card:nth-child(5) { animation-delay: 0.25s; }
        .kpi-card:nth-child(6) { animation-delay: 0.3s; }
        
        /* Responsive Design */
        @media (max-width: 1200px) {
            .analytics-kpi-grid {
                grid-template-columns: repeat(3, 1fr);
            }
        }
        
        @media (max-width: 900px) {
            .analytics-kpi-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .kpi-value {
                font-size: clamp(1.5rem, 5vw, 2rem);
            }
        }
        
        @media (max-width: 480px) {
            .analytics-kpi-grid {
                grid-template-columns: 1fr;
                gap: 1rem;
            }
            
            .kpi-card {
                padding: 1.25rem;
            }
            
            .kpi-value {
                font-size: 1.75rem;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Returns the HTML skeleton for the analytics dashboard,
 * dynamically adding chart containers for COO/Director.
 */
function getAnalyticsHTML(role) {
    const isDirectorView = role === 'coo' || role === 'director';
    const title = isDirectorView ? '📊 Company Analytics Dashboard' : '📈 My BDM Analytics';

    // Add extra containers for director charts
    const directorCharts = `
        <div class="action-section">
            <h3>BDM Performance (Won Revenue)</h3>
            <div style="position: relative; height: 350px;">
                <canvas id="bdmPerformanceChart"></canvas>
            </div>
        </div>

        <div class="action-section">
            <h3>Regional Business (Won Revenue)</h3>
            <div style="position: relative; height: 350px; display: flex; align-items: center; justify-content: center;">
                <canvas id="regionalPieChart" style="max-height: 350px; max-width: 350px;"></canvas>
            </div>
        </div>

        <div class="action-section">
            <h3>Weekly Revenue (Last 16 Weeks)</h3>
            <div style="position: relative; height: 350px;">
                <canvas id="weeklyRevenueChart"></canvas>
            </div>
        </div>
    `;

    return `
        <div class="page-header">
            <h2>${title}</h2>
            <div class="subtitle">Insights on proposals and revenue</div>
        </div>
        
        <div class="analytics-kpi-grid" id="bdm-kpi-cards">
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem; margin-top: 2rem;">
            
            <div class="action-section">
                <h3>Monthly Revenue (Last 12 Months)</h3>
                <div style="position: relative; height: 350px;">
                    <canvas id="monthlyRevenueChart"></canvas>
                </div>
            </div>

            <div class="action-section">
                <h3>Proposal Status Breakdown</h3>
                <div style="position: relative; height: 350px; display: flex; align-items: center; justify-content: center;">
                    <canvas id="statusPieChart" style="max-height: 350px; max-width: 350px;"></canvas>
                </div>
            </div>

            ${isDirectorView ? directorCharts : ''}
        </div>
    `;
}

/**
 * Fetches and processes all proposal data.
 * - If role is 'bdm', it filters for their proposals.
 * - If role is 'coo' or 'director', it processes all proposals.
 */
async function loadAnalyticsData(role) {
    const response = await apiCall('proposals');
    if (!response.success || !response.data) {
        throw new Error('Failed to fetch proposal data');
    }

    let proposals;
    if (role === 'bdm') {
        // BDM view: Filter for their own proposals
        proposals = response.data.filter(p => p.createdByUid === currentUser.uid);
    } else {
        // COO/Director view: Use all proposals
        proposals = response.data;
    }

    // --- Process KPIs ---
    const wonProposals = proposals.filter(p => p.status === 'won');
    const lostProposals = proposals.filter(p => p.status === 'lost');
    
    const totalRevenue = wonProposals.reduce((sum, p) => sum + (p.pricing?.quoteValue || 0), 0);
    const totalWon = wonProposals.length;
    const totalLost = lostProposals.length;
    const totalProposals = proposals.length;
    const winRate = (totalWon + totalLost) > 0 ? (totalWon / (totalWon + totalLost)) * 100 : 0;
    const avgDealValue = totalWon > 0 ? totalRevenue / totalWon : 0;

    const kpis = {
        totalRevenue,
        totalProposals,
        winRate,
        avgDealValue,
        totalWon,
        totalLost
    };

    // --- Process Monthly Revenue (Bar Chart) ---
    const monthlyRevenue = {};
    const labels = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const label = `${year}-${month}`;
        labels.push(label);
        monthlyRevenue[label] = 0;
    }

    wonProposals.forEach(p => {
        let date;
        if (p.wonDate) {
             date = new Date(p.wonDate.seconds ? p.wonDate.seconds * 1000 : p.wonDate);
        } else if (p.updatedAt) {
             date = new Date(p.updatedAt.seconds ? p.updatedAt.seconds * 1000 : p.updatedAt);
        }

        // FIX 1: Check if date is a valid Date object before processing
        if (date && !isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const label = `${year}-${month}`;
            if (monthlyRevenue.hasOwnProperty(label)) {
                monthlyRevenue[label] += (p.pricing?.quoteValue || 0);
            }
        }
    });

    // --- Process Status Counts (Pie Chart) ---
    const statusCounts = {
        Won: 0,
        Lost: 0,
        Pending: 0, // Submitted, Approved
        Pricing: 0, // Estimated, Pricing
        Draft: 0    // Draft, Rejected
    };

    proposals.forEach(p => {
        switch (p.status) {
            case 'won':
                statusCounts.Won++;
                break;
            case 'lost':
                statusCounts.Lost++;
                break;
            case 'submitted_to_client':
            case 'approved':
                statusCounts.Pending++;
                break;
            case 'estimated':
            case 'pricing_complete':
            case 'pending_director_approval':
                statusCounts.Pricing++;
                break;
            case 'draft':
            case 'rejected':
            default:
                statusCounts.Draft++;
                break;
        }
    });

    // --- Process COO/Director Data ---
    let bdmPerformance = null, weeklyRevenue = null, regionalData = null;

    if (role !== 'bdm') {
        // 1. BDM Performance
        bdmPerformance = {};
        wonProposals.forEach(p => {
            const bdmName = p.createdByName || 'Unknown';
            if (!bdmPerformance[bdmName]) {
                bdmPerformance[bdmName] = 0;
            }
            bdmPerformance[bdmName] += (p.pricing?.quoteValue || 0);
        });

        // 2. Weekly Revenue
        weeklyRevenue = {};
        const weekLabels = [];
        const today = new Date();
        for (let i = 15; i >= 0; i--) { // Last 16 weeks
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (i * 7));
            const weekStart = getWeekStartDate(d);
            if (!weekLabels.includes(weekStart)) {
                weekLabels.push(weekStart);
                weeklyRevenue[weekStart] = 0;
            }
        }
        wonProposals.forEach(p => {
            let date;
            if (p.wonDate) {
                date = new Date(p.wonDate.seconds ? p.wonDate.seconds * 1000 : p.wonDate);
            }
            // FIX 2: Check if date is a valid Date object before calling getWeekStartDate (RangeError fix)
            if (date && !isNaN(date.getTime())) {
                const weekStart = getWeekStartDate(date);
                if (weeklyRevenue.hasOwnProperty(weekStart)) {
                    weeklyRevenue[weekStart] += (p.pricing?.quoteValue || 0);
                }
            }
        });
        
        // 3. Regional Data
        regionalData = {};
        wonProposals.forEach(p => {
            let region = p.country || 'Unknown';
            if (region === "") {
                region = "Unknown";
            }
            if (!regionalData[region]) {
                regionalData[region] = 0;
            }
            regionalData[region] += (p.pricing?.quoteValue || 0);
        });
    }

    return { kpis, monthlyRevenue, statusCounts, bdmPerformance, weeklyRevenue, regionalData };
}

/**
 * Renders the KPI cards with Apple-style design
 */
function renderKpiCards(kpis, role) {
    const container = document.getElementById('bdm-kpi-cards');
    
    // BDM-specific KPIs
    let bdmCards = `
        <div class="kpi-card total">
            <div class="kpi-icon">📋</div>
            <div class="kpi-value">${kpis.totalProposals}</div>
            <div class="kpi-label">Total Proposals</div>
        </div>
        <div class="kpi-card won">
            <div class="kpi-icon">🏆</div>
            <div class="kpi-value">${kpis.totalWon}</div>
            <div class="kpi-label">Proposals Won</div>
        </div>
        <div class="kpi-card lost">
            <div class="kpi-icon">📉</div>
            <div class="kpi-value">${kpis.totalLost}</div>
            <div class="kpi-label">Proposals Lost</div>
        </div>
        <div class="kpi-card win-rate">
            <div class="kpi-icon">📊</div>
            <div class="kpi-value">${kpis.winRate.toFixed(1)}%</div>
            <div class="kpi-label">Win Rate</div>
        </div>
        <div class="kpi-card revenue">
            <div class="kpi-icon">💰</div>
            <div class="kpi-value">${formatCompactCurrency(kpis.totalRevenue)}</div>
            <div class="kpi-value-full">${formatFullCurrency(kpis.totalRevenue)}</div>
            <div class="kpi-label">Total Revenue (Won)</div>
        </div>
        <div class="kpi-card avg-revenue">
            <div class="kpi-icon">💵</div>
            <div class="kpi-value">${formatCompactCurrency(kpis.avgDealValue)}</div>
            <div class="kpi-value-full">${formatFullCurrency(kpis.avgDealValue)}</div>
            <div class="kpi-label">Avg. Revenue (Won)</div>
        </div>
    `;

    // COO/Director has a slightly different focus
    let directorCards = `
        <div class="kpi-card revenue">
            <div class="kpi-icon">💰</div>
            <div class="kpi-value">${formatCompactCurrency(kpis.totalRevenue)}</div>
            <div class="kpi-value-full">${formatFullCurrency(kpis.totalRevenue)}</div>
            <div class="kpi-label">Total Revenue (Won)</div>
        </div>
        <div class="kpi-card avg-revenue">
            <div class="kpi-icon">💵</div>
            <div class="kpi-value">${formatCompactCurrency(kpis.avgDealValue)}</div>
            <div class="kpi-value-full">${formatFullCurrency(kpis.avgDealValue)}</div>
            <div class="kpi-label">Avg. Revenue (Won)</div>
        </div>
        <div class="kpi-card win-rate">
            <div class="kpi-icon">📊</div>
            <div class="kpi-value">${kpis.winRate.toFixed(1)}%</div>
            <div class="kpi-label">Company Win Rate</div>
        </div>
        <div class="kpi-card total">
            <div class="kpi-icon">📋</div>
            <div class="kpi-value">${kpis.totalProposals}</div>
            <div class="kpi-label">Total Proposals</div>
        </div>
    `;

    container.innerHTML = (role === 'bdm') ? bdmCards : directorCards;
}

/**
 * Renders the Monthly Revenue bar chart
 */
function renderMonthlyRevenueChart(monthlyRevenue) {
    const ctx = document.getElementById('monthlyRevenueChart').getContext('2d');
    
    const displayLabels = Object.keys(monthlyRevenue).map(label => {
        const [year, month] = label.split('-');
        const date = new Date(year, month - 1, 1);
        return date.toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Revenue',
                data: Object.values(monthlyRevenue),
                backgroundColor: CHART_COLORS.blue,
                borderColor: CHART_COLORS.darkBlue,
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000) + 'k';
                        }
                    }
                },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => formatTooltipAsCurrency(context) } }
            }
        }
    });
}

/**
 * Renders the Proposal Status pie chart
 */
function renderStatusPieChart(statusCounts) {
    const ctx = document.getElementById('statusPieChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                label: 'Proposal Status',
                data: Object.values(statusCounts),
                backgroundColor: [
                    CHART_COLORS.green,
                    CHART_COLORS.red,
                    CHART_COLORS.blue,
                    CHART_COLORS.yellow,
                    CHART_COLORS.grey
                ],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            let value = context.raw || 0;
                            return ` ${label}: ${value}`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renders the BDM Performance bar chart (COO/Director only)
 */
function renderBdmPerformanceChart(bdmData) {
    const ctx = document.getElementById('bdmPerformanceChart').getContext('2d');
    
    // Sort BDMs by performance
    const sortedData = Object.entries(bdmData).sort(([, a], [, b]) => b - a);
    const labels = sortedData.map(item => item[0]);
    const data = sortedData.map(item => item[1]);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue Won',
                data: data,
                backgroundColor: [ // Using an array of colors
                    CHART_COLORS.green,
                    CHART_COLORS.blue,
                    CHART_COLORS.yellow,
                    CHART_COLORS.purple,
                    CHART_COLORS.orange,
                    CHART_COLORS.red,
                    CHART_COLORS.grey
                ],
                borderColor: '#ffffff', // Matching pie chart style
                borderWidth: 2,         // Matching pie chart style
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000) + 'k';
                        }
                    }
                },
                y: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => formatTooltipAsCurrency(context) } }
            }
        }
    });
}

/**
 * Renders the Weekly Revenue line chart (COO/Director only)
 */
function renderWeeklyRevenueChart(weeklyData) {
    const ctx = document.getElementById('weeklyRevenueChart').getContext('2d');
    
    const displayLabels = Object.keys(weeklyData).map(label => {
        const [year, month, day] = label.split('-');
        return `${month}/${day}`; // Short format e.g., 10/28
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Revenue',
                data: Object.values(weeklyData),
                backgroundColor: CHART_COLORS.blue,
                borderColor: CHART_COLORS.darkBlue,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000) + 'k';
                        }
                    }
                },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => formatTooltipAsCurrency(context) } }
            }
        }
    });
}

/**
 * Renders the Regional Business pie chart (COO/Director only)
 */
function renderRegionalPieChart(regionalData) {
    const ctx = document.getElementById('regionalPieChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(regionalData),
            datasets: [{
                label: 'Regional Revenue',
                data: Object.values(regionalData),
                backgroundColor: [
                    CHART_COLORS.blue,
                    CHART_COLORS.green,
                    CHART_COLORS.yellow,
                    CHART_COLORS.purple,
                    CHART_COLORS.orange,
                    CHART_COLORS.red,
                    CHART_COLORS.grey
                ],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: (context) => formatTooltipAsCurrency(context, context.label) } }
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
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 0 = Sunday, 1 = Monday
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().split('T')[0];
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
