/**
 * quotation_generator.js
 * Handles the generation of Word documents (.docx) from the BDM Portal data.
 * Requires: docxtemplater, pizzip, FileSaver, pizzip-utils
 */

// Load the binary content of the template file
function loadFile(url, callback) {
    PizZipUtils.getBinaryContent(url, callback);
}

async function generateWordQuote(proposalId) {
    console.log("📄 Generating Word Quote for ID:", proposalId);

    // 1. Fetch Proposal Data using the existing apiCall from index.html
    try {
        const response = await apiCall(`proposals?id=${proposalId}`);
        if (!response.success || !response.data) {
            alert("Failed to fetch proposal data for quotation generation.");
            return;
        }
        const proposal = response.data;

        // 2. Prepare Data Object (Mapping DB fields to Word Template tags)
        const quoteData = {
            quote_no: proposal.pricing?.projectNumber || "DRAFT",
            project_name: proposal.projectName || "N/A",
            client_company: proposal.clientCompany || "N/A",
            client_contact: proposal.clientContact || "Client", // Ensure this field exists or default
            date: new Date().toLocaleDateString('en-GB'), // Format: DD/MM/YYYY
            price: proposal.pricing?.quoteValue ? proposal.pricing.quoteValue.toLocaleString() : "0.00",
            currency: proposal.pricing?.currency || "$",
            lead_time: proposal.timeline || "TBD",
            
            // Additional fields based on your document
            bdm_name: currentUser ? currentUser.displayName : "Sales Team",
            variation_rate: proposal.pricing?.hourlyRate || "20"
        };

        // 3. Load the Template and Render
        // Note: You must place 'proposal_template.docx' in your root directory
        loadFile("./proposal_template.docx", function (error, content) {
            if (error) {
                console.error("Error loading template:", error);
                alert("Error loading 'proposal_template.docx'. Please ensure the file exists in the root folder.");
                return;
            }

            try {
                const zip = new PizZip(content);
                const doc = new window.docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                });

                // Render the document (replace tags with data)
                doc.render(quoteData);

                // Get the binary output
                const out = doc.getZip().generate({
                    type: "blob",
                    mimeType:
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                });

                // 4. Save the file
                const filename = `Quote_${quoteData.quote_no}_${quoteData.project_name.replace(/[^a-z0-9]/gi, '_')}.docx`;
                saveAs(out, filename);
                
                console.log("✅ Word document generated successfully");

            } catch (error) {
                console.error("Error generating document:", error);
                
                // Handle Docxtemplater errors specifically
                if (error.properties && error.properties.errors) {
                    const errorMessages = error.properties.errors.map(function (err) {
                        return err.properties.explanation;
                    }).join("\n");
                    console.log("Template Errors:", errorMessages);
                    alert("Template Error: " + errorMessages);
                } else {
                    alert("Error generating document: " + error.message);
                }
            }
        });

    } catch (apiError) {
        console.error("API Error during quote generation:", apiError);
        alert("Failed to retrieve proposal data.");
    }
}

// Attach function to window to ensure visibility
window.generateWordQuote = generateWordQuote;
