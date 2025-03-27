"use strict";
let game_data; // Variable to store the game data
let roleChart;
let sccChart;
const roleOrder = [
    "Consumer",
    "Retailer",
    "Wholesaler",
    "Distributor",
    "Factory"
];
// populate the dropdown values
function populateDropdowns() {
    const yearSelectors = [$("#year-select")];
    const gameSelectors = [$("#game-select")];
    const years = [...new Set(Object.values(game_data)
            .flatMap((dataset) => dataset.map((entry) => entry.year)))].sort();
    const gameNumbers = [...new Set(Object.values(game_data)
            .flatMap((dataset) => dataset.map((entry) => entry.game_num)))].sort((a, b) => a - b);
    yearSelectors.forEach((selector) => selector.empty());
    gameSelectors.forEach((selector) => selector.empty());
    years.forEach(year => {
        let contents = `<option value="${year}">${year}</option>`;
        yearSelectors.forEach((selector) => selector.append(contents));
    });
    gameNumbers.forEach(gameNum => {
        let contents = `<option value="${gameNum}">Game ${gameNum}</option>`;
        gameSelectors.forEach((selector) => selector.append(contents));
    });
    // Set default selections (first available options)
    yearSelectors.forEach((selector) => selector.val(years[0]));
    gameSelectors.forEach((selector) => selector.val(gameNumbers[0]));
    // Trigger chart update with default selections
    updateCharts();
}
// load game_data
function loadGameData() {
    $.getJSON('./static/game-data.json')
        .done((data) => {
        game_data = data;
        game_data.inventory.forEach(item => { item.value = item.inventory; });
        game_data.orders.forEach(item => { item.value = item.orders; });
        game_data.surplus.forEach(item => { item.value = item.surplus; });
        populateDropdowns();
    })
        .fail((jqxhr, textStatus, error) => {
        console.error('Failed to load game data:', error);
    });
}
function updateCharts() {
    const dataSelection = {
        year: $("#year-select").val(),
        game: parseInt($("#game-select").val()),
        type: $("#chart-type").val()
    };
    buildRoleChart(dataSelection);
    buildSCCChart(dataSelection);
}
function buildRoleChart(dataSelection) {
    const filteredData = game_data[dataSelection.type].filter(row => row.year == dataSelection.year &&
        row.game_num == dataSelection.game).sort((a, b) => a.week_num - b.week_num);
    const labels = [...new Set(filteredData.map(row => row.week_num))];
    const chartDataset = [];
    roleOrder.forEach(function (role) {
        let roleData = filteredData.filter(row => row.role == role);
        if (roleData.length > 0) {
            chartDataset.push({ label: role, data: roleData.map(row => row.value) });
        }
    });
    const title = dataSelection.type.charAt(0).toUpperCase() + dataSelection.type.slice(1);
    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: "right",
            },
            title: {
                display: true,
                text: `${title}`,
                font: {
                    size: 18
                }
            }
        },
        scales: {
            x: { title: { display: true, text: "Week Number" } },
            y: { title: { display: true, text: `${title}` } }
        }
    };
    if (roleChart == undefined) {
        roleChart = new Chart("role-chart", {
            type: "line",
            data: {
                datasets: [{
                        data: []
                    }]
            },
            options: chartOptions
        });
    }
    roleChart.data = { labels: labels, datasets: chartDataset };
    roleChart.options = chartOptions;
    roleChart.update();
}
function buildSCCChart(dataSelection) {
    const filteredData = game_data.supply_chain_cost.filter(row => row.year == dataSelection.year).sort((a, b) => a.week_num - b.week_num).sort((a, b) => a.game_num - b.game_num);
    const labels = [...new Set(filteredData.map(row => row.week_num))];
    const gameNumbers = [...new Set(filteredData.map(row => row.game_num))];
    const chartDataset = [];
    gameNumbers.forEach(function (game_num) {
        let gameData = filteredData.filter(row => row.game_num == game_num);
        if (gameData.length > 0) {
            chartDataset.push({
                label: `Game ${game_num}`,
                data: gameData.map(row => row.supply_chain_cost),
                borderColor: `hsla(${(game_num * 22.5) % 360}, 70%, 50%)`,
                backgroundColor: `hsla(${(game_num * 22.5) % 360}, 70%, 50%, 0.5)`
            });
        }
    });
    console.log(chartDataset);
    if (sccChart == undefined) {
        sccChart = new Chart("scc-chart", {
            type: "line",
            data: {
                datasets: [{
                        data: []
                    }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: "right",
                    },
                    title: {
                        display: true,
                        text: "Supply Chain Cost",
                        font: {
                            size: 18
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: "Week Number" } },
                    y: { title: { display: true, text: "Supply Chain Cost" } }
                }
            }
        });
    }
    sccChart.data = { labels: labels, datasets: chartDataset };
    sccChart.update();
}
// Call the function after the page loads
$(function () {
    loadGameData();
    $("#year-select, #game-select, #chart-type").on("change", function () {
        const scrollPos = window.scrollY;
        updateCharts();
        window.scrollTo(0, scrollPos); // Restore scroll position after update
    });
});
