//Global Variables
let filterObject = {
    module: "",
    action: "",
    search: "",
    timeBase: ""
};
let specificDateFilter = '', rangeDateFilter = [];
let allRecords = {};
let env_details;
let allModules={};

ZOHO.embeddedApp.on("PageLoad", async function (data) {

    // i. Get Environment Details
    env_details = await ZOHO.CRM.CONFIG.GetCurrentEnvironment();

    // 1. Get Approval History and Filter the Records - map the duplicated under single record ID.
    let approvalHistory = await getApprovals();

    // GET ALL MODULES TO GET API Names of the Module
    let allModulesResponse = await ZOHO.CRM.META.getModules();
    let allModulesData = await allModulesResponse;
    allModulesData.modules.forEach(element => {
        allModules[element["module_name"]] = element["api_name"];
    });

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
            filterOptions();
            searchInput.focus();
            event.stopPropagation();
        });

        // Update label and tick on option click
        options.forEach(option => {
            option.addEventListener("click", function () {
                document.querySelector("#clr-filter-txt").style.display = "block";
                options.forEach(opt => opt.classList.remove("selected"));
                this.classList.add("selected");
                label.textContent = this.textContent;

                switch (label.id) {
                    case "moduleLabel":
                        filterObject.module = this.textContent;
                        break;

                    case "statusLabel":
                        if (this.textContent === "Pending") {
                            filterObject.action = ["Submitted", "Delegated"];
                        } else if (this.textContent === "Approved") {
                            filterObject.action = "Final_Approval";
                        } else {
                            filterObject.action = this.textContent;
                        }
                        break;
                    case "timeFilterLabel":
                        if (this.textContent.trim() === "On Specific date") {

                            document.querySelector(".calendar-wrapper").style.display = "block";
                            filterObject.timeBase = this.textContent.trim();
                            buildCalendar("singleCalendar", "single", (date) => {
                                let d = new Date(date);
                                specificDateFilter = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                if (specificDateFilter) {
                                    applyFilter(filterObject, specificDateFilter);
                                    document.querySelector(".calendar-wrapper").style.display = "none";
                                }
                            });
                            break;
                        }
                        else if (this.textContent.trim() === "Date Range") {

                            filterObject.timeBase = this.textContent.trim();
                            document.querySelector(".calendar-wrapper").style.display = "block";
                            buildCalendar("singleCalendar", "range", (start, end) => {
                                if (end) {
                                    let startDate = new Date(start);
                                    rangeDateFilter[0] = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
                                    let endDate = new Date(end);
                                    rangeDateFilter[1] = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
                                    if (rangeDateFilter[0] && rangeDateFilter[1]) {
                                        applyFilter(filterObject, rangeDateFilter[0]);
                                        document.querySelector(".calendar-wrapper").style.display = "none";
                                    }
                                }
                            });
                            break;
                        }
                        filterObject.timeBase = this.textContent;
                        break;
                }
                switch (this.textContent.trim()) {
                    case "All Modules":
                        filterObject.module = "";
                        break;
                    case "All Status":
                        filterObject.action = "";
                        break;
                    case "Anytime":
                        filterObject.timeBase = "";
                        break;
                }

                if (filterObject.timeBase.trim() == "Date Range" || filterObject.timeBase.trim() == "On Specific date") {
                }
                else {
                    applyFilter(filterObject);
                }
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
        filterObject["search"] = e.target.value.trim();
        applyFilter(filterObject);
    })

    // Clear All Filter
    document.querySelector("#clr-filter-txt").addEventListener("click", clearFilter);
    window.addEventListener('click', (e) => {
        let flag = false;
        let popUps = document.querySelectorAll(".dropdown-container");
        popUps.forEach(element => {
            if(element.contains(e.target)) flag = true;
            if(!flag){
                element.style.display = "none";
            }
            
        });
        // const clickedInsidePopup = popup.contains(e.target);
        // const clickedButton = btn.contains(e.target);

        // if (!flag) {
        //      // or style.display = 'none';
        // }
    });
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

async function buildTable(filteredObject) {
    allRecords = filteredObject;
    applyFilter({});
}


async function applyFilter(filters, d = "") {
    const tbody = document.getElementById("recordBody");
    tbody.innerHTML = ""; // clear existing rows

    const filtered = getFilteredRecords(filters, d);
    if (filtered.length <= 0) {
        let noRecordFoundHtml = `
             <tr class="no-records-found-tr">
                <td colspan="4" style="text-align: center; padding: 20px;">
                    <img src="../assets/no_record_img.jpg" alt="no records found!">
                    <div class="no-records-found-txt">No records match your filter</div>
                </td>
            </tr>   
        `;
        tbody.innerHTML = noRecordFoundHtml;
    }
    else {
        filtered.forEach((record, index) => {
            tbody.appendChild(createRow(record, index));
            tbody.appendChild(createApproverRow(record, index));
        });
    }

}

function getFilteredRecords(filters, d = "") {
    let result = [];
    let today = new Date();
    let yesterday = new Date();
    let sevenDaysAgo = new Date();
    let thirtyDaysAgo = new Date();

    yesterday.setDate(today.getDate() - 1);
    sevenDaysAgo.setDate(today.getDate() - 7);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    for (const id in allRecords) {
        const record = allRecords[id][0];

        // Skip default unwanted records
        // if (record.action === "Submitted" && allRecords[id].length === 1) {
        //     continue;
        // }

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
            else if (key === "action") {
                // Module / Status / Action filters
                const allowed = key === "action" ? filters[key] : [filters[key]];
                if (!allowed.includes(record[key])) {
                    match = false;
                    break;
                }
            }
            else if (key === "module") {
                if (filterObject.module !== record.module) {
                    match = false;
                    break;
                }
            }
            // Time Based Filter
            else if (key === "timeBase") {
                let recordAuditTime = new Date(record.audit_time);
                let date = new Date(recordAuditTime);
                let formatted = date.toISOString().slice(0, 10);

                if (filterObject[key] == "Today") {
                    if (today !== recordAuditTime) {
                        match = false;
                        break;
                    }
                }
                else if (filterObject[key] === "Last 7 days") {
                    if (recordAuditTime < sevenDaysAgo || recordAuditTime > today) {
                        match = false;
                        break;
                    }
                }

                else if (filterObject[key] === "Last 30 days") {
                    if (recordAuditTime < thirtyDaysAgo || recordAuditTime > today) {
                        match = false;
                        break;
                    }
                }
                else if (filterObject[key].trim() == "On Specific date") {
                    if (formatted !== specificDateFilter) {
                        match = false;
                        break;
                    }
                }
                else if (filterObject[key].trim() == "Date Range") {
                    if (!(new Date(rangeDateFilter[0]) <= new Date(formatted)) || !(new Date(rangeDateFilter[1]) >= new Date(formatted))) {
                        match = false;
                        break;
                    }
                }

            }
        }
        if (match) {
            result.push(allRecords[id]);
        }
    }
    return result;
}


function clearFilter() {
    document.querySelector(".calendar-wrapper").style.display = "none";
    document.querySelector("#clr-filter-txt").style.display = "none";

    for (const key in filterObject) {
        filterObject[key] = "";
    }
    document.querySelector("#search-record").value = "";
    document.querySelector("#moduleLabel").textContent = "All Modules";
    document.querySelector("#statusLabel").textContent = "All Status";
    document.querySelector("#timeFilterLabel").textContent = "Anytime";
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
                        <th>Approver Name</th>
                        <th>Status</th>
                        <th>Event Time</th>
                        <th>Comments</th>
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

async function toggle(index) {
    let connectionName = "approvalhistory";
    const row = document.getElementById(`approver-${index}`);
    const mainRow = row.previousElementSibling;
    const id = mainRow.dataset.id;
    const module = mainRow.dataset.value;

    let moduleAPIName = allModules[module];
    
    // 4. TimeLine Details to get comments
    let url = `https://www.zohoapis.com/crm/v8/${module === "Potentials" ? "Deals" : moduleAPIName}/${id}/__timeline?filters=%7B%22field%22%3A%7B%22api_name%22%3A%22source%22%7D%2C%22comparator%22%3A%22equal%22%2C%22value%22%3A%22approval_process%22%7D%20`;
    let req_data = {
        "url": url,
        "method": "GET",
    }
    ZOHO.CRM.CONNECTION.invoke(connectionName, req_data).then(function (data) {
        // //------------------------Approval Details
        // var req_data1 = {
        //         "method": "GET",
        //         "url": `https://crm.zoho.com/crm/v2.2/${module}/${id}/actions/approval_details`,
        //     };
        //     ZOHO.CRM.CONNECTION.invoke(connectionName, req_data1).then(function (data) {
        //         console.log(data)
        //     });

        // //---------------------
        let stages = data.details?.statusMessage?.__timeline;
        let trs = '';
        for (let j = stages.length == 1 ? 0 : stages.length - 2; j >= 0; j--) {
            const date = new Date(stages[j].audited_time);
            const options = { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true };
            const formattedAuditedTime = date.toLocaleString("en-US", options).replace(",", "");

            if (stages[j].action === "updated") continue;

            let status = '', comments = '';
            if (stages[j].action === "final_approval") {
                status = "Approved";
            }
            else if ((stages[j].action).toLowerCase() == "submitted" || stages[j].action == "task_assigned") {
                status = "Pending";
                comments = "Not yet provided";
            }
            else {
                status = stages[j].action;
                status = `${status.charAt(0).toUpperCase()}${status.slice(1)}`;

            }

            trs += `<tr>
                                <td>${stages[j].done_by.name}</td>
                                <td><span class="tag ${status.toLowerCase()}">${status}</span></td>
                                <td>${formattedAuditedTime}</td>
                                <td>${stages[j].automation_details.approval_process?.comments || (status === "Pending" ? comments : "-")}</td>
                            </tr>`
        }
        let miniTable = row.querySelector(".mini-table").querySelector("tbody");
        miniTable.innerHTML = trs;
        row.style.display = row.style.display === "table-row" ? "none" : "table-row";
    });

}

//Time Based Filter - (I. Specific date && II. Date Range)
// UNIVERSAL CALENDAR (supports single + range modes)
function buildCalendar(containerId, mode, onSelect) {
    const container = document.getElementById(containerId);
    container.className = "calendar";

    let current = new Date();
    let startDate = null;
    let endDate = null;

    function render() {
        const year = current.getFullYear();
        const month = current.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        container.innerHTML = "";

        // Header
        const header = document.createElement("div");
        header.className = "calendar-header";

        const prev = document.createElement("button");
        prev.textContent = "<";
        prev.onclick = () => {
            current = new Date(year, month - 1, 1);
            render();
        };

        const next = document.createElement("button");
        next.textContent = ">";
        next.onclick = () => {
            current = new Date(year, month + 1, 1);
            render();
        };

        const title = document.createElement("div");
        title.textContent = `${current.toLocaleString("default", { month: "long" })} ${year}`;

        header.appendChild(prev);
        header.appendChild(title);
        header.appendChild(next);
        container.appendChild(header);

        // Grid
        const grid = document.createElement("div");
        grid.className = "calendar-grid";

        const weekNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
        weekNames.forEach(d => {
            const el = document.createElement("div");
            // el.style.fontWeight = "bold";
            el.textContent = d;
            grid.appendChild(el);
        });

        // Empty spaces
        for (let i = 0; i < firstDay; i++) {
            grid.appendChild(document.createElement("div"));
        }

        // Days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);

            const el = document.createElement("div");
            el.textContent = day;
            el.className = "calendar-day";

            // Single mode highlight
            if (mode === "single" && startDate &&
                dateObj.toDateString() === startDate.toDateString()) {
                el.classList.add("selected");
            }

            // Range mode highlight
            if (mode === "range" && startDate && endDate) {
                if (dateObj >= startDate && dateObj <= endDate) {
                    el.classList.add("range");
                }
                if (
                    dateObj.toDateString() === startDate.toDateString() ||
                    dateObj.toDateString() === endDate.toDateString()
                ) {
                    el.classList.add("selected");
                }
            }

            el.onclick = () => {
                if (mode === "single") {
                    // if (dateObj > current) {
                    //     el.style.cursor = "not-allowed";
                    // }
                    // else {
                    startDate = dateObj;

                    onSelect(startDate);
                    // }
                }

                if (mode === "range") {
                    // if (dateObj > current) {
                    //     el.style.cursor = "not-allowed";
                    // }
                    if (!startDate || (startDate && endDate)) {
                        startDate = dateObj;
                        endDate = null;
                    } else if (dateObj >= startDate) {
                        endDate = dateObj;
                        onSelect(startDate, endDate);
                    } else {
                        startDate = dateObj;
                        endDate = null;
                    }
                }

                render();
            };

            grid.appendChild(el);
        }

        container.appendChild(grid);
    }

    render();
}
ZOHO.embeddedApp.init();