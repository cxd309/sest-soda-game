"use strict";
let game_data; // Variable to store the game data
let roleChart = null;
let sccChart = null;
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
        populateDropdowns();
    })
        .fail((jqxhr, textStatus, error) => {
        console.error('Failed to load game data:', error);
    });
}
function updateCharts() {
    updateRoleChart();
    updateSCCChart();
}
function updateRoleChart() {
    const selectedYear = $("#year-select").val();
    const selectedGame = $("#game-select").val();
    const selectedType = $("#chart-type").val();
    let datasets = [];
    let labels = [];
    // Get the correct dataset type
    const dataKey = selectedType;
    const selectedData = game_data[dataKey].filter((entry) => entry.year === selectedYear && entry.game_num === Number(selectedGame));
    // Separate data by role
    const roles = [...new Set(selectedData.map(entry => entry.role))];
    roles.forEach((role, index) => {
        const roleEntries = selectedData
            .filter(entry => entry.role === role)
            .sort((a, b) => a.week_num - b.week_num);
        if (roleEntries.length > 0) {
            if (labels.length === 0) {
                labels = roleEntries.map(entry => entry.week_num);
            }
            datasets.push({
                label: `${role}`,
                data: roleEntries.map(entry => entry[selectedType]),
                borderColor: `hsl(${(index * 60) % 360}, 70%, 50%)`,
            });
        }
    });
    const ctx = $("#role-chart");
    if (roleChart) {
        roleChart.destroy();
    }
    roleChart = createChart(labels, datasets, ctx, selectedType.charAt(0).toUpperCase() + selectedType.substring(1));
}
function updateSCCChart() {
    const selectedYear = $("#year-select").val();
    let datasets = [];
    let labels = [];
    const allGames = [...new Set(game_data.supply_chain_cost.map(entry => entry.game_num))];
    allGames.forEach((gameNum, index) => {
        const gameEntries = game_data.supply_chain_cost
            .filter(entry => entry.year === selectedYear && entry.game_num === gameNum)
            .sort((a, b) => a.week_num - b.week_num);
        if (gameEntries.length > 0) {
            if (labels.length === 0) {
                labels = gameEntries.map(entry => entry.week_num);
            }
            datasets.push({
                label: `Game ${gameNum}`,
                data: gameEntries.map(entry => entry.supply_chain_cost),
                borderColor: `hsl(${(index * 60) % 360}, 70%, 50%)`,
            });
        }
    });
    const ctx = $("#scc-chart");
    if (sccChart) {
        sccChart.destroy();
    }
    sccChart = createChart(labels, datasets, ctx, "Supply Chain Cost");
}
function createChart(labels, datasets, ctx, title) {
    const chartObj = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "right",
                },
                title: {
                    display: true,
                    text: title,
                    font: {
                        size: 18
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: "Week Number" } },
                y: { title: { display: true, text: title } }
            }
        }
    });
    return chartObj;
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
