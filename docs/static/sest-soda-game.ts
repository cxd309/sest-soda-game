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
let roleChart: any = null;
let sccChart: any = null;

// populate the dropdown values
function populateDropdowns(): void {
  const yearSelectors = [$("#year-select")];
  const gameSelectors = [$("#game-select")];

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

  yearSelectors.forEach((selector) => selector.empty());
  gameSelectors.forEach((selector) => selector.empty());

  years.forEach(year => {
    let contents = `<option value="${year}">${year}</option>`
    yearSelectors.forEach((selector) => selector.append(contents));
  });

  gameNumbers.forEach(gameNum => {
    let contents = `<option value="${gameNum}">Game ${gameNum}</option>`
    gameSelectors.forEach((selector) => selector.append(contents))
  });

  // Set default selections (first available options)
  yearSelectors.forEach((selector) => selector.val(years[0]));
  gameSelectors.forEach((selector) => selector.val(gameNumbers[0]));

  // Trigger chart update with default selections
  updateCharts();
}

// load game_data
function loadGameData(): void {
  $.getJSON('./static/game-data.json')
    .done((data: GameData) => {
      game_data = data;
      populateDropdowns();
    })
    .fail((jqxhr, textStatus, error) => {
      console.error('Failed to load game data:', error);
    });
}

function updateCharts(): void {
  updateRoleChart();
  updateSCCChart();
}

function updateRoleChart(): void{
  const selectedYear = $("#year-select").val() as string;
  const selectedGame = $("#game-select").val() as string;
  const selectedType = $("#chart-type").val() as string;

  let datasets: { label: string; data: number[]; borderColor: string }[] = [];
  let labels: number[] = [];

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
        label: `${role}`,
        data: roleEntries.map(entry => (entry as any)[selectedType]),
        borderColor: `hsl(${(index * 60) % 360}, 70%, 50%)`,
      });
    }
  });

  const ctx = $("#role-chart") as unknown as HTMLCanvasElement;

  if (roleChart){
    roleChart.destroy();
  }

  roleChart = createChart(labels, datasets, ctx, selectedType.charAt(0).toUpperCase()+selectedType.substring(1));
}

function updateSCCChart(): void{
  const selectedYear = $("#year-select").val() as string;

  let datasets: { label: string; data: number[]; borderColor: string }[] = [];
  let labels: number[] = [];

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

  const ctx = $("#scc-chart") as unknown as HTMLCanvasElement;

  if (sccChart){
    sccChart.destroy();
  }

  sccChart = createChart(labels, datasets, ctx, "Supply Chain Cost");
}

function createChart(labels: number[], datasets: { label: string; data: number[]; borderColor: string }[], ctx: any, title: string) {
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

  $("#year-select, #game-select, #chart-type").on("change", function(){
    const scrollPos = window.scrollY;
    updateCharts();
    window.scrollTo(0, scrollPos); // Restore scroll position after update
  });
});

