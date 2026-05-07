//Global Variables
let filterObject = {
    module: "",
    action: "",
    search: "",
    timeBase: ""
};

// ==============================
// CALENDAR STATE (PERSISTENT)
// ==============================
const calendarState = {
    initialized: false,
    mode: "single",
    current: new Date(),
    startDate: null,
    endDate: null
};

let specificDateFilter = '', rangeDateFilter = [];
let allRecords = {};
let env_details;
let allModules = {};
let recordsCountPerPage = 10;
let currentPage = 1;
let allRecordsArray = [];
let totalPages = '';

// Elements 
let searchRecordInput = document.querySelector("#global-search");
let clearFilterWrapper = document.querySelector("#clr-filter-wrapper");
let tableBody = document.querySelector("#main-table__body");
let paginationSelect = document.querySelector("#pagination-select");
let paginationPrevBtn = document.querySelector("#pagination-prev-btn");
let paginationNextBtn = document.querySelector("#pagination-next-btn");
let paginationPageTxt = document.querySelector(".pagination-page-no-txt");


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
    }, {});

    // 2. Build Table with records
    buildTable(approvalHistory);
    if (currentPage == 1) {
        paginationPrevBtn.disabled = true;
        paginationNextBtn.disabled = false;
    }
    else if (currentPage == totalPages) {
        paginationNextBtn.disabled = true;
        paginationPrevBtn.disabled = false;
    }
    else {
        paginationPrevBtn.disabled = false;
        paginationNextBtn.disabled = false;
    }

    // Add Modules to the Dropdown of the Modules Column 
    let moduelsDropDownContainer = document.querySelector("#module-filter-list");

    for (const moduleName in currentApprovalModules) {
        let optionDiv = document.createElement("div");
        optionDiv.classList.add("filter-dropdown__option");
        optionDiv.setAttribute("role", "option");
        optionDiv.setAttribute("aria-selected", "false");
        optionDiv.setAttribute("data-value", moduleName)
        optionDiv.textContent = moduleName;
        moduelsDropDownContainer.appendChild(optionDiv);
    }

    // New Code to Handle dropdowns
    // ==============================
    // DROPDOWNS
    // ==============================
    document.querySelectorAll(".filter-dropdown__trigger").forEach(header => {

        const dropdown = document.getElementById(header.dataset.dropdown);
        let calendarWrapper = document.querySelector(".filter-dropdown__calendar");

        const label = document.getElementById(header.dataset.label);

        const searchInput = dropdown.querySelector(".filter-dropdown__search");
        const options = dropdown.querySelectorAll(".filter-dropdown__option");

        // OPEN / CLOSE
        header.addEventListener("click", e => {

            const isOpen =
                getComputedStyle(dropdown).display === "flex";

            document.querySelectorAll(".filter-dropdown__menu")
                .forEach(d => d.style.display = "none");

            if (getComputedStyle(calendarWrapper).display === "block") {
                calendarWrapper.style.display = "none";
            }

            dropdown.style.display = isOpen ? "none" : "flex";

            searchInput.focus();
            searchInput.value = "";
            if (dropdown.querySelector(".no-results")) {
                dropdown.querySelector(".no-results").remove();
                dropdown.querySelectorAll(".filter-dropdown__option").forEach(element => {
                    element.style.display = "flex";
                });
            }
            e.stopPropagation();
        });

        // OPTION CLICK
        options.forEach(option => {

            option.addEventListener("click", function () {

                options.forEach(o => {
                    o.classList.remove("selected");
                    o.setAttribute("aria-selected", "false");
                });

                this.classList.add("selected");
                this.setAttribute("aria-selected", "true");

                label.textContent = this.textContent.trim();

                const val = this.dataset.value;

                switch (label.id) {
                    case "moduleLabel":
                        filterObject.module = this.dataset.value;
                        break;

                    case "statusLabel":
                        if (this.dataset.value === "Pending") {
                            filterObject.action = ["Submitted", "Delegated"];
                        } else if (this.dataset.value === "Approved") {
                            filterObject.action = "Final_Approval";
                        } else {
                            filterObject.action = this.dataset.value;
                        }
                        break;

                    case "timeFilterLabel":

                        if (val === "on") {
                            filterObject.timeBase = "on";

                            initCalendar();

                            // if (calendarState.mode === "range") {
                            //     let selectedDays = document.querySelectorAll(".calendar-day.range");
                            //     // calendarState.startDate = null;
                            //     // calendarState.endDate = null;

                            //     [...selectedDays].forEach(element => {

                            //         element.classList.remove("range");
                            //         if (element.classList.contains("selected")) element.classList.remove("selected");
                            //     });
                            // }
                            calendarState.mode = "single";

                            document.querySelector(".filter-dropdown__calendar")
                                .style.display = "block";

                            break;
                        }

                        if (val === "between") {

                            filterObject.timeBase = "between";

                            initCalendar();

                            // if (calendarState.mode === "single") {
                            //     let selectedDays = document.querySelectorAll(".calendar-day.selected");

                            //     // calendarState.startDate = null;
                            //     // calendarState.endDate = null;

                            //     [...selectedDays].forEach(element => {
                            //         element.classList.remove("selected");
                            //     });
                            // }

                            calendarState.mode = "range";

                            document.querySelector(".filter-dropdown__calendar")
                                .style.display = "block";

                            break;
                        }

                        filterObject.timeBase = val;
                        break;
                }
                switch (this.dataset.value) {
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
                if (
                    val !== "on" &&
                    val !== "between"
                ) {
                    applyFilter(filterObject);
                }
                checkFilters();
                dropdown.style.display = "none";
            });
        });

        // SEARCH
        searchInput.addEventListener("input", filterOptions);
        function filterOptions(e) {
            const filter = searchInput.value.toLowerCase();
            let matchFound = false;

            options.forEach(option => {

                if (option.dataset.value.toLowerCase().includes(filter)) {
                    option.style.display = "flex";
                    matchFound = true;
                } else {
                    option.style.display = "none";
                }

            });
            let noResult = dropdown.querySelector(".no-results");

            if (!matchFound) {
                if (!noResult) {
                    noResult = document.createElement("div");
                    noResult.className = "no-results";
                    noResult.textContent = "No results found";
                    dropdown.appendChild(noResult);
                }

            } else {

                if (noResult) {
                    noResult.remove();
                }
            }
        }
    });

    function checkFilters() {
        const selectedModule =
            document.querySelector("#module-filter-list .selected").dataset.value;

        const selectedStatus = document.querySelector("#status-filter-list .selected").dataset.value;
        const selectedTime = document.querySelector("#time-filter-list .selected").dataset.value;
        const clearBtn = document.getElementById("clr-filter-txt");

        if (selectedModule !== "All Modules" || selectedStatus !== "All Status" || selectedTime !== "Anytime") {
            clearBtn.style.display = "block";
        } else {
            clearBtn.style.display = "none";
        }
    }

    document.querySelector("#global-search").addEventListener("input", (e) => {
        filterObject["search"] = e.target.value.trim();
        applyFilter(filterObject);
    })

    //Pagination Select Event
    paginationSelect.addEventListener("change", (e) => {
        e.preventDefault();
        recordsCountPerPage = paginationSelect.value;
        currentPage = 1;
        totalPages = Math.ceil(allRecordsArray.length / recordsCountPerPage);
        paginationPageTxt.innerHTML = `${currentPage}&nbsp; of &nbsp;${totalPages}`;
        renderTable(currentPage, recordsCountPerPage, allRecordsArray);
    })

    // Clear All Filter
    document.querySelector("#clr-filter-txt").addEventListener("click", clearFilter);
    window.addEventListener('click', (e) => {
        let flag = false;
        let popUps = document.querySelectorAll(".filter-dropdown__menu");
        popUps.forEach(element => {
            if (element.contains(e.target)) flag = true;
            if (!flag) {
                element.style.display = "none";
            }

        });
        let calendar = document.querySelector(".filter-dropdown__calendar");
        if (calendar.contains(e.target)) flag = true;
        if (!flag) {
            calendar.style.display = "none";
        }
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
    currentPage = 1;
    const filtered = getFilteredRecords(filters, d);
    renderTable(currentPage, recordsCountPerPage, filtered);
}

function renderTable(currentPage, recordsPerPage, records) {
    const tbody = document.getElementById("main-table__body");
    tbody.innerHTML = ""; // clear existing rows

    allRecordsArray = records;
    startIndex = (currentPage - 1) * recordsPerPage;
    endIndex = Number(startIndex) + Number(recordsPerPage);
    totalPages = Math.ceil(allRecordsArray.length / recordsPerPage);
    paginationPageTxt.innerHTML = `${currentPage}&nbsp; of &nbsp;${totalPages}`;

    if (records.length <= 0) {
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
        let filteredRecordsArray = records.slice(startIndex, endIndex);
        filteredRecordsArray.forEach((record, index) => {
            tbody.appendChild(createRow(record, index));
            tbody.appendChild(createApproverRow(record, index));
        });

        document.querySelectorAll(".view-trigger").forEach((el, index) => {
            el.addEventListener("click", (event) => toggle(event, index));
        });
    }
}

paginationNextBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentPage == totalPages - 1) {
        paginationNextBtn.disabled = true;
        paginationPrevBtn.disabled = false;
    }
    else {
        paginationPrevBtn.disabled = false;
        paginationNextBtn.disabled = false;
    }
    if (currentPage < totalPages) {
        currentPage++;
        renderTable(currentPage, recordsCountPerPage, allRecordsArray);
    }

});

paginationPrevBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentPage == 2 || currentPage == 1) {
        paginationPrevBtn.disabled = true;
        paginationNextBtn.disabled = false;
    }
    else {
        paginationPrevBtn.disabled = false;
        paginationNextBtn.disabled = false;
    }
    if (currentPage > 1) {
        currentPage--;
        renderTable(currentPage, recordsCountPerPage, allRecordsArray);
    }
})
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
                else if (filterObject[key] === "last-7") {
                    if (recordAuditTime < sevenDaysAgo || recordAuditTime > today) {
                        match = false;
                        break;
                    }
                }

                else if (filterObject[key] === "last-30") {
                    if (recordAuditTime < thirtyDaysAgo || recordAuditTime > today) {
                        match = false;
                        break;
                    }
                }
                else if (filterObject[key].trim() == "on") {
                    if (formatted !== specificDateFilter) {
                        match = false;
                        break;
                    }
                }
                else if (filterObject[key].trim() == "between") {
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
    // Cache selectors
    const calendar = document.querySelector(".filter-dropdown__calendar");
    const clearText = document.querySelector("#clr-filter-txt");
    const globalSearch = document.querySelector("#global-search");

    // Hide elements
    calendar.style.display = "none";
    clearText.style.display = "none";

    // Reset filter object
    Object.keys(filterObject).forEach(key => (filterObject[key] = ""));

    // Reset calendar state
    calendarState.startDate = calendarState.endDate = null;

    // Remove classes
    document.querySelectorAll(".range").forEach(el => el.classList.remove("range"));

    document.querySelectorAll(".selected").forEach(el => {
        if (!el.dataset.default) {
            el.classList.remove("selected");
            el.setAttribute("aria-selected", "false");
        }
    });

    // Restore defaults
    document.querySelectorAll('[data-default="true"]').forEach(el => {
        if (el.previousElementSibling?.classList.contains("filter-dropdown__search")) {
            el.previousElementSibling.value = "";
        }

        el.classList.add("selected");
        el.setAttribute("aria-selected", "true");
    });

    // Reset inputs & labels
    globalSearch.value = "";

    document.querySelector("#moduleLabel").textContent = "All Modules";
    document.querySelector("#statusLabel").textContent = "All Status";
    document.querySelector("#timeFilterLabel").textContent = "Anytime";

    applyFilter({});
    triggerToast("Filter categories reset!", 2000);
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
        <td class="recordName"><span id="record-name" title = "${data.record.name.length > 20 ? data.record.name : ""}">${data.record.name}</span></td>
        <td>${data.module}</td>
        <td><span class="tag ${overAllStatus.toLowerCase()}">${overAllStatus}</span></td>
        <td><div class="view-trigger" data-index="${index}"><span class="view-approver-details-trigger">View Details</span><span><i class="fa-solid fa-chevron-down"></i></span></div></td>
    `;
    // if (wrapper.querySelector(".recordName").scrollWidth > wrapper.querySelector(".recordName").clientWidth) {
    //     wrapper.querySelector(".recordName").title = wrapper.querySelector(".recordName").textContent.trim();
    // }

    // Add record click event
    wrapper.querySelector("#record-name").addEventListener("click", () => {
        viewRecord(data);
    });

    return wrapper;
}


function createApproverRow(obj, index) {
    const row = document.createElement("tr");
    row.className = "approver-row";
    row.id = `approver-${index}`;
    // row.style.display = "none";

    row.innerHTML = `
                    <td colspan="4">

                        <div class="expand-wrapper">

                            <div class="loading-overlay hidden">
                                <div class="loading-spinner"></div>
                                <div class="loading-text">Loading...</div>
                            </div>

                            <div class="approver-content hidden">
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
                            </div>

                        </div>

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

async function toggle(event, index) {

    const connectionName = "approvalhistory";

    const row = document.getElementById(`approver-${index}`);
    const mainRow = row.previousElementSibling;

    const trigger = mainRow.querySelector(".view-trigger");

    const isOpen = row.classList.contains("open");

    const id = mainRow.dataset.id;
    const module = mainRow.dataset.value;

    closeAllRows(row);

    if (!isOpen) {
        await openRow(row, mainRow, trigger, id, module, connectionName);
    } else {
        closeRow(row, mainRow, trigger);
    }
}



function closeAllRows(currentRow) {

    document.querySelectorAll(".approver-row").forEach(row => {

        if (row !== currentRow && row.classList.contains("open")) {

            const mainRow = row.previousElementSibling;
            const trigger = mainRow.querySelector(".view-trigger");

            closeRow(row, mainRow, trigger);
        }
    });
}



async function openRow(row, mainRow, trigger, id, module, connectionName) {

    const loading = row.querySelector(".loading-overlay");

    const approverContent = row.querySelector(".approver-content");

    row.style.display = "table-row";

    trigger.classList.add("selectedZBTN");

    mainRow.classList.add("currentRow");

    updateTriggerUI(trigger, true);

    requestAnimationFrame(() => {
        row.classList.add("open");
    });

    /*
        show loader
    */
    loading.classList.remove("hidden");

    approverContent.classList.add("hidden");


    /*
        caching
    */

    if (row.dataset.loaded === "true") {

        loading.classList.add("hidden");

        approverContent.classList.remove("hidden");

        return;
    }

    try {

        const moduleAPIName = allModules[module];

        const url = `https://www.zohoapis.com/crm/v8/${
            module === "Potentials" ? "Deals" : moduleAPIName
        }/${id}/__timeline?filters=%7B%22field%22%3A%7B%22api_name%22%3A%22source%22%7D%2C%22comparator%22%3A%22equal%22%2C%22value%22%3A%22approval_process%22%7D%20`;

        const req_data = {
            url,
            method: "GET"
        };

        const res = await ZOHO.CRM.CONNECTION.invoke(connectionName, req_data);

        if (res.code === "SUCCESS") {

            const stages = res.details?.statusMessage?.__timeline || [];

            renderApproverTable(row, stages);

            row.dataset.loaded = "true";
        }

    } catch (error) {

        console.error(error);

        approverContent.innerHTML = `
            <div class="error-message">
                Failed to load approval details
            </div>
        `;
    }

    finally {

        loading.classList.add("hidden");

        approverContent.classList.remove("hidden");
    }
}



function closeRow(row, mainRow, trigger) {

    trigger.classList.remove("selectedZBTN");

    mainRow.classList.remove("currentRow");

    updateTriggerUI(trigger, false);

    row.classList.remove("open");

    setTimeout(() => {
        row.style.display = "none";
    }, 240);
}



function updateTriggerUI(trigger, isOpen) {

    const text = trigger.querySelector(".view-approver-details-trigger");

    const icon = trigger.querySelector(".fa-solid");

    text.textContent = isOpen
        ? "Hide Details"
        : "View Details";

    icon.classList.toggle("fa-chevron-up", isOpen);

    icon.classList.toggle("fa-chevron-down", !isOpen);
}



function renderApproverTable(row, stages) {

    let trs = "";

    for (let j = stages.length - 1; j >= 0; j--) {

        if (stages[j].action === "updated") continue;
        if(stages[j].done_by === null) continue;

        const date = new Date(stages[j].audited_time);

        const options = {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        };

        const formattedAuditedTime = date
            .toLocaleString("en-US", options)
            .replace(",", "");

        let status = "";

        let comments = "";

        if (stages[j].action === "final_approval") {

            status = "Approved";

        } else if (
            stages[j].action.toLowerCase() === "submitted" ||
            stages[j].action === "task_assigned"
        ) {

            status = "Pending";

            comments = "Not yet provided";

        } else {

            status = stages[j].action;

            status = `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
        }

        trs += `
            <tr>
                <td>${stages[j].done_by?.name}</td>

                <td>
                    <span class="tag ${status.toLowerCase()}">
                        ${status}
                    </span>
                </td>

                <td>${formattedAuditedTime}</td>

                <td
                    title="${
                        stages[j].automation_details
                            ?.approval_process
                            ?.comments?.length > 20
                            ? stages[j].automation_details
                                ?.approval_process
                                ?.comments
                            : ""
                    }"
                >
                    ${
                        stages[j].automation_details
                            ?.approval_process
                            ?.comments
                        ||
                        (status === "Pending"
                            ? comments
                            : "-")
                    }
                </td>
            </tr>
        `;
    }

    row.querySelector(".mini-table tbody").innerHTML = trs;
}

async function dynamicTaskRunner(tasks) {
    const totalTasks = tasks.length;

    for (let i = 0; i < totalTasks; i++) {
        try {
            await tasks[i](); // Try the current async task
            const progress = Math.round(((i + 1) / totalTasks) * 100);
            loadingScreen(progress);
        } catch (error) {
            console.error(`Task ${i + 1} failed:`, error);
            // Stop progress bar and show an error
            showError("Something went wrong. Please refresh or try again later.");
            break;
        }
    }
}

function loadingScreen(progress = 0) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingProgress = document.getElementById('loadingProgress');
    const mainContent = document.getElementById('mainContent');

    if (loadingProgress) {
        loadingProgress.style.width = `${progress}%`;
    }

    if (progress >= 100) {
        setTimeout(() => {
            if (loadingOverlay) {
                loadingOverlay.style.opacity = '0';
                loadingOverlay.style.visibility = 'hidden';
            }
            if (mainContent) {
                mainContent.classList.remove('content-hidden');
            }
        }, 500);
    }
}

// ==============================
// INIT CALENDAR ONLY ONCE
// ==============================
function initCalendar() {
    if (calendarState.initialized) return;

    buildCalendar(
        "single-calendar",
        calendarState,
        handleCalendarSelect
    );

    calendarState.initialized = true;
}

// ==============================
// CALENDAR CALLBACK
// ==============================
function handleCalendarSelect(start, end = null) {

    if (calendarState.mode === "single") {
        const d = new Date(start);

        specificDateFilter =
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

        applyFilter(filterObject, specificDateFilter);
    }

    if (calendarState.mode === "range" && end) {

        const s = new Date(start);
        const e = new Date(end);

        rangeDateFilter[0] =
            `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;

        rangeDateFilter[1] =
            `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;

        applyFilter(filterObject, rangeDateFilter[0]);
    }

    document.querySelector(".filter-dropdown__calendar").style.display = "none";
}

// ==============================
// BUILD CALENDAR (STATE BASED)
// ==============================
function buildCalendar(containerId, state, onSelect) {

    const container = document.getElementById(containerId);
    container.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    function render() {

        const year = state.current.getFullYear();
        const month = state.current.getMonth();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        container.innerHTML = "";

        // HEADER
        const header = document.createElement("div");
        header.className = "calendar-header";

        const prev = document.createElement("button");
        prev.textContent = "<";
        prev.onclick = () => {
            state.current = new Date(year, month - 1, 1);
            render();
        };

        const next = document.createElement("button");
        next.textContent = ">";
        next.onclick = () => {
            state.current = new Date(year, month + 1, 1);
            render();
        };

        const title = document.createElement("div");
        title.textContent =
            `${state.current.toLocaleString("default", { month: "long" })} ${year}`;

        header.append(prev, title, next);
        container.appendChild(header);

        // GRID
        const grid = document.createElement("div");
        grid.className = "calendar-grid";

        ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].forEach(day => {
            const d = document.createElement("div");
            d.classList.add("week-day");
            d.textContent = day;
            grid.appendChild(d);
        });

        // EMPTY CELLS
        for (let i = 0; i < firstDay; i++) {
            grid.appendChild(document.createElement("div"));
        }

        // DAYS
        for (let day = 1; day <= daysInMonth; day++) {

            const dateObj = new Date(year, month, day);


            const cell = document.createElement("div");
            cell.className = "calendar-day";
            cell.textContent = day;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // const isFuture = dateObj > today;

            // if (isFuture) {
            //     cell.classList.add("disabled-date");
            //     cell.setAttribute("aria-disabled", "true");
            // }

            // SINGLE MODE
            if (
                state.mode === "single" &&
                state.startDate &&
                dateObj.toDateString() === state.startDate.toDateString()
            ) {
                cell.classList.add("selected");
            }

            // RANGE MODE
            if (
                state.mode === "range" &&
                state.startDate &&
                state.endDate
            ) {
                if (dateObj >= state.startDate && dateObj <= state.endDate) {
                    cell.classList.add("range");
                }

                if (
                    dateObj.toDateString() === state.startDate.toDateString() ||
                    dateObj.toDateString() === state.endDate.toDateString()
                ) {
                    cell.classList.add("selected");
                }
            }

            // CLICK
            cell.onclick = () => {
                // if (isFuture) return;

                if (state.mode === "single") {
                    state.startDate = dateObj;
                    state.endDate = null;
                    onSelect(state.startDate);
                }

                if (state.mode === "range") {

                    if (!state.startDate || state.endDate) {
                        state.startDate = dateObj;
                        state.endDate = null;
                    } else if (dateObj >= state.startDate) {
                        state.endDate = dateObj;
                        onSelect(state.startDate, state.endDate);
                    } else {
                        state.startDate = dateObj;
                        state.endDate = null;
                    }
                }

                render();
            };

            grid.appendChild(cell);
        }

        container.appendChild(grid);
    }

    render();
}

function showLoading() {
    document.getElementById('loader').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loader').style.display = 'none';
}

let currentToast = null;

let triggerToast = function (message, duration = 1000, type = 'info') {
    const fallback = typeof message === 'string' ? message : 'Notification';

    if (currentToast) {
        currentToast.toastElement.remove();
        currentToast = null;
    }

    const backgroundColor = (type === 'warning') ? '#FFA500' :
        (type === 'success') ? '#4CAF50' :
            (type === 'error') ? '#F44336' : '#2196F3';

    currentToast = Toastify({
        text: fallback,
        duration: duration,
        gravity: "top",
        position: "center",
        stopOnFocus: true,
        backgroundColor,
        // close: true, 
        transition: "linear",
        onClick: function () { }
    });
    currentToast.showToast();
};
ZOHO.embeddedApp.init();