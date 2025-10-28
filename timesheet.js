// ===================================  
// TIMESHEET JAVASCRIPT
// ===================================

// Show timesheet modal
async function showTimesheetModal(projectId = null) {
    try {
        showLoading();
        
        const response = await apiCall('projects');
        if (!response.success) {
            throw new Error('Failed to load projects');
        }
        
        const projects = response.data || [];
        const assignedProjects = projects.filter(p => 
            p.assignedDesigners && p.assignedDesigners.includes(currentUser.uid)
        );
        
        if (assignedProjects.length === 0) {
            alert('You are not assigned to any projects yet.');
            hideLoading();
            return;
        }
        
        const modalHtml = `
            <div class="modal-overlay" onclick="if(event.target === this) closeModal()">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>Log Hours</h2>
                        <span class="close-modal" onclick="closeModal()">&times;</span>
                    </div>
                    
                    <div class="modal-body">
                        <form id="timesheetForm">
                            <div class="form-group">
                                <label>Project <span class="required">*</span></label>
                                <select id="timesheetProjectId" class="form-control" required>
                                    <option value="">Select a project...</option>
                                    ${assignedProjects.map(project => `
                                        <option value="${project.id}" data-allocated="${project.allocatedHours || 0}" data-logged="${project.hoursLogged || 0}">
                                            ${project.projectName} - ${project.clientCompany}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label>Date <span class="required">*</span></label>
                                <input type="date" id="timesheetDate" class="form-control" 
                                       max="${new Date().toISOString().split('T')[0]}" required>
                            </div>

                            <div class="form-group">
                                <label>Hours <span class="required">*</span></label>
                                <input type="number" id="timesheetHours" class="form-control" 
                                       min="0.25" max="24" step="0.25" required placeholder="e.g., 8 or 2.5">
                            </div>

                            <div class="form-group">
                                <label>Description <span class="required">*</span></label>
                                <textarea id="timesheetDescription" class="form-control" rows="4" 
                                          placeholder="Describe what you worked on..." required></textarea>
                            </div>

                            <div id="timesheetAllocationInfo" style="display: none; padding: 1rem; background: var(--light-blue); border-radius: 8px; margin-top: 1rem;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                    <span>Hours Logged:</span>
                                    <strong id="timesheetCurrentHours">0h</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                    <span>Hours Allocated:</span>
                                    <strong id="timesheetAllocatedHours">0h</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span>Hours Remaining:</span>
                                    <strong id="timesheetRemainingHours" style="color: var(--success);">0h</strong>
                                </div>
                            </div>
                        </form>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" onclick="closeModal()" class="btn btn-outline">Cancel</button>
                        <button type="button" onclick="submitTimesheet()" class="btn btn-success">
                            Log Hours
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('timesheetDate').value = new Date().toISOString().split('T')[0];
        
        document.getElementById('timesheetProjectId').addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const infoDiv = document.getElementById('timesheetAllocationInfo');
            
            if (this.value) {
                const allocated = parseFloat(selectedOption.dataset.allocated) || 0;
                const logged = parseFloat(selectedOption.dataset.logged) || 0;
                const remaining = allocated - logged;
                
                document.getElementById('timesheetCurrentHours').textContent = logged + 'h';
                document.getElementById('timesheetAllocatedHours').textContent = allocated + 'h';
                document.getElementById('timesheetRemainingHours').textContent = remaining + 'h';
                document.getElementById('timesheetRemainingHours').style.color = 
                    remaining < 5 ? 'var(--danger)' : 'var(--success)';
                
                infoDiv.style.display = 'block';
            } else {
                infoDiv.style.display = 'none';
            }
        });
        
        if (projectId) {
            document.getElementById('timesheetProjectId').value = projectId;
            document.getElementById('timesheetProjectId').dispatchEvent(new Event('change'));
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('Error showing timesheet modal:', error);
        alert('Error loading timesheet form: ' + error.message);
        hideLoading();
    }
}

