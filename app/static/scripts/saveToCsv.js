function getFormattedDate() {
    let now = new Date();
    
    let dd = String(now.getDate()).padStart(2, '0');
    let mm = String(now.getMonth() + 1).padStart(2, '0');
    let yyyy = now.getFullYear();
    
    let hh = String(now.getHours()).padStart(2, '0');
    let min = String(now.getMinutes()).padStart(2, '0');
    let ss = String(now.getSeconds()).padStart(2, '0');
    
    return `${dd}${mm}${yyyy}${hh}${min}${ss}`;
}

function tableToCSV(table) {
    let csv = [];
    
    for (let row of table.rows) {
        let cols = Array.from(row.cells).map(cell => `"${cell.innerText.trim()}"`);
        csv.push(cols.join(","));
    }
    
    return csv.join("\n");
}

function downloadCSV(csv, filename) {
    let blob = new Blob([csv], { type: "text/csv" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function saveToCSV() {
    let csvData = tableToCSV(document.getElementById("transcript"));
    const date = getFormattedDate();

    downloadCSV(csvData, `transcript_${date}.csv`);
}

// Fetching & Sending - will be finished later
// function saveToCsv() {
//     var dataToSave = document.getElementById("transcript").innerHTML;


//     console.log(dataToSave)

    
    // fetch('/create_csv', {
    //     headers: {
    //         'Content-Type' : 'application/json'
    //     },
    //     method: postMessage,
    //     body: dataToSave
    // })
    // .then (function (response) {
    //     console.log(response)
    // })
// }