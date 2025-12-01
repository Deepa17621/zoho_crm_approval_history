//Global Variables
let filterObject = {
    module: "",
    action: "",
    search: ""
};
let allRecords = {};
let env_details;

ZOHO.embeddedApp.on("PageLoad", async function (data) {

    // i. Get Environment Details
    env_details = await ZOHO.CRM.CONFIG.GetCurrentEnvironment();

    // 1. Get Approval History and Filter the Records - map the duplicated under single record ID.
    let approvalHistory = await getApprovals();

    // Filter the present Modules name from current Approval Records.
    let currentApprovalModules = Object.keys(approvalHistory).reduce((acc, val) => {
        acc[approvalHistory[`${val}`][0]["module"]] = (acc[approvalHistory[`${val}`][0]["module"]] || 0) + 1;
        return acc;
    }, {})

    // 2. Build Table with records
    buildTable(approvalHistory);

    // Add Modules to the Dropdown of the Modules Column
    let moduelsDropDownContainer = document.querySelector("#module-dropdown");

    for (const moduleName in currentApprovalModules) {
        let optionDiv = document.createElement("div");
        optionDiv.classList.add("option");
        optionDiv.textContent = moduleName;
        moduelsDropDownContainer.appendChild(optionDiv);
    }
    // Handle all dropdown headers
    document.querySelectorAll(".dropdown-header").forEach(header => {

        const dropdownId = header.dataset.dropdown;
        const labelId = header.dataset.label;
        const dropdown = document.getElementById(dropdownId);
        const label = document.getElementById(labelId);

        const searchInput = dropdown.querySelector(".searchInput");
        const options = Array.from(dropdown.querySelectorAll(".option"));

        // Open/close dropdown on click
        header.addEventListener("click", function (event) {
            const isOpen = dropdown.style.display === "block";
            // Close all other dropdowns
            document.querySelectorAll(".dropdown-container").forEach(d => d.style.display = "none");
            dropdown.style.display = isOpen ? "none" : "block";
            searchInput.value = "";
            filterOptions();
            searchInput.focus();
            event.stopPropagation();
        });

        // Update label and tick on option click
        options.forEach(option => {
            option.addEventListener("click", function () {
                options.forEach(opt => opt.classList.remove("selected"));
                this.classList.add("selected");
                label.textContent = this.textContent;

                (label.id == "moduleLabel") ? filterObject["module"] = this.textContent : filterObject["action"] = (this.textContent == "Pending") ? ["Submitted", "Delegated"] : (this.textContent == "Approved") ? "Final_Approval" : this.textContent;
                // console.log(document.querySelectorAll(`#mainTable tr[data-value='${(label.id === "moduleLabel")?moduleSelect:statusSelect}']`));

                if (this.textContent == "All Modules") {
                    filterObject["module"] = "";
                }
                else if (this.textContent == "All Status") {
                    filterObject["action"] = "";
                }
                applyFilter(filterObject);

                dropdown.style.display = "none";
            });
        });

        // Filter options based on search input
        searchInput.addEventListener("input", filterOptions);

        function filterOptions() {
            const filter = searchInput.value.toLowerCase();
            options.forEach(option => {
                option.style.display = option.textContent.toLowerCase().includes(filter) ? "flex" : "none";
            });
        }
    });

    document.querySelector("#search-record").addEventListener("input", (e) => {
        // filters.search = this.value.trim();   // update filter live

        filterObject["search"] = e.target.value.trim();
        applyFilter(filterObject);
    })

    // Clear All Filter
    document.querySelector("#clr-filter-txt").addEventListener("click", clearFilter);

});

async function getApprovals() {
    let approvalHistory = await ZOHO.CRM.API.getApprovalsHistory();
    let data = await approvalHistory;

    const filteredObject = data.data.reduce((acc, item) => {
        if (!acc[item.record.id]) {
            acc[item.record.id] = [];
        }
        acc[item.record.id].push(item);
        return acc;
    }, {});

    return filteredObject;
}

