// ===================================
// EXECUTIVE MONITORING JAVASCRIPT
// ===================================

let executiveData = {
    projects: [],
    timesheets: [],
    designers: [],
    dateRange: { from: null, to: null }
};

// Load executive monitoring dashboard
async function loadExecutiveMonitoring() {
    try {
        showLoading();
        
        const [projectsResponse, timesheetsResponse, usersResponse] = await Promise.all([
            apiCall('projects'),
            apiCall('timesheets'),
            apiCall('users?role=designer')
        ]);
        
        if (!projectsResponse.success || !timesheetsResponse.success || !usersResponse.success) {
            throw new Error('Failed to load monitoring data');
        }
        
        executiveData.projects = (projectsResponse.data || []).filter(p => p.allocatedHours && p.allocatedHours > 0);
        executiveData.timesheets = timesheetsResponse.data || [];
        executiveData.designers = usersResponse.data || [];
        
        calculateExecutiveMetrics();
        switchExecutiveTab('overview');
        
        hideLoading();
    } catch (error) {
        console.error('Error loading executive monitoring:', error);
        alert('Error loading monitoring dashboard: ' + error.message);
        hideLoading();
    }
}

// Calculate executive metrics
function calculateExecutiveMetrics() {
    const projects = executiveData.projects; // Already filtered for allocatedHours > 0
    const timesheets = executiveData.timesheets;

    let totalProjects = projects.length;
    let onTrackProjects = 0;
    let atRiskProjects = 0; // 70-100%
    let exceededProjects = 0; // > 100%

    let totalAllocated = 0;
    let totalLogged = 0;

    projects.forEach(p => {
        const allocated = p.allocatedHours || 0; // Use 0 if missing
        const logged = p.hoursLogged || 0;    // Use 0 if missing
        totalAllocated += allocated;
        totalLogged += logged;

        // Ensure allocated is > 0 before calculating usage
        const usage = allocated > 0 ? (logged / allocated) * 100 : 0;

        if (usage > 100) {
            exceededProjects++;
        } else if (usage >= 70) {
            atRiskProjects++;
        } else {
            onTrackProjects++;
        }
    });

    const activeDesigners = new Set(timesheets.map(t => t.designerUid)).size;
    // Check totalProjects > 0 before dividing
    const avgHoursPerProject = totalProjects > 0 ? totalLogged / totalProjects : 0;
    // Check totalAllocated > 0 before dividing
    const efficiency = totalAllocated > 0 ? (totalLogged / totalAllocated) * 100 : 0;
    // Check totalAllocated > 0 before calculating remaining percentage
    const remainingPercentage = totalAllocated > 0 ? (((totalAllocated - totalLogged) / totalAllocated) * 100) : 0;

    const metricsHtml = `
        <div class="metric-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
            <div class="metric-icon">📁</div>
            <div class="metric-content">
                <div class="metric-label">Total Projects</div>
                <div class="metric-value">${totalProjects}</div>
                <div class="metric-subtitle">${totalAllocated.toFixed(0)}h allocated</div>
            </div>
        </div>
        <div class="metric-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <div class="metric-icon">🟢</div>
            <div class="metric-content">
                <div class="metric-label">On-Track Projects</div>
                <div class="metric-value">${onTrackProjects}</div>
                <div class="metric-subtitle">Under 70% budget</div>
            </div>
        </div>
        <div class="metric-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
            <div class="metric-icon">🟡</div>
            <div class="metric-content">
                <div class="metric-label">At-Risk Projects</div>
                <div class="metric-value">${atRiskProjects}</div>
                <div class="metric-subtitle">70-100% budget</div>
            </div>
        </div>
        <div class="metric-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <div class="metric-icon">🔴</div>
            <div class="metric-content">
                <div class="metric-label">Exceeded Projects</div>
                <div class="metric-value">${exceededProjects}</div>
                <div class="metric-subtitle">Over 100% budget</div>
            </div>
        </div>
    `;

    document.getElementById('executiveMetrics').innerHTML = metricsHtml;
    // Ensure elements exist before setting textContent
    document.getElementById('execActiveProjects')?.textContent = totalProjects; // Use totalProjects here
    document.getElementById('execTotalDesigners')?.textContent = activeDesigners;
    document.getElementById('execTotalEntries')?.textContent = timesheets.length;
    document.getElementById('execAvgHours')?.textContent = avgHoursPerProject.toFixed(1) + 'h';
    document.getElementById('execEfficiency')?.textContent = efficiency.toFixed(1) + '%';
}

