ZOHO.embeddedApp.on("PageLoad", function (data) {
    getApprovals()
});


function getApprovals() {
    // 1. Get Approval History
    let connectionName = "approvalhistory";

    ZOHO.CRM.API.getApprovalsHistory().then(function (data) {
        let thead = document.createElement("tr");
        let tbl = document.querySelector("table");

        let tblHeaders = ["S.No", "RecordName", "Module", "ApprovalStatus", "Done_By", "Comments"];

        tblHeaders.forEach(element => {
            let th = document.createElement("th");
            th.textContent = element;
            thead.appendChild(th);
        });

        let i = 0;
        tbl.appendChild(thead);

        //2. Filter the Records and gather as single record if we found duplicate
        const filteredObject = data.data.reduce((acc, item) => {
            if (!acc[item.record.id]) {
                acc[item.record.id] = [];
            }
            acc[item.record.id].push(item);
            return acc;
        }, {});

        console.log(filteredObject);

        for (const id in filteredObject) {

            let tr = document.createElement("tr");
            tr.addEventListener("click", (e) => {
                e.preventDefault();
                window.open(`https://crm.zoho.com/crm/org891084118/tab/${filteredObject[id][0].module}/${id}/`)
            });
            // 3.Approval Details
            let approvalDetailsUrl = `https://crm.zoho.com/crm/v2.2/Approvals/${id}/actions/approval_details`;
            var conn_name = "approvalhistory";
            var req_data1 = {
                "method": "GET",
                "url": `https://crm.zoho.com/crm/v2.2/${filteredObject[id][0].module}/${id}/actions/approval_details`,
            };
            ZOHO.CRM.CONNECTION.invoke(conn_name, req_data1).then(function (data) {
                console.log(data)
            });

            // 4. TimeLine Details to get comments
            let url = `https://www.zohoapis.com/crm/v8/${filteredObject[id][0].module}/${id}/__timeline?filters=%7B%22field%22%3A%7B%22api_name%22%3A%22source%22%7D%2C%22comparator%22%3A%22equal%22%2C%22value%22%3A%22approval_process%22%7D%20`;
            let req_data = {
                "url": url,
                "method": "GET",
            }
            ZOHO.CRM.CONNECTION.invoke(connectionName, req_data).then(function (data) {

                let rowpsan = data.details?.statusMessage?.__timeline.length;
                let stages = data.details?.statusMessage?.__timeline;
                tr.innerHTML = `
                                    <td rowspan="${rowpsan}">${++i}</td>
                                    <td rowspan="${rowpsan}">${filteredObject[id][0].record.name}</td>
                                    <td rowspan="${rowpsan}">${filteredObject[id][0].module}</td>
                                    <td>${stages[stages.length - 1].action}</td>
                                    <td>${stages[stages.length - 1].done_by.name}</td>
                                    <td>${stages[stages.length - 1].automation_details.approval_process?.comments || ""}</td>
                                `;
                if (stages.length <= 1) {
                    tr.classList.add("mainRow")
                }
                tbl.appendChild(tr);

                // stages.forEach(element => {
                // Remaining stages (new <tr> for each)
                for (let j = stages.length - 2; j >= 0; j--) {

                    let tr2 = document.createElement("tr");
                    tr2.innerHTML = `
                                            <td>${stages[j].action}</td>
                                            <td>${stages[j].done_by.name}</td>
                                            <td>${stages[j].automation_details.approval_process?.comments || ""}</td>
                                            `;
                    if (j === 0) {
                        tr2.classList.add('mainRow')
                    }
                    tbl.appendChild(tr2);
                }
                // });
            });
            // tbl.appendChild(tr);
        }

        // data.data.forEach(element => {
        //     if (element.record.id === "6869026000002959098") { alert("Pending REcord FOund in this List!") }
        //     let tr = document.createElement("tr");
        //     tr.classList.add("tblHdr");
        //     tr.addEventListener("click", (e) => {
        //         e.preventDefault();
        //         window.open(`https://crm.zoho.com/crm/org891084118/tab/${element.module}/${element.record.id}/`)
        //     })
        //     let sNo = document.createElement("td");
        //     sNo.textContent = i++;
        //     tr.appendChild(sNo);

        //     let recordName = document.createElement("td");
        //     recordName.textContent = element.record.name;
        //     tr.appendChild(recordName);

        //     let module = document.createElement("td");
        //     module.textContent = element.module;
        //     tr.appendChild(module);

        //     let approvalStatus = document.createElement("td");
        //     approvalStatus.textContent = element.action;
        //     tr.appendChild(approvalStatus);

        //     let done_By = document.createElement("td");
        //     done_By.textContent = element.done_by.name;
        //     tr.appendChild(done_By);

        //     // TimeLine Details to get comments
        //     let url = `https://www.zohoapis.com/crm/v8/${element.module}/${element.record.id}/__timeline?filters=%7B%22field%22%3A%7B%22api_name%22%3A%22source%22%7D%2C%22comparator%22%3A%22equal%22%2C%22value%22%3A%22approval_process%22%7D%20`;
        //     let req_data = {
        //         "url": url,
        //         "method": "GET",
        //     }
        //     ZOHO.CRM.CONNECTION.invoke(connectionName, req_data).then(function (data) {

        //         // approvalStatus.innerHTML = data.details.statusMessage.__timeline[0].action;
        //         // console.log(data.details.statusMessage.__timeline[0].action);
        //         //     if(data.details.statusMessage.__timeline[0].action === "updated"){
        //         //     //     console.log("From Approval History");

        //         //     //     console.log(element);
        //         //     //     console.log("From TimeLine: ");

        //         //     // console.log(data);
        //         // }
        //         // console.log(data);

        //         let comments = document.createElement("td");
        //         comments.textContent = data.details?.statusMessage?.__timeline[0]?.automation_details.approval_process?.comments;
        //         tr.appendChild(comments);
        //     })
        //     tbl.appendChild(tr);
        //     // let url = `crm.zoho.com/crm/v2.2/Approvals/{approval_status_id}/actions/approval_details`;

        // });
    });
}

ZOHO.embeddedApp.init();