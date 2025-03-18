declare const Chart: any; // Tells TypeScript that Chart exists globally

interface Inventory{
  game_num: number,
  inventory: number,
  role: string,
  week_num: number,
  year: string
}
interface Order{
  game_num: number,
  orders: number,
  role: string,
  week_num: number,
  year: string
}
interface SupplyChainCost{
  game_num: number,
  supply_chain_cost: number,
  role: string,
  week_num: number,
  year: string
}
interface Surplus{
  game_num: number,
  surplus: number,
  role: string,
  week_num: number,
  year: string
}
interface GameData{
  inventory: Inventory[],
  orders: Order[],
  supply_chain_cost: SupplyChainCost[],
  surplus: Surplus[]
}

let game_data: GameData; // Variable to store the game data

let myChart: any = null;

function populateDropdowns(): void {
  const yearSelect = $("#year-select");
  const gameSelect = $("#game-select");

  const years = [...new Set(
    Object.values(game_data)
      .flatMap((dataset: (Inventory | Order | SupplyChainCost | Surplus)[]) => 
        dataset.map((entry: Inventory | Order | SupplyChainCost | Surplus) => entry.year)
      )
  )].sort();

  const gameNumbers = [...new Set(
    Object.values(game_data)
      .flatMap((dataset: (Inventory | Order | SupplyChainCost | Surplus)[]) => 
        dataset.map((entry: Inventory | Order | SupplyChainCost | Surplus) => entry.game_num)
      )
  )].sort((a, b) => a - b);

  yearSelect.empty();
  years.forEach(year => {
    yearSelect.append(`<option value="${year}">${year}</option>`);
  });

  gameSelect.empty();
  gameNumbers.forEach(gameNum => {
    gameSelect.append(`<option value="${gameNum}">Game ${gameNum}</option>`);
  });

  // Set default selections (first available options)
  yearSelect.val(years[0]);
  gameSelect.val(gameNumbers[0]);

  // Trigger chart update with default selections
  updateChart();
}

// Function to load game data using jQuery
function loadGameData(): void {
  $.getJSON('./static/game-data.json')
    .done((data: GameData) => {
      game_data = data;
      populateDropdowns(); // Populate dropdowns and plot default chart
    })
    .fail((jqxhr, textStatus, error) => {
      console.error('Failed to load game data:', error);
    });
}

function updateChart(): void {
  const selectedYear = $("#year-select").val() as string;
  const selectedGame = $("#game-select").val() as string;
  const selectedType = $("#chart-type").val() as string;

  let datasets: { label: string; data: number[]; borderColor: string }[] = [];
  let labels: number[] = [];

  if (selectedType === "supply_chain_cost") {
    // Disable game selection
    $("#game-select").prop("disabled", true);

    // Plot ALL games at once
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

  } else {
    // Enable game selection
    $("#game-select").prop("disabled", false);

    // Get the correct dataset type
    const dataKey = selectedType as keyof GameData;
    const selectedData = game_data[dataKey].filter(
      (entry) => entry.year === selectedYear && entry.game_num === Number(selectedGame)
    );

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
          label: `${role} ${selectedType}`,
          data: roleEntries.map(entry => (entry as any)[selectedType]), // 🔥 FIXED HERE
          borderColor: `hsl(${(index * 60) % 360}, 70%, 50%)`,
        });
      }
    });
  }

  createChart(labels, datasets);
}



function createChart(labels: number[], datasets: { label: string; data: number[]; borderColor: string }[]): void {
  const ctx = $("#myChart") as unknown as HTMLCanvasElement;

  if (myChart) {
    myChart.destroy(); // Destroy the old chart
  }

  myChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: "Week Number" } },
        y: { title: { display: true, text: "Value" } }
      }
    }
  });
}


// Call the function after the page loads
$(function () {
  loadGameData();

  $("#year-select, #game-select, #chart-type").on("change", function () {
    const scrollPos = window.scrollY; // Store current scroll position
    updateChart(); // Refresh the chart when the type changes
    window.scrollTo(0, scrollPos); // Restore scroll position after update
  });
});

