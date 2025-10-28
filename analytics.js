// ============================================
// BDM ANALYTICS DASHBOARD CODE
// This file (analytics.js) will be loaded by index (58).html
// It has access to apiCall(), currentUser, and setActiveNav()
// ============================================

/**
 * Main function to show the BDM Analytics Dashboard
 * This is called by the 'Analytics' link in the nav menu.
 */
async function showBdmAnalytics() {
    setActiveNav('nav-analytics'); // Assumes setActiveNav is global in index.html
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    showLoading(); // Assumes showLoading is global

    try {
        // 1. Render the dashboard UI skeleton
        main.innerHTML = getBdmAnalyticsHTML();

        // 2. Fetch and process the data
        // Assumes apiCall and currentUser are global
        const { kpis, monthlyRevenue, statusCounts } = await loadBdmAnalyticsData();

        // 3. Render the KPI cards
        renderBdmKpiCards(kpis);

        // 4. Render the charts (Assumes Chart.js is loaded in index.html)
        renderBdmMonthlyRevenueChart(monthlyRevenue);
        renderBdmStatusPieChart(statusCounts);

    } catch (error) {
        console.error('❌ Error loading BDM analytics:', error);
        main.innerHTML = `<div class="error-message"><h3>Error Loading Analytics</h3><p>${error.message}</p></div>`;
    } finally {
        hideLoading(); // Assumes hideLoading is global
    }
}

/**
 * Returns the HTML skeleton for the analytics dashboard
 */
function getBdmAnalyticsHTML() {
    return `
        <div class="page-header">
            <h2>📈 BDM Analytics Dashboard</h2>
            <div class="subtitle">Insights on your proposals and revenue</div>
        </div>
        
        <div class="dashboard-stats" id="bdm-kpi-cards">
            <div class="stat-card">
                <div class="stat-number" id="kpi-total-revenue">...</div>
                <div class="stat-label">Total Revenue (Won)</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="kpi-total-proposals">...</div>
                <div class="stat-label">Total Proposals</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="kpi-win-rate">...</div>
                <div class="stat-label">Win Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="kpi-avg-deal">...</div>
                <div class="stat-label">Avg. Revenue (Won)</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem; margin-top: 3rem;">
            
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
        </div>
    `;
}

/**
 * Fetches and processes all proposal data for the current BDM
 */
async function loadBdmAnalyticsData() {
    // apiCall() and currentUser are defined in index (58).html
    const response = await apiCall('proposals');
    if (!response.success || !response.data) {
        throw new Error('Failed to fetch proposal data');
    }

    // Filter for proposals created by the current BDM
    const myProposals = response.data.filter(p => p.createdByUid === currentUser.uid);

    // --- Process KPIs ---
    const wonProposals = myProposals.filter(p => p.status === 'won');
    const lostProposals = myProposals.filter(p => p.status === 'lost');
    
    const totalRevenue = wonProposals.reduce((sum, p) => sum + (p.pricing?.quoteValue || 0), 0);
    const totalWon = wonProposals.length;
    const totalLost = lostProposals.length;
    const totalProposals = myProposals.length;
    const winRate = (totalWon + totalLost) > 0 ? (totalWon / (totalWon + totalLost)) * 100 : 0;
    const avgDealValue = totalWon > 0 ? totalRevenue / totalWon : 0;

    const kpis = {
        totalRevenue,
        totalProposals,
        winRate,
        avgDealValue
    };

    // --- Process Monthly Revenue (Bar Chart) ---
    const monthlyRevenue = {};
    const labels = [];
    const now = new Date();
    
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const label = `${year}-${month}`;
        labels.push(label);
        monthlyRevenue[label] = 0;
    }

    // Populate revenue data
    wonProposals.forEach(p => {
        let date;
        if (p.wonDate) {
             date = new Date(p.wonDate.seconds ? p.wonDate.seconds * 1000 : p.wonDate);
        } else if (p.updatedAt) {
             date = new Date(p.updatedAt.seconds ? p.updatedAt.seconds * 1000 : p.updatedAt);
        }

        if (date) {
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

    myProposals.forEach(p => {
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

    return { kpis, monthlyRevenue, statusCounts };
}

/**
 * Renders the KPI cards with processed data
 */
function renderBdmKpiCards(kpis) {
    document.getElementById('kpi-total-revenue').textContent = `$${kpis.totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    document.getElementById('kpi-total-proposals').textContent = kpis.totalProposals;
    document.getElementById('kpi-win-rate').textContent = `${kpis.winRate.toFixed(1)}%`;
    document.getElementById('kpi-avg-deal').textContent = `$${kpis.avgDealValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/**
 * Renders the Monthly Revenue bar chart
 */
function renderBdmMonthlyRevenueChart(monthlyRevenue) {
    const ctx = document.getElementById('monthlyRevenueChart').getContext('2d');
    
    // Format labels for display (e.g., "Jan 25")
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
                backgroundColor: 'rgba(0, 191, 255, 0.6)', // var(--primary-blue)
                borderColor: 'rgba(0, 153, 204, 1)',   // var(--dark-blue)
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
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renders the Proposal Status pie chart
 */
function renderBdmStatusPieChart(statusCounts) {
    const ctx = document.getElementById('statusPieChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                label: 'Proposal Status',
                data: Object.values(statusCounts),
                backgroundColor: [
                    'rgba(39, 174, 96, 0.7)',  // Won (var(--success))
                    'rgba(231, 76, 60, 0.7)',  // Lost (var(--danger))
                    'rgba(52, 152, 219, 0.7)', // Pending
                    'rgba(243, 156, 18, 0.7)', // Pricing (var(--warning))
                    'rgba(127, 140, 141, 0.7)' // Draft
                ],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            let value = context.raw || 0;
                            return `${label}: ${value}`;
                        }
                    }
                }
            }
        }
    });
}
