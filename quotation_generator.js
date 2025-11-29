/**
 * quotation_generator.js
 * Specific version for Woodcraft R&D Sample Quote Structure
 */

// Helper: Load file from server
function loadFileFromServer(url, callback) {
    PizZipUtils.getBinaryContent(url, function (error, content) {
        if (error) {
            callback(error, null);
        } else {
            callback(null, content);
        }
    });
}

async function generateWordQuote(proposalId) {
    console.log("📄 Generating Quote for ID:", proposalId);

    // 1. Fetch Proposal Data
    try {
        if (typeof showLoading === 'function') showLoading();

        // Fetch data from your backend
        const response = await apiCall(`proposals?id=${proposalId}`);
        if (!response.success || !response.data) {
            alert("Failed to fetch proposal data.");
            if (typeof hideLoading === 'function') hideLoading();
            return;
        }
        const p = response.data;

        // 2. Prepare Data (Mapping Database Fields -> Word Tags)
        
        // Format services for the loop {#services}...{/services}
        // If p.estimation.services is ["Steel Detailing", "PE Stamping"], this creates an array of objects
        const servicesList = (p.estimation?.services || []).map(s => ({ name: s }));

        const quoteData = {
            // --- HEADER INFO ---
            quote_no: p.pricing?.projectNumber || "DRAFT",
            date: new Date().toLocaleDateString('en-GB'), // e.g., 18.11.2025
            
            // --- CLIENT INFO ---
            client_company: p.clientCompany || "Client Company",
            client_contact: p.clientContact || "Client Contact", // Ensure this field exists in your DB or it defaults
            project_name: p.projectName || "Project Name",

            // --- PRICING ---
            // Formats 1920 to "1,920.00"
            price: p.pricing?.quoteValue ? parseFloat(p.pricing.quoteValue).toLocaleString(undefined, {minimumFractionDigits: 2}) : "0.00",
            currency: p.pricing?.currency || "$",
            
            // --- VARIATION & TIMELINE ---
            // Maps to "$ 20 per hour" in your sample 
            var_rate: p.pricing?.hourlyRate || "20", 
            // Maps to "4 Days" in your sample 
            lead_time: p.timeline || p.pricing?.leadTime || "TBD", 

            // --- SIGNATORY ---
            // Maps to "Steve Peterson" 
            bdm_name: (currentUser && currentUser.displayName) ? currentUser.displayName : (p.createdByName || "Sales Team"),
            // Maps to "Business Development Coordinator" 
            bdm_role: (currentUser && currentUser.role) ? currentUser.role.toUpperCase() : "Business Development Manager",

            // --- SERVICES LOOP ---
            services: servicesList
        };

        // 3. Load Template and Render
        // Ensure you named your file exactly 'proposal_template.docx' and put it in the root folder
        loadFileFromServer("./proposal_template.docx", function(error, content) {
            if (error) {
                console.warn("⚠️ Template not found on server. Asking user for file...");
                
                // Fallback: Ask user to upload the file if not found on server
                const fileInput = document.getElementById('wordTemplateInput');
                if(!fileInput) {
                    alert("Template not found and no file input available."); 
                    return;
                }
                
                if(confirm("Server template missing. Click OK to select your 'proposal_template.docx' manually.")) {
                    fileInput.click();
                    fileInput.onchange = function(e) {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = function(evt) { renderDoc(evt.target.result, quoteData); };
                        reader.readAsBinaryString(file);
                    };
                }
                if (typeof hideLoading === 'function') hideLoading();
                return;
            }
            // If found on server, render immediately
            renderDoc(content, quoteData);
        });

    } catch (err) {
        console.error("Error:", err);
        alert("Error generating quote: " + err.message);
        if (typeof hideLoading === 'function') hideLoading();
    }
}

// Internal function to do the actual DocxTemplater rendering
function renderDoc(content, data) {
    try {
        const zip = new PizZip(content);
        const doc = new window.docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        doc.render(data);

        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        // Save file with dynamic name: Quote_Q_24417_ProjectName.docx
        const safeProjName = (data.project_name).replace(/[^a-z0-9]/gi, '_');
        saveAs(out, `Quote_${data.quote_no}_${safeProjName}.docx`);
        
        console.log("✅ Document generated.");
    } catch (error) {
        handleDocErrors(error);
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
}

function handleDocErrors(error) {
    if (error.properties && error.properties.errors) {
        const errorMessages = error.properties.errors.map(function (err) {
            return err.properties.explanation;
        }).join("\n");
        console.log("Template Errors:", errorMessages);
        alert("Template Error: The tags in your Word doc don't match the data.\n" + errorMessages);
    } else {
        console.log(error);
        alert("Error: " + error.message);
    }
}

// Attach to window
window.generateWordQuote = generateWordQuote;