// Switch between tabs
function switchExecutiveTab(tab) {
    // Find the active tab button. If event is not passed, find it by function name
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(t => {
        t.classList.remove('active');
        if (t.getAttribute('onclick') === `switchExecutiveTab('${tab}')`) {
            t.classList.add('active');
        }
    });
    
    // Fallback if event was not passed
    if (event && event.target) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
    }

    const contentDiv = document.getElementById('executiveTabContent');
    
    switch(tab) {
        case 'overview':
            contentDiv.innerHTML = generateOverviewContent();
            break;
        case 'projects':
            contentDiv.innerHTML = generateProjectsContent();
            break;
        case 'designers':
            contentDiv.innerHTML = generateDesignersContent();
            break;
        case 'analytics':
            contentDiv.innerHTML = generateAnalyticsContent();
            setTimeout(renderDesignerChart, 0); 
            break;
        case 'alerts':
            contentDiv.innerHTML = generateAlertsContent();
            break;
    }
}

// Generate Overview Content
function generateOverviewContent() {
    // Note: executiveData.projects is already pre-filtered in loadExecutiveMonitoring
    // to include only projects with allocatedHours > 0.
    const projects = executiveData.projects;

    if (projects.length === 0) {
        return `<div class="card"><p style="text-align: center; padding: 2rem; color: var(--text-light);">No projects with allocated hours found.</p></div>`;
    }

    const sortedProjects = [...projects].sort((a, b) => {
        const usageA = (a.allocatedHours || 0) > 0 ? ((a.hoursLogged || 0) / a.allocatedHours) * 100 : 0;
        const usageB = (b.allocatedHours || 0) > 0 ? ((b.hoursLogged || 0) / b.allocatedHours) * 100 : 0;
        return usageB - usageA; // Sort descending by usage
    });

    return `
        <div class="card">
            <div class="card-header">
                <h3>🎯 Project Health Matrix</h3>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Project</th>
                        <th>Design Manager</th>
                        <th>Team Size</th>
                        <th style="text-align: center;">Budget</th>
                        <th style="text-align: center;">Used</th>
                        <th style="text-align: center;">Remaining</th>
                        <th style="text-align: center;">Usage %</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedProjects.map(project => {
                        const allocated = project.allocatedHours || 0; // Default to 0
                        const logged = project.hoursLogged || 0;    // Default to 0
                        // Calculate usage safely, ensuring allocated > 0
                        const usage = allocated > 0 ? (logged / allocated) * 100 : 0;
                        const remaining = allocated - logged;

                        let healthIcon, healthText, healthColor;

                        if (usage > 100) {
                            healthIcon = '🔴'; healthText = 'Exceeded'; healthColor = 'var(--danger)';
                        } else if (usage >= 90) { // Changed threshold slightly for Critical as per previous logic
                            healthIcon = '🔴'; healthText = 'Critical'; healthColor = 'var(--danger)';
                        } else if (usage >= 70) { // Changed to 70 for At Risk
                            healthIcon = '🟡'; healthText = 'At Risk'; healthColor = 'var(--warning)';
                        } else {
                            healthIcon = '🟢'; healthText = 'Healthy'; healthColor = 'var(--success)';
                        }

                        // Display N/A if allocated hours were missing/zero initially
                        const budgetDisplay = allocated > 0 ? `${allocated.toFixed(1)}h` : 'N/A';
                        const loggedDisplay = allocated > 0 ? `${logged.toFixed(1)}h` : 'N/A';
                        const remainingDisplay = allocated > 0 ? `${remaining.toFixed(1)}h` : 'N/A';
                        const usageDisplay = allocated > 0 ? `${usage.toFixed(0)}%` : 'N/A';
                        const statusDisplay = allocated > 0 ?
                            `<span style="display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 600; color: ${healthColor};">${healthIcon} ${healthText}</span>`
                            : `<span style="color: var(--text-light);">N/A</span>`;
                        const remainingColor = allocated > 0 ? (remaining >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text-light)';

                        return `
                            <tr style="cursor: pointer;" onclick="viewProject('${project.id}')">
                                <td>
                                    <div style="font-weight: 600;">${project.projectName}</div>
                                    <div style="font-size: 0.85rem; color: var(--text-light);">${project.clientCompany}</div>
                                </td>
                                <td>${project.designLeadName || 'Unassigned'}</td>
                                <td>${project.assignedDesignerNames?.length || 0} designer(s)</td>
                                <td style="text-align: center; font-weight: 600;">${budgetDisplay}</td>
                                <td style="text-align: center; font-weight: 600; color: var(--primary-blue);">${loggedDisplay}</td>
                                <td style="text-align: center; font-weight: 600; color: ${remainingColor};">${remainingDisplay}</td>
                                <td style="text-align: center;">
                                    ${allocated > 0 ? `<strong style="color: ${healthColor};">${usageDisplay}</strong>` : usageDisplay}
                                </td>
                                <td>${statusDisplay}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Generate Projects Content (simplified)
function generateProjectsContent() {
    return generateOverviewContent(); // Reuse the overview table
}

// Generate Designers Content
function generateDesignersContent() {
    const timesheets = executiveData.timesheets;
    const designerStats = {};
    
    timesheets.forEach(entry => {
        if (!designerStats[entry.designerUid]) {
            designerStats[entry.designerUid] = {
                uid: entry.designerUid,
                name: entry.designerName,
                email: entry.designerEmail,
                totalHours: 0,
                projectCount: new Set(),
                entries: []
            };
        }
        
        designerStats[entry.designerUid].totalHours += entry.hours;
        designerStats[entry.designerUid].projectCount.add(entry.projectId);
        designerStats[entry.designerUid].entries.push(entry);
    });
    
    const designersArray = Object.values(designerStats).map(d => ({
        ...d,
        projectCount: d.projectCount.size,
        avgHoursPerProject: d.projectCount.size > 0 ? d.totalHours / d.projectCount.size : 0
    })).sort((a, b) => b.totalHours - a.totalHours);
    
    return `
        <div class="card">
            <div class="card-header">
                <h3>👥 Designer Performance</h3>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Designer</th>
                        <th style="text-align: center;">Total Hours</th>
                        <th style="text-align: center;">Projects</th>
                        <th style="text-align: center;">Avg Hours/Project</th>
                        <th style="text-align: center;">Entries</th>
                    </tr>
                </thead>
                <tbody>
                    ${designersArray.map(designer => `
                        <tr>
                            <td>
                                <div style="font-weight: 600;">${designer.name}</div>
                                <div style="font-size: 0.85rem; color: var(--text-light);">${designer.email}</div>
                            </td>
                            <td style="text-align: center; font-weight: 700; font-size: 1.1rem; color: var(--primary-blue);">${designer.totalHours.toFixed(1)}h</td>
                            <td style="text-align: center; font-weight: 600;">${designer.projectCount}</td>
                            <td style="text-align: center; font-weight: 600;">${designer.avgHoursPerProject.toFixed(1)}h</td>
                            <td style="text-align: center;">${designer.entries.length}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Generate Analytics Content (simplified)
function generateAnalyticsContent() {
    const projects = executiveData.projects;
    const totalAllocated = projects.reduce((sum, p) => sum + (p.allocatedHours || 0), 0);
    const totalLogged = projects.reduce((sum, p) => sum + (p.hoursLogged || 0), 0);
    
    // Add a canvas element for the chart
    return `
        <div class="card">
            <div class="card-header">
                <h3>📊 Budget Overview</h3>
            </div>
            <div style="padding: 2rem; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">
                    ${totalAllocated > 0 ? ((totalLogged / totalAllocated) * 100).toFixed(0) : 0}%
                </div>
                <div style="font-size: 1.2rem; color: var(--text-light); margin-bottom: 2rem;">
                    Budget Utilization
                </div>
                <div style="display: flex; justify-content: space-around; max-width: 600px; margin: 0 auto;">
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-light);">Allocated</div>
                        <div style="font-weight: 700; font-size: 1.5rem;">${totalAllocated.toFixed(0)}h</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-light);">Logged</div>
                        <div style="font-weight: 700; font-size: 1.5rem; color: var(--primary-blue);">${totalLogged.toFixed(0)}h</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-light);">Remaining</div>
                        <div style="font-weight: 700; font-size: 1.5rem; color: var(--success);">${(totalAllocated - totalLogged).toFixed(0)}h</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="card" style="margin-top: 2rem;">
            <div class="card-header">
                <h3>Designer Hours Contribution</h3>
            </div>
            <div style="padding: 1rem;">
                <canvas id="designerChart"></canvas>
            </div>
        </div>
    `;
}

// Render Designer Chart
function renderDesignerChart() {
    const timesheets = executiveData.timesheets;
    const designerStats = {};

    // Calculate stats
    timesheets.forEach(entry => {
        if (!designerStats[entry.designerUid]) {
            designerStats[entry.designerUid] = {
                uid: entry.designerUid,
                name: entry.designerName,
                totalHours: 0,
            };
        }
        designerStats[entry.designerUid].totalHours += entry.hours; 
    });

    const designersArray = Object.values(designerStats).sort((a, b) => b.totalHours - a.totalHours);

    const labels = designersArray.map(d => d.name);
    const data = designersArray.map(d => d.totalHours);

    const ctx = document.getElementById('designerChart')?.getContext('2d');
    if (!ctx) {
        console.error('Designer chart canvas not found!');
        return;
    }

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Hours Logged',
                data: data,
                backgroundColor: 'rgba(0, 191, 255, 0.6)', // var(--primary-blue)
                borderColor: 'rgba(0, 153, 204, 1)',   // var(--dark-blue)
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Total Hours'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Designer'
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
                            return ` ${context.dataset.label}: ${context.raw.toFixed(1)}h`;
                        }
                    }
                }
            }
        }
    });
}


