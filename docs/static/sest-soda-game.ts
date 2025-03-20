interface Inventory{
  game_num: number,
  inventory: number,
  role: string,
  week_num: number,
  year: string,
  value?: number
}
interface Order{
  game_num: number,
  orders: number,
  role: string,
  week_num: number,
  year: string,
  value?: number
}
interface SupplyChainCost{
  game_num: number,
  supply_chain_cost: number,
  role: string,
  week_num: number,
  year: string,
  value?: number
}
interface Surplus{
  game_num: number,
  surplus: number,
  role: string,
  week_num: number,
  year: string,
  value?: number
}
interface GameData{
  inventory: Inventory[],
  orders: Order[],
  supply_chain_cost: SupplyChainCost[],
  surplus: Surplus[]
}
interface DataSelector{
  year: string,
  game: number,
  type: keyof GameData
}

let game_data: GameData; // Variable to store the game data
let roleChart: Chart;
let sccChart: Chart;
const roleOrder: string[] = [
  "Consumer",
  "Retailer",
  "Wholesaler",
  "Distributor",
  "Factory"
]

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
      game_data.inventory.forEach(item => {item.value = item.inventory});
      game_data.orders.forEach(item => {item.value = item.orders});
      game_data.surplus.forEach(item => {item.value = item.surplus});
      populateDropdowns();
    })
    .fail((jqxhr, textStatus, error) => {
      console.error('Failed to load game data:', error);
    });
}

function updateCharts(): void {
  const dataSelection: DataSelector = {
    year: $("#year-select").val() as string,
    game: parseInt($("#game-select").val() as string),
    type: $("#chart-type").val() as keyof GameData
  };
  buildRoleChart(dataSelection);
  buildSCCChart(dataSelection);
}

function buildRoleChart(dataSelection: DataSelector): void {
  const filteredData = game_data[dataSelection.type].filter(
    row =>
      row.year == dataSelection.year &&
      row.game_num == dataSelection.game
  ).sort(
    (a, b) => a.week_num - b.week_num
  );
  const labels: number[] = [...new Set(filteredData.map(row => row.week_num))];
  const chartDataset: {
    label: string; 
    data: (number | undefined)[]
  }[] = [];
  roleOrder.forEach(function(role){
    let roleData = filteredData.filter(row => row.role == role);
    if(roleData.length >0){
      chartDataset.push({label:role, data:roleData.map(row => row.value)});
    }
  });
  const title: string = dataSelection.type.charAt(0).toUpperCase() + dataSelection.type.slice(1)
  if(roleChart == undefined){
    roleChart = new Chart(
      "role-chart",
      {
        type: "line",
        data: {
          datasets: [{
            data:[]
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
              text: `${title}`,
              font: {
                size: 18
              }
            }
          },
          scales: ({
            x: { title: { display: true, text: "Week Number" } },
            y: { title: { display: true, text: `${title}` } }
          } as Chart.LinearScale)
        }
      }
    );
  }
  roleChart.data = {labels: labels, datasets: chartDataset};
  roleChart.update();
}

function buildSCCChart(dataSelection: DataSelector): void {
  const filteredData = game_data.supply_chain_cost.filter(
    row =>
      row.year == dataSelection.year
  ).sort(
    (a, b) => a.week_num - b.week_num
  ).sort(
    (a, b) => a.game_num - b.game_num
  );
  const labels: number[] = [...new Set(filteredData.map(row => row.week_num))];
  const gameNumbers: number[] = [...new Set(filteredData.map(row => row.game_num))];
  const chartDataset: {
    label: string; 
    data: (number | undefined)[];
    borderColor: string;
    backgroundColor: string
  }[] = [];

  gameNumbers.forEach(function(game_num){
    let gameData = filteredData.filter(row => row.game_num == game_num);
    if(gameData.length >0){
      chartDataset.push({
        label:`Game ${game_num}`, 
        data:gameData.map(row => row.supply_chain_cost),
        borderColor: `hsla(${(game_num * 22.5) % 360}, 70%, 50%)`,
        backgroundColor: `hsla(${(game_num * 22.5) % 360}, 70%, 50%, 0.5)`
      });
    }
  });
  console.log(chartDataset);
  if(sccChart == undefined){
    sccChart = new Chart(
      "scc-chart",
      {
        type: "line",
        data: {
          datasets: [{
            data:[]
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
          scales: ({
            x: { title: { display: true, text: "Week Number" } },
            y: { title: { display: true, text: "Supply Chain Cost" } }
          } as Chart.LinearScale)
        }
      }
    );
  }
  sccChart.data = {labels: labels, datasets: chartDataset};
  sccChart.update();
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

