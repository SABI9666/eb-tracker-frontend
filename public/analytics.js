// ============================================
// EBTRACKER ANALYTICS DASHBOARD (V3)
// Updated with Designer Weekly Hours Analytics
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
 * Main function to show the Analytics Dashboard.
 */
async function showAnalyticsDashboard() {
    setActiveNav('nav-analytics');
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    showLoading();

    try {
        main.innerHTML = getAnalyticsHTML(currentUserRole);
        const analyticsData = await loadAnalyticsData(currentUserRole);
        renderKpiCards(analyticsData.kpis, currentUserRole);
        renderMonthlyRevenueChart(analyticsData.monthlyRevenue);
        renderStatusPieChart(analyticsData.statusCounts);

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
        hideLoading();
    }
}

/**
 * Returns the HTML skeleton for the analytics dashboard.
 */
function getAnalyticsHTML(role) {
    const isDirectorView = role === 'coo' || role === 'director';
    const title = isDirectorView ? '📊 Company Analytics Dashboard' : '📈 My BDM Analytics';

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
        
        <div class="dashboard-stats" id="bdm-kpi-cards">
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

            ${isDirectorView ? directorCharts : ''}
        </div>
    `;
}

/**
 * Fetches and processes all proposal data.
 */
async function loadAnalyticsData(role) {
    const response = await apiCall('proposals');
    if (!response.success || !response.data) {
        throw new Error('Failed to fetch proposal data');
    }

    let proposals;
    if (role === 'bdm') {
        proposals = response.data.filter(p => p.createdByUid === currentUser.uid);
    } else {
        proposals = response.data;
    }

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
        let date = null;
        
        if (p.wonDate) {
            if (p.wonDate.seconds !== undefined && p.wonDate.seconds !== null) {
                date = new Date(Number(p.wonDate.seconds) * 1000);
            } else if (p.wonDate._seconds !== undefined && p.wonDate._seconds !== null) {
                date = new Date(Number(p.wonDate._seconds) * 1000);
            } else if (typeof p.wonDate === 'string') {
                date = new Date(p.wonDate);
            } else if (typeof p.wonDate === 'number') {
                date = new Date(p.wonDate);
            }
        }
        
        if (!date || isNaN(date.getTime())) {
            if (p.updatedAt) {
                if (p.updatedAt.seconds !== undefined && p.updatedAt.seconds !== null) {
                    date = new Date(Number(p.updatedAt.seconds) * 1000);
                } else if (p.updatedAt._seconds !== undefined && p.updatedAt._seconds !== null) {
                    date = new Date(Number(p.updatedAt._seconds) * 1000);
                } else if (typeof p.updatedAt === 'string') {
                    date = new Date(p.updatedAt);
                } else if (typeof p.updatedAt === 'number') {
                    date = new Date(p.updatedAt);
                }
            }
        }

        if (date && !isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const label = `${year}-${month}`;
            if (monthlyRevenue.hasOwnProperty(label)) {
                monthlyRevenue[label] += (p.pricing?.quoteValue || 0);
            }
        }
    });

    const statusCounts = {
        won: wonProposals.length,
        lost: lostProposals.length,
        submitted: proposals.filter(p => p.status === 'submitted').length,
        pending: proposals.filter(p => p.status === 'pending' || p.status === 'estimation_completed' || p.status === 'pricing_pending').length,
        draft: proposals.filter(p => p.status === 'draft').length
    };

    let bdmPerformance = null;
    let weeklyRevenue = null;
    let regionalData = null;

    if (role === 'coo' || role === 'director') {
        bdmPerformance = {};
        wonProposals.forEach(p => {
            const bdmName = p.createdByName || 'Unknown';
            bdmPerformance[bdmName] = (bdmPerformance[bdmName] || 0) + (p.pricing?.quoteValue || 0);
        });

        weeklyRevenue = {};
        for (let i = 15; i >= 0; i--) {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1 - (i * 7));
            const label = weekStart.toISOString().split('T')[0];
            weeklyRevenue[label] = 0;
        }

        wonProposals.forEach(p => {
            let date = null;
            if (p.wonDate) {
                if (p.wonDate.seconds !== undefined) {
                    date = new Date(Number(p.wonDate.seconds) * 1000);
                } else if (typeof p.wonDate === 'string') {
                    date = new Date(p.wonDate);
                }
            }
            if (date && !isNaN(date.getTime())) {
                const weekLabel = getWeekStartDate(date);
                if (weeklyRevenue.hasOwnProperty(weekLabel)) {
                    weeklyRevenue[weekLabel] += (p.pricing?.quoteValue || 0);
                }
            }
        });

        regionalData = {};
        wonProposals.forEach(p => {
            const region = p.region || p.clientLocation || 'Other';
            regionalData[region] = (regionalData[region] || 0) + (p.pricing?.quoteValue || 0);
        });
    }

    return {
        kpis,
        monthlyRevenue: { labels, data: labels.map(l => monthlyRevenue[l]) },
        statusCounts,
        bdmPerformance,
        weeklyRevenue,
        regionalData
    };
}

/**
 * Renders KPI Cards
 */
function renderKpiCards(kpis, role) {
    const container = document.getElementById('bdm-kpi-cards');
    if (!container) return;
    
    const cards = [
        { label: 'Total Revenue', value: formatCurrency(kpis.totalRevenue), icon: '💰', color: 'var(--success)' },
        { label: 'Total Proposals', value: kpis.totalProposals, icon: '📄', color: 'var(--primary-blue)' },
        { label: 'Win Rate', value: kpis.winRate.toFixed(1) + '%', icon: '🎯', color: 'var(--warning)' },
        { label: 'Avg Deal Value', value: formatCurrency(kpis.avgDealValue), icon: '📊', color: 'var(--purple)' },
    ];

    container.innerHTML = cards.map(card => `
        <div class="stat-card" style="border-top-color: ${card.color};">
            <div class="stat-number" style="color: ${card.color};">${card.value}</div>
            <div class="stat-label">${card.icon} ${card.label}</div>
        </div>
    `).join('');
}

function formatCurrency(value) {
    if (value >= 1000000) {
        return '$' + (value / 1000000).toFixed(2) + 'M';
    } else if (value >= 1000) {
        return '$' + (value / 1000).toFixed(1) + 'K';
    }
    return '$' + value.toLocaleString();
}

/**
 * Renders the Monthly Revenue bar chart
 */
function renderMonthlyRevenueChart(data) {
    const ctx = document.getElementById('monthlyRevenueChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels.map(l => {
                const [year, month] = l.split('-');
                return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short' });
            }),
            datasets: [{
                label: 'Revenue',
                data: data.data,
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
                            if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                            if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'k';
                            return '$' + value;
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
 * Renders the Status Pie Chart
 */
function renderStatusPieChart(statusCounts) {
    const ctx = document.getElementById('statusPieChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
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
                            return ` ${context.label}: ${context.raw}`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renders the BDM Performance bar chart
 */
function renderBdmPerformanceChart(bdmData) {
    const ctx = document.getElementById('bdmPerformanceChart');
    if (!ctx) return;
    
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
                backgroundColor: [
                    CHART_COLORS.green, CHART_COLORS.blue, CHART_COLORS.yellow,
                    CHART_COLORS.purple, CHART_COLORS.orange, CHART_COLORS.red, CHART_COLORS.grey
                ],
                borderColor: '#ffffff',
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                            if (value >= 10000) return '$' + (value / 1000).toFixed(0) + 'k';
                            if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'k';
                            return '$' + value.toLocaleString();
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
 * Renders the Weekly Revenue line chart
 */
function renderWeeklyRevenueChart(weeklyData) {
    const ctx = document.getElementById('weeklyRevenueChart');
    if (!ctx) return;
    
    const displayLabels = Object.keys(weeklyData).map(label => {
        const [year, month, day] = label.split('-');
        return `${month}/${day}`;
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
                            if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                            if (value >= 10000) return '$' + (value / 1000).toFixed(0) + 'k';
                            if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'k';
                            return '$' + value.toLocaleString();
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
 * Renders the Regional Business pie chart
 */
function renderRegionalPieChart(regionalData) {
    const ctx = document.getElementById('regionalPieChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(regionalData),
            datasets: [{
                label: 'Regional Revenue',
                data: Object.values(regionalData),
                backgroundColor: [
                    CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.yellow,
                    CHART_COLORS.purple, CHART_COLORS.orange, CHART_COLORS.red, CHART_COLORS.grey
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
// DESIGNER WEEKLY HOURS ANALYTICS
// ============================================

/**
 * Show Designer Weekly Hours Analytics Dashboard
 */
async function showDesignerWeeklyAnalytics() {
    setActiveNav('nav-designer-analytics');
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    showLoading();

    try {
        // Fetch designer weekly report from API
        const response = await apiCall('timesheets?action=designer_weekly_report');
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load designer weekly report');
        }

        const { designers, weeklyTotals, summary } = response.data;
        
        // Render the dashboard
        main.innerHTML = renderDesignerWeeklyDashboard(designers, weeklyTotals, summary);
        
        // Initialize charts after a short delay
        setTimeout(() => renderDesignerWeeklyCharts(designers, weeklyTotals), 100);

    } catch (error) {
        console.error('❌ Error loading designer weekly analytics:', error);
        main.innerHTML = `
            <div class="error-message" style="background: #fee; padding: 2rem; border-radius: 12px; text-align: center;">
                <h3>⚠️ Error Loading Designer Analytics</h3>
                <p>${error.message}</p>
                <button onclick="showDesignerWeeklyAnalytics()" class="btn btn-primary" style="margin-top: 1rem;">Retry</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

/**
 * Render the Designer Weekly Analytics Dashboard
 */
function renderDesignerWeeklyDashboard(designers, weeklyTotals, summary) {
    return `
        <div class="page-header">
            <h2>📊 Designer Weekly Hours Analytics</h2>
            <p class="subtitle">Comprehensive breakdown of designer working hours per week</p>
        </div>
        
        <!-- Summary Cards -->
        <div class="dashboard-stats">
            <div class="stat-card">
                <div class="stat-number">${summary.totalDesigners}</div>
                <div class="stat-label">👥 Total Designers</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${summary.totalHoursAllTime.toFixed(1)}h</div>
                <div class="stat-label">⏱️ Total Hours (All Time)</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${summary.avgHoursPerDesigner.toFixed(1)}h</div>
                <div class="stat-label">📈 Avg Hours/Designer</div>
            </div>
            <div class="stat-card" style="border-top-color: var(--success);">
                <div class="stat-number" style="color: var(--success);">${summary.weeksTracked || weeklyTotals.length}</div>
                <div class="stat-label">📅 Weeks Tracked</div>
            </div>
        </div>
        
        <!-- Export Button -->
        <div style="margin: 2rem 0; text-align: right;">
            <button onclick="downloadDesignerWeeklyExcel()" class="btn btn-primary" style="padding: 0.75rem 1.5rem;">
                📥 Download Excel Report
            </button>
        </div>
        
        <!-- Tabs -->
        <div class="card" style="margin-bottom: 2rem;">
            <div class="auth-tabs">
                <button class="auth-tab active" onclick="showDesignerAnalyticsSection('table', this)">Designer Table</button>
                <button class="auth-tab" onclick="showDesignerAnalyticsSection('weekly', this)">Weekly Breakdown</button>
                <button class="auth-tab" onclick="showDesignerAnalyticsSection('chart', this)">Charts</button>
            </div>
        </div>
        
        <!-- Section: Designer Table -->
        <div id="designer-section-table" class="designer-analytics-section">
            ${renderDesignerTable(designers)}
        </div>
        
        <!-- Section: Weekly Breakdown -->
        <div id="designer-section-weekly" class="designer-analytics-section" style="display: none;">
            ${renderWeeklyBreakdownTable(designers, weeklyTotals)}
        </div>
        
        <!-- Section: Charts -->
        <div id="designer-section-chart" class="designer-analytics-section" style="display: none;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem;">
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">📈 Weekly Hours Trend</h3>
                    <div style="position: relative; height: 350px;">
                        <canvas id="weeklyTrendChart"></canvas>
                    </div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">👥 Designer Workload Distribution</h3>
                    <div style="position: relative; height: 350px;">
                        <canvas id="designerDistributionChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the main designer table with weekly averages
 */
function renderDesignerTable(designers) {
    if (!designers || designers.length === 0) {
        return '<div class="card" style="padding: 2rem; text-align: center; color: var(--text-light);">No designer data found.</div>';
    }
    
    const rows = designers.map((d, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <strong>${d.name}</strong><br>
                <small style="color: var(--text-light);">${d.email || ''}</small>
            </td>
            <td><strong>${d.totalHours.toFixed(1)}h</strong></td>
            <td>${d.weeksActive}</td>
            <td style="color: var(--primary-blue); font-weight: 600;">${d.avgWeeklyHours.toFixed(1)}h</td>
            <td style="color: var(--success); font-weight: 600;">${d.avgDailyHours.toFixed(2)}h</td>
            <td>${d.projectsWorked}</td>
            <td>${d.uniqueWorkingDays}</td>
        </tr>
    `).join('');
    
    return `
        <div class="card">
            <h3 style="margin-bottom: 1.5rem;">Designer Hours Summary</h3>
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Designer</th>
                            <th>Total Hours</th>
                            <th>Weeks Active</th>
                            <th>Avg Hours/Week</th>
                            <th>Avg Hours/Day</th>
                            <th>Projects</th>
                            <th>Working Days</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render weekly breakdown table with each designer's hours per week
 */
function renderWeeklyBreakdownTable(designers, weeklyTotals) {
    if (!weeklyTotals || weeklyTotals.length === 0) {
        return '<div class="card" style="padding: 2rem; text-align: center; color: var(--text-light);">No weekly data found.</div>';
    }
    
    // Create header with week labels
    const weekHeaders = weeklyTotals.map(w => `<th style="min-width: 80px; text-align: center;">${w.weekLabel}</th>`).join('');
    
    // Create rows for each designer (limit to top 15)
    const designerRows = designers.slice(0, 15).map(d => {
        const weekCells = weeklyTotals.map(w => {
            const hours = (d.weeklyHours && d.weeklyHours[w.week]) || 0;
            const cellColor = hours > 40 ? 'var(--danger)' : (hours > 30 ? 'var(--warning)' : 'var(--text-dark)');
            return `<td style="text-align: center; color: ${cellColor}; font-weight: ${hours > 0 ? '600' : '400'};">${hours > 0 ? hours.toFixed(1) : '-'}</td>`;
        }).join('');
        
        return `
            <tr>
                <td style="position: sticky; left: 0; background: white; z-index: 1;">
                    <strong>${d.name}</strong>
                </td>
                ${weekCells}
                <td style="background: #f3f4f6; font-weight: 700; text-align: center;">${d.avgWeeklyHours.toFixed(1)}h</td>
            </tr>
        `;
    }).join('');
    
    // Create totals row
    const totalCells = weeklyTotals.map(w => `<td style="text-align: center; font-weight: 700;">${w.total.toFixed(1)}</td>`).join('');
    
    return `
        <div class="card">
            <h3 style="margin-bottom: 1.5rem;">Weekly Hours Breakdown by Designer</h3>
            <div style="overflow-x: auto; max-width: 100%;">
                <table class="data-table" style="min-width: max-content;">
                    <thead>
                        <tr>
                            <th style="position: sticky; left: 0; background: var(--light-blue); z-index: 2; min-width: 150px;">Designer</th>
                            ${weekHeaders}
                            <th style="background: #e5e7eb; min-width: 80px;">Avg/Week</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${designerRows}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f3f4f6;">
                            <td style="position: sticky; left: 0; background: #e5e7eb; z-index: 1;"><strong>Weekly Total</strong></td>
                            ${totalCells}
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `;
}

/**
 * Switch between designer analytics sections
 */
function showDesignerAnalyticsSection(section, clickedTab) {
    // Update tab active states
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    if (clickedTab) clickedTab.classList.add('active');
    
    // Hide all sections
    document.querySelectorAll('.designer-analytics-section').forEach(sec => sec.style.display = 'none');
    
    // Show selected section
    const selectedSection = document.getElementById(`designer-section-${section}`);
    if (selectedSection) {
        selectedSection.style.display = 'block';
        
        // Render charts when chart section is shown
        if (section === 'chart') {
            apiCall('timesheets?action=designer_weekly_report').then(response => {
                if (response.success) {
                    renderDesignerWeeklyCharts(response.data.designers, response.data.weeklyTotals);
                }
            });
        }
    }
}

/**
 * Render charts for designer weekly analytics
 */
function renderDesignerWeeklyCharts(designers, weeklyTotals) {
    // Weekly Trend Line Chart
    const trendCtx = document.getElementById('weeklyTrendChart');
    if (trendCtx && typeof Chart !== 'undefined') {
        // Destroy existing chart if any
        const existingChart = Chart.getChart(trendCtx);
        if (existingChart) existingChart.destroy();
        
        new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: weeklyTotals.map(w => w.weekLabel),
                datasets: [{
                    label: 'Total Hours',
                    data: weeklyTotals.map(w => w.total),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3
                }, {
                    label: 'Avg Per Designer',
                    data: weeklyTotals.map(w => w.avgPerDesigner),
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Hours' }
                    }
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
    
    // Designer Distribution Bar Chart
    const distCtx = document.getElementById('designerDistributionChart');
    if (distCtx && typeof Chart !== 'undefined') {
        const existingChart = Chart.getChart(distCtx);
        if (existingChart) existingChart.destroy();
        
        const topDesigners = designers.slice(0, 10);
        
        new Chart(distCtx, {
            type: 'bar',
            data: {
                labels: topDesigners.map(d => d.name.split(' ')[0]),
                datasets: [{
                    label: 'Total Hours',
                    data: topDesigners.map(d => d.totalHours),
                    backgroundColor: '#3b82f6'
                }, {
                    label: 'Avg Weekly',
                    data: topDesigners.map(d => d.avgWeeklyHours),
                    backgroundColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Hours' }
                    }
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
}

/**
 * Download Designer Weekly Hours as Excel Report
 */
async function downloadDesignerWeeklyExcel() {
    try {
        showLoading();
        
        // Fetch data
        const response = await apiCall('timesheets?action=designer_weekly_report');
        
        if (!response.success) {
            throw new Error('Failed to fetch data');
        }
        
        const { designers, weeklyTotals, summary } = response.data;
        
        // Check if XLSX library is available
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded. Please add SheetJS library to your page.\n\nAdd this to your HTML:\n<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>');
            return;
        }
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Designer Summary
        const summaryData = [
            ['Designer Weekly Hours Report', '', '', '', '', '', ''],
            [`Generated: ${new Date().toLocaleString()}`, '', '', '', '', '', ''],
            ['', '', '', '', '', '', ''],
            ['#', 'Designer Name', 'Email', 'Total Hours', 'Weeks Active', 'Avg Hours/Week', 'Avg Hours/Day', 'Projects', 'Working Days']
        ];
        
        designers.forEach((d, i) => {
            summaryData.push([
                i + 1,
                d.name,
                d.email || '',
                d.totalHours,
                d.weeksActive,
                d.avgWeeklyHours,
                d.avgDailyHours,
                d.projectsWorked,
                d.uniqueWorkingDays
            ]);
        });
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        summarySheet['!cols'] = [
            { wch: 5 }, { wch: 25 }, { wch: 30 }, { wch: 12 },
            { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 14 }
        ];
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Designer Summary');
        
        // Sheet 2: Weekly Breakdown
        const weeklyHeaders = ['Designer Name', ...weeklyTotals.map(w => w.weekLabel), 'Average/Week'];
        const weeklyData = [
            ['Weekly Hours Breakdown', '', '', '', ''],
            [`Generated: ${new Date().toLocaleString()}`, '', '', '', ''],
            [''],
            weeklyHeaders
        ];
        
        designers.forEach(d => {
            const row = [d.name];
            weeklyTotals.forEach(w => {
                row.push((d.weeklyHours && d.weeklyHours[w.week]) || 0);
            });
            row.push(d.avgWeeklyHours);
            weeklyData.push(row);
        });
        
        // Add totals row
        const totalsRow = ['TOTAL'];
        weeklyTotals.forEach(w => {
            totalsRow.push(w.total);
        });
        totalsRow.push('');
        weeklyData.push(totalsRow);
        
        const weeklySheet = XLSX.utils.aoa_to_sheet(weeklyData);
        XLSX.utils.book_append_sheet(wb, weeklySheet, 'Weekly Breakdown');
        
        // Download file
        const fileName = `Designer_Weekly_Hours_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        console.log('✅ Excel report downloaded:', fileName);
        
    } catch (error) {
        console.error('Error downloading Excel:', error);
        alert('❌ Error: ' + error.message);
    } finally {
        hideLoading();
    }
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
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
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

console.log('✅ Analytics module loaded with Designer Weekly Hours Analytics');