// Generate Alerts Content
function generateAlertsContent() {
    // Note: executiveData.projects is already pre-filtered in loadExecutiveMonitoring
    // to include only projects with allocatedHours > 0.
    const projects = executiveData.projects;
    const alerts = [];

    projects.forEach(project => {
        const allocated = project.allocatedHours || 0; // Should be > 0 due to filter, but good practice
        const logged = project.hoursLogged || 0;
        // Calculate usage safely
        const usage = allocated > 0 ? (logged / allocated) * 100 : 0;
        const remaining = allocated - logged;

        // Use the safe 'usage' value for checks
        if (usage > 100) {
            alerts.push({
                type: 'critical', icon: '🔴', title: 'Budget Exceeded',
                message: `Project "${project.projectName}" has exceeded its allocated hours by ${Math.abs(remaining).toFixed(1)} hours (${usage.toFixed(0)}% used)`,
                project: project
            });
        } else if (usage >= 70) { // Keep 70% threshold for yellow alert
            alerts.push({
                type: 'warning', icon: '🟡', title: 'High Budget Usage',
                message: `Project "${project.projectName}" is at ${usage.toFixed(0)}% budget utilization with ${remaining.toFixed(1)} hours remaining`,
                project: project
            });
        }
    });

    if (alerts.length === 0) {
        return `
            <div class="card">
                <div style="text-align: center; padding: 4rem; color: var(--text-light);">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
                    <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">All Clear!</div>
                    <div>No projects are at risk or over budget based on available data.</div>
                </div>
            </div>
        `;
    }

    return `
        <div class="card">
            <div class="card-header">
                <h3>🔔 Active Alerts (${alerts.length})</h3>
            </div>
            <div style="padding: 1rem;">
                ${alerts.map(alert => {
                    const bgColor = alert.type === 'critical' ? '#f8d7da' : '#fff3cd';
                    const borderColor = alert.type === 'critical' ? '#dc3545' : '#ffc107';

                    return `
                        <div style="padding: 1.5rem; background: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 8px; margin-bottom: 1rem; cursor: pointer;" onclick="viewProject('${alert.project.id}')">
                            <div style="display: flex; align-items: start; gap: 1rem;">
                                <div style="font-size: 2rem;">${alert.icon}</div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem;">${alert.title}</div>
                                    <div style="color: var(--text-dark); margin-bottom: 1rem;">${alert.message}</div>
                                    <div style="display: flex; gap: 2rem; font-size: 0.9rem;">
                                        <div>
                                            <span style="color: var(--text-light);">Design Manager:</span>
                                            <strong>${alert.project.designLeadName || 'Unassigned'}</strong>
                                        </div>
                                        <div>
                                            <span style="color: var(--text-light);">Client:</span>
                                            <strong>${alert.project.clientCompany}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}