// async function buildTable(filteredObject, env_details) {

//     let domainDetails = {
//         "US": ".com",
//         "AU": ".com.au",
//         "EU": ".eu",
//         "IN": ".in",
//         "CN": ".com.cn",
//         "JP": ".jp",
//         "CA": ".zohocloud.ca"
//     }
//     const tbody = document.getElementById("recordBody");
//     let index = 0;   // Since I'm using for each, explicit index has been used.

//     for (const id in filteredObject) {
//         if (filteredObject[id][0].action === "Submitted" && filteredObject[id].length === 1) continue;
//         index++;
//         let overAllStatus = filteredObject[id][0].action === "Final_Approval" ? "Approved" : (filteredObject[id][0].action === "Submitted" ? "Pending" : (filteredObject[id][0].action == "Delegated") ? "Pending" : filteredObject[id][0].action);

//         tbody.innerHTML += `
//         <tr class="row" data-id="${id}" data-value="${filteredObject[id][0].module}">
//             <td class="recordName">${filteredObject[id][0].record.name}</td>
//             <td>${filteredObject[id][0].module}</td>
//             <td><span class="tag ${overAllStatus.toLowerCase()}">${overAllStatus}</span></td>
//             <td><button class="zbtn" onclick="toggle(${index})">View</button></td>

//             <tr id="approver-${index}" class="approver-row">
//             <td colspan="4">
//                 <div class="mini-header">Approver List</div>

//                 <table class="mini-table">
//                     <thead>
//                         <tr>
//                             <th>Approver</th>
//                             <th>Status</th>
//                             <th>Comment</th>
//                         </tr>
//                     </thead>
//                     <tbody></tbody>
//                 </table>
//             </td>
//         </tr>
//         </tr>
//     `;

//     };

//     document.querySelectorAll(".row").forEach(element => {
//         // View Record In Module.
//         element.querySelector(".recordName").addEventListener('click', () => {
//             const id = element.dataset.id;
//             const value = element.dataset.value;
//             window.open(`https://crm.zoho${domainDetails[env_details.deployment]}/crm/org${env_details.zgid}/tab/${value}/${id}/`)
//         });
//     });


// }



async function buildTable(filteredObject) {
    allRecords = filteredObject;

    applyFilter({}); 
}


function applyFilter(filters) {
    const tbody = document.getElementById("recordBody");
    tbody.innerHTML = ""; // clear existing rows

    const filtered = getFilteredRecords(filters);

    filtered.forEach((record, index) => {
        tbody.appendChild(createRow(record, index));
        tbody.appendChild(createApproverRow(record, index));
    });
}

function getFilteredRecords(filters) {
    let result = [];
    for (const id in allRecords) {
        const record = allRecords[id][0];

        // Skip default unwanted records
        if (record.action === "Submitted" && allRecords[id].length === 1) {
            continue;
        }

        let match = true;

        // Check each filter
        for (const key in filters) {
            if (!filters[key]) continue;

            if (key == "search") {
                const searchText = filters.search.toLowerCase();
                const name = record.record.name.toLowerCase();

                if (!name.includes(searchText)) {
                    match = false;
                    break;
                }
                continue;
            }

            // Module / Status / Action filters
            const allowed = key === "action" ? filters[key] : [filters[key]];
            if (!allowed.includes(record[key])) {
                match = false;
                break;
            }
        }

        if (match) result.push(allRecords[id]);
    }

    return result;
}


function clearFilter() {
    for (const key in filterObject) {
        filterObject[key] = "";
    }
    document.querySelector("#search-record").value = "";
    document.querySelector("#moduleLabel").textContent= "All Modules";
    document.querySelector("#statusLabel").textContent = "All Status";
    applyFilter({}); 
}

// ---------------- CREATE ROW ELEMENTS ---------------------