// Submit timesheet
async function submitTimesheet(event) {
    if(event) event.preventDefault();

    const projectId = document.getElementById('timesheetProjectId').value;
    const date = document.getElementById('timesheetDate').value;
    const hours = parseFloat(document.getElementById('timesheetHours').value);
    const description = document.getElementById('timesheetDescription').value.trim();
    
    if (!projectId || !date || !hours || !description) {
        alert('Please fill all required fields');
        return;
    }
    
    if (hours <= 0 || hours > 24) {
        alert('Hours must be between 0.25 and 24');
        return;
    }
    
    try {
        showLoading();
        
        const response = await apiCall('timesheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, date, hours, description })
        });
        
        if (response.success) {
            closeModal();
            alert(`${hours} hours logged successfully for ${date}!`);
            
            // Check if timesheet section is active
            if (document.getElementById('timesheetSection').style.display === 'block') {
                loadDesignerTimesheet();
            }
        } else {
            throw new Error(response.error || 'Failed to log hours');
        }
        
    } catch (error) {
        console.error('Error submitting timesheet:', error);
        alert('Error logging hours: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Load timesheets
async function loadTimesheets() {
    try {
        showLoading();
        
        const response = await apiCall('timesheets');
        if (!response.success) {
            throw new Error('Failed to load timesheets');
        }
        
        const timesheets = response.data || [];
        const tbody = document.getElementById('timesheetTableBody');
        
        if (timesheets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem;">
                        No timesheet entries yet. Click "Log Hours" to get started.
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = timesheets.map(entry => `
                <tr>
                    <td>${new Date(entry.date.seconds * 1000).toLocaleDateString()}</td>
                    <td>${entry.projectName}</td>
                    <td><strong>${entry.hours}h</strong></td>
                    <td>${entry.description}</td>
                    <td>
                        <span class="status-badge status-${entry.status}">
                            ${entry.status}
                        </span>
                    </td>
                    <td>
                        ${entry.status === 'submitted' ? `
                            <button onclick="deleteTimesheet('${entry.id}')" class="btn btn-sm btn-outline" style="color: var(--danger);">
                                Delete
                            </button>
                        ` : '-'}
                    </td>
                </tr>
            `).join('');
        }
        
        // Update summary
        const totalHours = timesheets.reduce((sum, e) => sum + e.hours, 0);
        const projectCount = new Set(timesheets.map(e => e.projectId)).size;
        
        document.getElementById('timesheetSummary').innerHTML = `
            <div class="summary-card">
                <div class="label">Total Hours Logged</div>
                <div class="number">${totalHours.toFixed(1)}h</div>
            </div>
            <div class="summary-card">
                <div class="label">Projects Worked On</div>
                <div class="number">${projectCount}</div>
            </div>
            <div class="summary-card">
                <div class="label">Total Entries</div>
                <div class="number">${timesheets.length}</div>
            </div>
        `;
        
        hideLoading();
        
    } catch (error) {
        console.error('Error loading timesheets:', error);
        alert('Error loading timesheets: ' + error.message);
        hideLoading();
    }
}

// Delete timesheet entry
async function deleteTimesheet(timesheetId) {
    if (!confirm('Are you sure you want to delete this timesheet entry?')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await apiCall(`timesheets?id=${timesheetId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            alert('Timesheet entry deleted successfully');
            loadTimesheets();
        } else {
            throw new Error(response.error || 'Failed to delete');
        }
        
    } catch (error) {
        console.error('Error deleting timesheet:', error);
        alert('Error deleting timesheet: ' + error.message);
    } finally {
        hideLoading();
    }
}

// ==========================================
// ADDITIONAL WORKFLOW FUNCTIONS
// ==========================================

// NOTE: Estimator form already exists as showEstimationModal() - available when status='draft'
// Wrapper function for compatibility
function showEstimateForm(proposalId) {
    if (typeof showEstimationModal === 'function') {
        showEstimationModal(proposalId);
    }
}

// Show Pricing Form (for COO role) - Note: showCOOPricingForm already exists, this is an alternate entry point
function showPricingForm(proposalId) {
    // Use the existing showCOOPricingForm function
    if (typeof showCOOPricingForm === 'function') {
        showCOOPricingForm(proposalId);
    }
}

// Show Client Outcome Form (for BDM role)
function showClientOutcomeForm(proposalId) {
    const modalHtml = `
        <div class="modal" id="clientOutcomeModal" style="display: flex;">
            <div class="modal-content new-modal">
                <div class="modal-header">
                    <h3>Submit Client Outcome</h3>
                    <button class="close" onclick="closeClientOutcomeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="clientOutcomeForm">
                        <div class="form-group">
                            <label>Client Response File</label>
                            <div class="upload-area" onclick="document.getElementById('clientResponseFile').click()">
                                <div class="upload-icon">📎</div>
                                <p>Click to choose file</p>
                            </div>
                            <input type="file" id="clientResponseFile" style="display: none;">
                            <div id="clientFileList" style="margin-top: 1rem;"></div>
                        </div>
                        
                        <div class="form-group">
                            <label>Outcome *</label>
                            <select class="form-control" id="clientOutcome" required>
                                <option value="">Select outcome</option>
                                <option value="won">Won</option>
                                <option value="loss">Loss</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Comments</label>
                            <textarea class="form-control" id="clientComments"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeClientOutcomeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="submitClientOutcome('${proposalId}')">Submit Outcome</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // File input handler
    document.getElementById('clientResponseFile').addEventListener('change', function() {
        const fileList = document.getElementById('clientFileList');
        if (this.files.length > 0) {
            const file = this.files[0];
            fileList.innerHTML = `<div style="padding: 0.5rem; background: var(--light-blue); border-radius: 6px;">📄 ${file.name} (${(file.size / 1024).toFixed(2)} KB)</div>`;
        } else {
            fileList.innerHTML = '';
        }
    });
}

function closeClientOutcomeModal() {
    const modal = document.getElementById('clientOutcomeModal');
    if (modal) modal.remove();
}

// Submit Client Outcome
async function submitClientOutcome(proposalId) {
    const outcome = document.getElementById('clientOutcome').value;
    const comments = document.getElementById('clientComments').value;
    const file = document.getElementById('clientResponseFile').files[0];
    
    if (!outcome) {
        alert('Please select an outcome');
        return;
    }
    
    try {
        showLoading();
        
        const formData = new FormData();
        formData.append('outcome', outcome);
        formData.append('comments', comments);
        if (file) {
            formData.append('client_response_file', file);
        }
        
        const response = await apiCall(`proposals/${proposalId}/client-outcome`, {
            method: 'POST',
            body: formData
        });
        
        if (response.success) {
            closeClientOutcomeModal();
            alert(`Proposal marked as ${outcome}!`);
            if (typeof showProposals === 'function') {
                showProposals();
            } else if (typeof showDashboard === 'function') {
                showDashboard();
            }
        } else {
            throw new Error(response.error || 'Failed to submit outcome');
        }
        
    } catch (error) {
        console.error('Error submitting client outcome:', error);
        alert('Error submitting outcome: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Show Allocation Form (for COO/Director) - Note: showProjectAllocationModal already exists
function showAllocationForm(proposalId) {
    // Use the existing showProjectAllocationModal function
    if (typeof showProjectAllocationModal === 'function') {
        showProjectAllocationModal(proposalId);
    }
}

// Show Designer Assignment Form (for Design Manager)
function showDesignerAssignment(projectId) {
    // Use the existing assignDesigners function
    if (typeof assignDesigners === 'function') {
        assignDesigners(projectId);
    }
}

// Show Submit Design Form (for Design Manager)
function showSubmitDesign(projectId) {
    const modalHtml = `
        <div class="modal" id="submitDesignModal" style="display: flex;">
            <div class="modal-content new-modal">
                <div class="modal-header">
                    <h3>Submit Final Design</h3>
                    <button class="close" onclick="closeSubmitDesignModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="submitDesignForm">
                        <div class="form-group">
                            <label>Final Design Files *</label>
                            <div class="upload-area" onclick="document.getElementById('designFiles').click()">
                                <div class="upload-icon">📎</div>
                                <p>Click to choose files</p>
                            </div>
                            <input type="file" id="designFiles" multiple required style="display: none;">
                            <div id="designFileList" style="margin-top: 1rem;"></div>
                        </div>
                        
                        <div class="form-group">
                            <label>Remarks</label>
                            <textarea class="form-control" id="designRemarks"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeSubmitDesignModal()">Cancel</button>
                    <button class="btn btn-success" onclick="submitFinalDesign('${projectId}')">Submit to Client</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // File input handler
    document.getElementById('designFiles').addEventListener('change', function() {
        const fileList = document.getElementById('designFileList');
        if (this.files.length > 0) {
            fileList.innerHTML = Array.from(this.files).map(file => `
                <div style="padding: 0.5rem; background: var(--light-blue); border-radius: 6px; margin-bottom: 0.5rem;">
                    📄 ${file.name} (${(file.size / 1024).toFixed(2)} KB)
                </div>
            `).join('');
        } else {
            fileList.innerHTML = '';
        }
    });
}

function closeSubmitDesignModal() {
    const modal = document.getElementById('submitDesignModal');
    if (modal) modal.remove();
}

// Submit Final Design
async function submitFinalDesign(projectId) {
    const files = document.getElementById('designFiles').files;
    const remarks = document.getElementById('designRemarks').value;
    
    if (files.length === 0) {
        alert('Please attach final design files');
        return;
    }
    
    try {
        showLoading();
        
        const formData = new FormData();
        for (let file of files) {
            formData.append('attachments', file);
        }
        formData.append('remarks', remarks);
        
        const response = await apiCall(`projects/${projectId}/submit-design`, {
            method: 'POST',
            body: formData
        });
        
        if (response.success) {
            closeSubmitDesignModal();
            alert('Design submitted successfully!');
            if (typeof showProjects === 'function') {
                showProjects();
            } else if (typeof showDashboard === 'function') {
                showDashboard();
            }
        } else {
            throw new Error(response.error || 'Failed to submit design');
        }
        
    } catch (error) {
        console.error('Error submitting design:', error);
        alert('Error submitting design: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Mark Project Complete (for Design Manager)
async function markComplete(projectId) {
    if (!confirm('Mark this project as complete?')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await apiCall(`projects/${projectId}/complete`, {
            method: 'POST'
        });
        
        if (response.success) {
            alert('Project marked as complete!');
            if (typeof showProjects === 'function') {
                showProjects();
            } else if (typeof showDashboard === 'function') {
                showDashboard();
            }
        } else {
            throw new Error(response.error || 'Failed to mark complete');
        }
        
    } catch (error) {
        console.error('Error marking complete:', error);
        alert('Error marking project complete: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Update Total Assigned Hours (for Designer Assignment)
function updateTotalAssigned() {
    let total = 0;
    const hoursInputs = document.querySelectorAll('.hours-input');
    hoursInputs.forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    const totalElement = document.getElementById('totalAssignedHours');
    if (totalElement) {
        totalElement.textContent = total.toFixed(1);
    }
}

// Add Designer Assignment Row
function addDesignerRow() {
    const container = document.getElementById('designerAssignmentRows');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr auto; gap: 1rem; margin-bottom: 1rem;';
    row.innerHTML = `
        <div class="form-group">
            <select class="form-control designer-select">
                <option value="">Select Designer</option>
            </select>
        </div>
        <div class="form-group">
            <input type="number" step="0.1" class="form-control hours-input" 
                   placeholder="Hours" onchange="updateTotalAssigned()">
        </div>
        <button type="button" class="btn btn-danger btn-sm" onclick="removeDesignerRow(this)">×</button>
    `;
    container.appendChild(row);
    
    // Load designers for new row
    if (typeof loadDesigners === 'function') {
        loadDesigners();
    }
}

function removeDesignerRow(btn) {
    btn.parentElement.remove();
    updateTotalAssigned();
}

// Load Designers for Assignment
async function loadDesigners() {
    try {
        const response = await apiCall('users?role=designer');
        
        if (response.success && response.data) {
            document.querySelectorAll('.designer-select').forEach(select => {
                // Keep first option
                const firstOption = select.querySelector('option:first-child');
                select.innerHTML = '';
                if (firstOption) {
                    select.appendChild(firstOption);
                }
                
                response.data.forEach(designer => {
                    const option = document.createElement('option');
                    option.value = designer.id;
                    option.textContent = designer.name;
                    select.appendChild(option);
                });
            });
        }
    } catch (error) {
        console.error('Error loading designers:', error);
    }
}

// Load Design Managers for Allocation
async function loadDesignManagers() {
    try {
        const response = await apiCall('users?role=design_manager');
        const select = document.getElementById('designManagerId');
        
        if (response.success && response.data && select) {
            response.data.forEach(manager => {
                const option = document.createElement('option');
                option.value = manager.id;
                option.textContent = manager.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading design managers:', error);
    }
}

// Add Pricing Row (for COO Pricing)
function addPricingRow() {
    const container = document.getElementById('pricingRows');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 1rem; margin-bottom: 1rem;';
    row.innerHTML = `
        <input type="text" class="form-control" placeholder="Description" />
        <input type="number" step="0.01" class="form-control" placeholder="Unit Cost" />
        <input type="number" step="0.1" class="form-control" placeholder="Qty/Hours" />
        <button type="button" class="btn btn-danger btn-sm" onclick="removePricingRow(this)">×</button>
    `;
    container.appendChild(row);
}

function removePricingRow(btn) {
    btn.parentElement.remove();
}


// ============================================
// DESIGNER TASKS/PROJECTS VIEW
// ============================================

// This function now correctly injects the HTML into 'mainContent'
async function showTasks() {
    setActiveNav('nav-tasks');
    const main = document.getElementById('mainContent');
    main.style.display = 'block'; // <-- FIX: Ensure main content is visible
    
    showLoading();
    
    try {
        // Fetch projects assigned to this designer
        const response = await apiCall('projects?assignedToMe=true');
        
        if (!response.success) {
            throw new Error('Failed to load projects');
        }
        
        const projects = response.data || [];
        
        const projectsHtml = projects.length > 0 ? projects.map(project => `
            <div class="project-card">
                <div class="project-header">
                    <h3>${project.projectName || 'Untitled Project'}</h3>
                    <span class="project-status ${project.status}">${project.status}</span>
                </div>
                <div class="project-details">
                    <p><strong>Client:</strong> ${project.clientCompany || 'N/A'}</p>
                    <p><strong>Project Code:</strong> ${project.projectCode || 'N/A'}</p>
                    <p><strong>Target Date:</strong> ${project.targetCompletionDate ? formatDate(project.targetCompletionDate) : 'Not set'}</p>
                    <p><strong>Status:</strong> ${project.designStatus || 'N/A'}</p>
                    <p><strong>Design Manager:</strong> ${project.designLeadName || 'N/A'}</p>
                </div>
                <div class="project-actions">
                    <button class="btn btn-primary" onclick="showDesignerUploadModal('${project.id}')">
                        📤 Upload Files
                    </button>
                    <button class="btn btn-outline" onclick="viewProjectDetails('${project.id}')">
                        👁️ View Details
                    </button>
                </div>
            </div>
        `).join('') : '<p style="text-align: center; padding: 2rem; color: var(--text-light);">No projects assigned yet.</p>';
        
        // <-- FIX: Inject HTML into main.innerHTML
        main.innerHTML = `
            <div class="page-header">
                <h2>📋 My Projects</h2>
                <p class="subtitle">Projects assigned to you</p>
            </div>
            
            <div class="dashboard-stats">
                <div class="stat-card">
                    <div class="stat-number">${projects.length}</div>
                    <div class="stat-label">Total Projects</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${projects.filter(p => p.status === 'active').length}</div>
                    <div class="stat-label">Active Projects</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${projects.filter(p => p.status === 'completed').length}</div>
                    <div class="stat-label">Completed</div>
                </div>
            </div>
            
            <div class="action-section">
                <h3>Your Projects</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem;">
                    ${projectsHtml}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading tasks:', error);
        main.innerHTML = `<div class="error-message">Failed to load projects: ${error.message}</div>`;
    } finally {
        hideLoading();
    }
}

function viewProjectDetails(projectId) {
    // Simple project details view
    apiCall(`projects?id=${projectId}`).then(response => {
        if (!response.success || !response.data) {
            alert('Failed to load project details');
            return;
        }
        
        const project = response.data;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'projectDetailsModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>📋 Project Details</h3>
                    <button class="modal-close" onclick="closeProjectDetailsModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div><strong>Project Name:</strong><br>${project.projectName || 'N/A'}</div>
                        <div><strong>Client:</strong><br>${project.clientCompany || 'N/A'}</div>
                        <div><strong>Project Code:</strong><br>${project.projectCode || 'N/A'}</div>
                        <div><strong>Status:</strong><br><span class="status-badge">${project.status}</span></div>
                        <div><strong>Design Manager:</strong><br>${project.designLeadName || 'N/A'}</div>
                        <div><strong>Target Date:</strong><br>${project.targetCompletionDate ? formatDate(project.targetCompletionDate) : 'Not set'}</div>
                        <div style="grid-column: 1 / -1;"><strong>Description:</strong><br>${project.projectDescription || 'No description provided'}</div>
                        <div style="grid-column: 1 / -1;"><strong>Special Instructions:</strong><br>${project.specialInstructions || 'None'}</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="showDesignerUploadModal('${projectId}'); closeProjectDetailsModal();">
                        📤 Upload Files
                    </button>
                    <button class="btn btn-outline" onclick="closeProjectDetailsModal()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    });
}

function closeProjectDetailsModal() {
    const modal = document.getElementById('projectDetailsModal');
    if (modal) modal.remove();
}

// ============================================
// SHOW SECTION FUNCTION FOR NAV ITEMS
// ============================================

async function showSection(sectionName) {
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    showLoading();

    try {
        if (sectionName === 'timesheet') {
            setActiveNav('nav-timesheet');
            const templateContent = document.getElementById('timesheetSection');
            if (!templateContent) throw new Error('Timesheet template not found');
            main.innerHTML = templateContent.outerHTML.replace('style="display: none;"', 'style="display: block;"');
            await loadDesignerTimesheet();
        } else if (sectionName === 'executiveMonitoring') {
            setActiveNav('nav-executive');
            const templateContent = document.getElementById('executiveTimesheetMonitoring');
            if (!templateContent) throw new Error('Executive Monitoring template not found');
            main.innerHTML = templateContent.outerHTML.replace('style="display: none;"', 'style="display: block;"');
            await loadExecutiveMonitoring();
        }
        hideLoading();
    } catch (error) {
        console.error('❌ Section load error:', error);
        main.innerHTML = `<div class="error-message"><h3>⚠️ Error Loading Section</h3><p>${error.message}</p></div>`;
        hideLoading();
    }
}

// ============================================
// DESIGNER TIMESHEET FUNCTIONS
// ============================================
async function loadDesignerTimesheet() {
    try {
        showLoading();
        
        // Load designer's projects
        const projectsResponse = await apiCall('projects?assignedToMe=true');
        const timesheetResponse = await apiCall('timesheets');
        
        if (!projectsResponse.success || !timesheetResponse.success) {
            throw new Error('Failed to load timesheet data');
        }
        
        const projects = projectsResponse.data || [];
        const entries = timesheetResponse.data || [];
        
        // Calculate summary
        const thisWeekHours = entries
            .filter(e => isThisWeek(e.date))
            .reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
        
        const thisMonthHours = entries
            .filter(e => isThisMonth(e.date))
            .reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
        
        // Update summary
        const summaryDiv = document.getElementById('timesheetSummary');
        if (summaryDiv) {
            summaryDiv.innerHTML = `
                <div class="stat-card" style="background: white; border: 2px solid var(--border); border-radius: 10px; padding: 1rem; text-align: center;">
                    <div class="stat-label" style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 0.5rem;">This Week</div>
                    <div class="stat-value" style="font-size: 2.5rem; font-weight: 700; color: var(--primary-blue);">${thisWeekHours.toFixed(1)}h</div>
                </div>
                <div class="stat-card" style="background: white; border: 2px solid var(--border); border-radius: 10px; padding: 1rem; text-align: center;">
                    <div class="stat-label" style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 0.5rem;">This Month</div>
                    <div class="stat-value" style="font-size: 2.5rem; font-weight: 700; color: var(--primary-blue);">${thisMonthHours.toFixed(1)}h</div>
                </div>
                <div class="stat-card" style="background: white; border: 2px solid var(--border); border-radius: 10px; padding: 1rem; text-align: center;">
                    <div class="stat-label" style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 0.5rem;">Active Projects</div>
                    <div class="stat-value" style="font-size: 2.5rem; font-weight: 700; color: var(--primary-blue);">${projects.length}</div>
                </div>
            `;
        }
        
        // Update table
        const tbody = document.getElementById('timesheetTableBody');
        if (tbody) {
            if (entries.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No timesheet entries yet</td></tr>';
            } else {
                tbody.innerHTML = entries.map(entry => `
                    <tr>
                        <td>${formatDate(entry.date)}</td>
                        <td>${entry.projectName || 'N/A'}</td>
                        <td>${entry.hours}h</td>
                        <td>${entry.description || '-'}</td>
                        <td><span class="status-badge status-${entry.status || 'pending'}">${entry.status || 'Pending'}</span></td>
                        <td>
                            ${entry.status === 'pending' ? 
                                `<button onclick="editTimesheetEntry('${entry.id}')" class="btn btn-sm">Edit</button>
                                 <button onclick="deleteTimesheetEntry('${entry.id}')" class="btn btn-sm btn-danger">Delete</button>` 
                                : '-'}
                        </td>
                    </tr>
                `).join('');
            }
        }
        
    } catch (error) {
        console.error('Error loading timesheet:', error);
        alert('Failed to load timesheet: ' + error.message);
    } finally {
        hideLoading();
    }
}

function closeTimesheetModal() {
    const modal = document.getElementById('timesheetModal');
    if (modal) modal.remove();
    // Also call general close modal just in case
    closeModal();
}

async function deleteTimesheetEntry(entryId) {
    if (!confirm('Delete this timesheet entry?')) return;
    
    try {
        showLoading();
        const response = await apiCall(`timesheets?id=${entryId}`, { method: 'DELETE' });
        
        if (response.success) {
            alert('Entry deleted');
            loadDesignerTimesheet();
        } else {
            throw new Error(response.error || 'Failed to delete');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Helper functions for date filtering
function isThisWeek(dateObj) {
    if (!dateObj || !dateObj.seconds) return false;
    const date = new Date(dateObj.seconds * 1000);
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    weekStart.setHours(0, 0, 0, 0);
    return date >= weekStart;
}

function isThisMonth(dateObj) {
    if (!dateObj || !dateObj.seconds) return false;
    const date = new Date(dateObj.seconds * 1000);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

// ============================================
// DESIGNER PROJECT UPLOAD FUNCTIONS
// ============================================
function showDesignerUploadModal(projectId) {
    
    // Close existing modal if any
    closeModal();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'designerUploadModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>Upload Project Files</h2>
                <span class="close-modal" onclick="closeDesignerUploadModal()">&times;</span>
            </div>
            <div class="modal-body">
                <form id="designerUploadForm" onsubmit="submitDesignerUpload(event, '${projectId}')">
                    <div class="form-group">
                        <label>Upload Files *</label>
                        <div class="upload-area" onclick="document.getElementById('designerFiles').click()" 
                             style="border: 2px dashed var(--border); padding: 2rem; text-align: center; cursor: pointer; border-radius: 8px;">
                            <p>📁 Click to select files or drag and drop</p>
                            <small style="color: var(--text-light);">Supported: PDF, DWG, ZIP, Images (Max 50MB each)</small>
                        </div>
                        <input type="file" id="designerFiles" multiple accept=".pdf,.dwg,.zip,.jpg,.jpeg,.png" 
                               style="display: none;" onchange="updateDesignerFileList()">
                        <div id="designerFileList" style="margin-top: 1rem;"></div>
                    </div>
                    
                    <div class="form-group">
                        <label>File Description</label>
                        <textarea id="designerFileDescription" class="form-control" rows="3" 
                                  placeholder="Describe what you're uploading..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Status Update</label>
                        <select id="designerProjectStatus" class="form-control">
                            <option value="in_progress">Work in Progress</option>
                            <option value="review">Ready for Review</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeDesignerUploadModal()">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="submitDesignerUpload(event, '${projectId}')">Upload Files</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeDesignerUploadModal() {
    const modal = document.getElementById('designerUploadModal');
    if (modal) modal.remove();
    closeModal();
}

function updateDesignerFileList() {
    const input = document.getElementById('designerFiles');
    const fileList = document.getElementById('designerFileList');
    
    if (input.files.length > 0) {
        fileList.innerHTML = '<strong>Selected files:</strong><ul style="margin-top: 0.5rem;">' +
            Array.from(input.files).map(f => `<li>${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)</li>`).join('') +
            '</ul>';
    } else {
        fileList.innerHTML = '';
    }
}

async function submitDesignerUpload(event, projectId) {
    if(event) event.preventDefault();
    
    const files = document.getElementById('designerFiles').files;
    if (files.length === 0) {
        alert('Please select at least one file');
        return;
    }
    
    try {
        showLoading();
        
        const formData = new FormData();
        for (let file of files) {
            formData.append('files', file);
        }
        formData.append('description', document.getElementById('designerFileDescription').value);
        formData.append('status', document.getElementById('designerProjectStatus').value);
        
        const response = await apiCall(`projects/${projectId}/upload-designer-files`, {
            method: 'POST',
            body: formData
        });
        
        if (response.success) {
            closeDesignerUploadModal();
            alert('Files uploaded successfully!');
            // Reload designer dashboard or project view
            if (typeof showTasks === 'function' && document.getElementById('mainContent').querySelector('h2').innerText.includes('My Projects')) {
                showTasks();
            }
        } else {
            throw new Error(response.error || 'Upload failed');
        }
        
    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Error uploading files: ' + error.message);}
} //