// Export executive reports
async function exportExecutiveReport(type) {
    try {
        showLoading();
        
        const projects = executiveData.projects;
        const timesheets = executiveData.timesheets;
        
        let csv = '';
        let filename = '';
        
        if (type === 'summary') {
            const totalAllocated = projects.reduce((sum, p) => sum + (p.allocatedHours || 0), 0);
            const totalLogged = projects.reduce((sum, p) => sum + (p.hoursLogged || 0), 0);
            
            csv = 'Executive Summary Report\n\n';
            csv += `Generated: ${new Date().toLocaleString()}\n\n`;
            csv += `Total Projects: ${projects.length}\n`;
            csv += `Total Hours Allocated: ${totalAllocated.toFixed(0)}\n`;
            csv += `Total Hours Logged: ${totalLogged.toFixed(0)}\n\n`;
            csv += 'Project,Client,Design Manager,Allocated,Logged,Remaining,Usage %,Status\n';
            
            projects.forEach(project => {
                const usage = project.allocatedHours > 0 ? (project.hoursLogged / project.allocatedHours) * 100 : 0;
                const remaining = project.allocatedHours - project.hoursLogged;
                const status = usage >= 90 ? 'Critical' : usage >= 75 ? 'At Risk' : 'Healthy';
                
                csv += `"${project.projectName}","${project.clientCompany}","${project.designLeadName || 'Unassigned'}",${project.allocatedHours},${project.hoursLogged.toFixed(1)},${remaining.toFixed(1)},${usage.toFixed(1)},${status}\n`;
            });
            
            filename = `Executive_Summary_${new Date().toISOString().split('T')[0]}.csv`;
        } else {
            csv = 'Detailed Hours Report\n\n';
            csv += `Generated: ${new Date().toLocaleString()}\n\n`;
            csv += 'Date,Project,Designer,Hours,Description\n';
            
            timesheets.forEach(entry => {
                const date = new Date(entry.date.seconds * 1000).toLocaleDateString();
                const description = (entry.description || '').replace(/,/g, ';');
                csv += `${date},"${entry.projectName}","${entry.designerName}",${entry.hours},"${description}"\n`;
            });
            
            filename = `Detailed_Report_${new Date().toISOString().split('T')[0]}.csv`;
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        hideLoading();
        alert('Report exported successfully!');
        
    } catch (error) {
        console.error('Error exporting report:', error);
        alert('Error exporting report: ' + error.message);
        hideLoading();
    }
}

function applyExecutiveDateFilter() {
    const from = document.getElementById('executiveFromDate').value;
    const to = document.getElementById('executiveToDate').value;
    executiveData.dateRange = { from, to };
    calculateExecutiveMetrics();
    switchExecutiveTab('overview');
}
