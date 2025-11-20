ZOHO.embeddedApp.on("PageLoad", async function (data) {

    // 1. Get Approval History and Filter the Records.
    let approvalHistory = await getApprovals();

    // 2. Build Table with records
    buildTable(approvalHistory);

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
    
    // i. Get Domain Details
    const env_details = await ZOHO.CRM.CONFIG.GetCurrentEnvironment();
    
    
    let domainDetails = {
        "US": ".com",
        "AU": ".com.au",
        "EU": ".eu",
        "IN": ".in",
        "CN": ".com.cn",
        "JP": ".jp",
        "CA": ".zohocloud.ca"
    }
    const tbody = document.getElementById("recordBody");
    let index = 0;   // Since I'm using for each, explicit index has been used.

    for (const id in filteredObject) {
        if(filteredObject[id][0].action === "Submitted" && filteredObject[id].length ===1) continue;
        index++;
        let overAllStatus = filteredObject[id][0].action === "Final_Approval" ? "Approved" : (filteredObject[id][0].action === "Submitted" ? "Pending" : (filteredObject[id][0].action == "Delegated") ? "Pending" : filteredObject[id][0].action);

        tbody.innerHTML += `
        <tr class="row" data-id="${id}" data-value="${filteredObject[id][0].module}">
            <td class="recordName">${filteredObject[id][0].record.name}</td>
            <td>${filteredObject[id][0].module}</td>
            <td><span class="tag ${overAllStatus.toLowerCase()}">${overAllStatus}</span></td>
            <td><button class="zbtn" onclick="toggle(${index})">View</button></td>

            <tr id="approver-${index}" class="approver-row">
            <td colspan="4">
                <div class="mini-header">Approver List</div>

                <table class="mini-table">
                    <thead>
                        <tr>
                            <th>Approver</th>
                            <th>Status</th>
                            <th>Comment</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </td>
        </tr>
        </tr>
    `;

    };

    document.querySelectorAll(".row").forEach(element => {
        // View Record In Module.
        element.querySelector(".recordName").addEventListener('click', () => {
            const id = element.dataset.id;
            const value = element.dataset.value;
            window.open(`https://crm.zoho${domainDetails[env_details.deployment]}/crm/org${env_details.zgid}/tab/${value}/${id}/`)
        });
    });
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
    ZOHO.CRM.CONNECTION.invoke(connectionName,req_data).then(function (data) {

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
            if(stages[j].action === "updated") continue;
            let status = stages[j].action === "final_approval" ? "Approved" : (stages[j].action === "Submitted" ? "Pending" : stages[j].action);

            trs += `<tr>
                                <td>${stages[j].done_by.name}</td>
                                <td><span class="tag ${status.toLowerCase()}">${status}</span></td>
                                <td>${stages[j].automation_details.approval_process?.comments || "-"}</td>
                            </tr>`
        }
        let miniTable = row.querySelector(".mini-table").querySelector("tbody");
        miniTable.innerHTML = trs;
        row.style.display = row.style.display === "table-row" ? "none" : "table-row";
    });
    
}

ZOHO.embeddedApp.init();