function createRow(obj, index) {
    const wrapper = document.createElement("tr");
    const data = obj[0];

    const overAllStatus =
        data.action === "Final_Approval"
            ? "Approved"
            : data.action === "Submitted" || data.action === "Delegated"
                ? "Pending"
                : data.action;

    wrapper.className = "row";
    wrapper.dataset.id = data.record.id;
    wrapper.dataset.value = data.module;

    wrapper.innerHTML = `
        <td class="recordName">${data.record.name}</td>
        <td>${data.module}</td>
        <td><span class="tag ${overAllStatus.toLowerCase()}">${overAllStatus}</span></td>
        <td><button class="zbtn" onclick="toggle(${index})">View</button></td>
    `;

    // Add record click event
    wrapper.querySelector(".recordName").addEventListener("click", () => {
        viewRecord(data);
    });

    return wrapper;
}


function createApproverRow(obj, index) {
    const row = document.createElement("tr");
    row.className = "approver-row";
    row.id = `approver-${index}`;
    row.style.display = "none";

    row.innerHTML = `
        <td colspan="4">
            <div class="mini-header">Approver List</div>
            <table class="mini-table">
                <thead>
                    <tr>
                        <th>Approver</th>
                        <th>Status</th>
                        <th>TimeStamp</th>
                        <th>Comment</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </td>
    `;

    return row;
}

function viewRecord(data) {

    const domainDetails = {
        "US": ".com",
        "AU": ".com.au",
        "EU": ".eu",
        "IN": ".in",
        "CN": ".com.cn",
        "JP": ".jp",
        "CA": ".zohocloud.ca"
    };

    window.open(
        `https://crm.zoho${domainDetails[env_details.deployment]}/crm/org${env_details.zgid}/tab/${data.module}/${data.record.id}/`
    );
}

function toggle(index) {
    let connectionName = "approvalhistory";
    const row = document.getElementById(`approver-${index}`);
    const mainRow = row.previousElementSibling;

    const id = mainRow.dataset.id;
    const module = mainRow.dataset.value;

    // 4. TimeLine Details to get comments
    let url = `https://www.zohoapis.com/crm/v8/${module === "Potentials" ? "Deals" : module}/${id}/__timeline?filters=%7B%22field%22%3A%7B%22api_name%22%3A%22source%22%7D%2C%22comparator%22%3A%22equal%22%2C%22value%22%3A%22approval_process%22%7D%20`;

    let req_data = {
        "url": url,
        "method": "GET",
    }
    ZOHO.CRM.CONNECTION.invoke(connectionName, req_data).then(function (data) {
        //------------------------Approval Details
        // var req_data1 = {
        //         "method": "GET",
        //         "url": `https://crm.zoho.com/crm/v2.2/${module}/${id}/actions/approval_details`,
        //     };
        //     ZOHO.CRM.CONNECTION.invoke(connectionName, req_data1).then(function (data) {
        //         console.log(data)
        //     });

        //---------------------
        let stages = data.details?.statusMessage?.__timeline;

        let trs = '';

        for (let j = stages.length - 2; j >= 0; j--) {

            const date = new Date(stages[j].audited_time);
            const options = { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true };
            const formattedAuditedTime = date.toLocaleString("en-US", options).replace(",", "");

            if (stages[j].action === "updated") continue;

            let status = '';
            if (stages[j].action === "final_approval") {
                status = "Approved";
            }
            else if (stages[j].action == "Submitted") {
                status = "Pending";
            }
            else {
                status = stages[j].action;
            }

            trs += `<tr>
                                <td>${stages[j].done_by.name}</td>
                                <td><span class="tag ${status.toLowerCase()}">${status}</span></td>
                                <td>${formattedAuditedTime}</td>
                                <td>${stages[j].automation_details.approval_process?.comments || "-"}</td>
                            </tr>`
        }
        let miniTable = row.querySelector(".mini-table").querySelector("tbody");
        miniTable.innerHTML = trs;
        row.style.display = row.style.display === "table-row" ? "none" : "table-row";
    });

}

ZOHO.embeddedApp.init();