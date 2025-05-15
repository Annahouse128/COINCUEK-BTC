// Masukkan API key kamu di sini
const API_KEY = "adb79cfe5a84885fadfc0a90d4d1ae03";

async function fetchFREDData(seriesId) {
  const response = await fetch(
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${API_KEY}&file_type=json`
  );
  const data = await response.json();
  return data.observations.map(obs => ({
    date: obs.date,
    value: parseFloat(obs.value)
  })).filter(d => !isNaN(d.value));
}

async function fetchBTCData() {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max"
  );
  const data = await response.json();
  return data.prices.map(item => {
    const date = new Date(item[0]);
    return {
      date: date.toISOString().slice(0, 10),
      value: item[1]
    };
  });
}

function drawChart(canvas, labels, dataset1, dataset2, label1, label2) {
  new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: label1,
          data: dataset1,
          borderColor: "#1d4ed8",
          yAxisID: "y1",
          borderWidth: 2
        },
        {
          label: label2,
          data: dataset2,
          borderColor: "#16a34a",
          yAxisID: "y2",
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: "index",
        intersect: false
      },
      stacked: false,
      scales: {
        y1: {
          type: "linear",
          display: true,
          position: "left"
        },
        y2: {
          type: "linear",
          display: true,
          position: "right",
          grid: {
            drawOnChartArea: false
          }
        }
      }
    }
  });
}

function filterByDate(data, startDate, endDate) {
  return data.filter(d => {
    const date = new Date(d.date);
    return (!startDate || date >= new Date(startDate)) &&
           (!endDate || date <= new Date(endDate));
  });
}

function calculateCorrelation(x, y) {
  const n = x.length;
  const avgX = x.reduce((a, b) => a + b) / n;
  const avgY = y.reduce((a, b) => a + b) / n;

  const numerator = x.reduce((sum, xi, i) => sum + (xi - avgX) * (y[i] - avgY), 0);
  const denominator = Math.sqrt(
    x.reduce((sum, xi) => sum + Math.pow(xi - avgX, 2), 0) *
    y.reduce((sum, yi) => sum + Math.pow(yi - avgY, 2), 0)
  );

  return (numerator / denominator).toFixed(3);
}

function generateAnalysis(type) {
  if (type === 'm2sl') {
    return `
      <h3>Dampak M2SL terhadap Bitcoin</h3>
      <p>
        M2SL (Uang Beredar M2) merepresentasikan suplai uang dalam ekonomi. 
        Ketika M2 meningkat signifikan, biasanya terdapat peningkatan likuiditas 
        yang dapat mendorong investor membeli aset alternatif seperti Bitcoin.
        Namun, jika kenaikan uang beredar tidak disertai kepercayaan pasar, 
        dapat memicu inflasi dan tekanan jangka pendek terhadap BTC.
      </p>
    `;
  } else if (type === 'walcl') {
    return `
      <h3>Dampak WALCL terhadap Bitcoin</h3>
      <p>
        WALCL adalah neraca bank sentral. Ketika Federal Reserve memperluas neraca
        (misalnya lewat Quantitative Easing), biasanya likuiditas meningkat di pasar,
        dan investor cenderung memasuki aset berisiko termasuk Bitcoin. 
        Sebaliknya, pengetatan neraca cenderung berdampak negatif terhadap harga BTC.
      </p>
    `;
  }
  return '';
}

async function render() {
  const [m2sl, walcl, btc] = await Promise.all([
    fetchFREDData('M2SL'),
    fetchFREDData('WALCL'),
    fetchBTCData()
  ]);

  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;

  function syncDates(fredData) {
    const btcMap = Object.fromEntries(btc.map(item => [item.date, item.value]));
    const synced = fredData.map(item => {
      const btcVal = btcMap[item.date];
      return btcVal ? {
        date: item.date,
        fred: item.value,
        btc: btcVal
      } : null;
    }).filter(Boolean);
    return filterByDate(synced, startDate, endDate);
  }

  const syncedM2 = syncDates(m2sl);
  const syncedWALCL = syncDates(walcl);

  drawChart(
    document.getElementById('m2slChart'),
    syncedM2.map(d => d.date),
    syncedM2.map(d => d.fred),
    syncedM2.map(d => d.btc),
    'M2SL',
    'BTC'
  );

  drawChart(
    document.getElementById('walclChart'),
    syncedWALCL.map(d => d.date),
    syncedWALCL.map(d => d.fred),
    syncedWALCL.map(d => d.btc),
    'WALCL',
    'BTC'
  );

  const corrM2 = calculateCorrelation(syncedM2.map(d => d.fred), syncedM2.map(d => d.btc));
  const corrWALCL = calculateCorrelation(syncedWALCL.map(d => d.fred), syncedWALCL.map(d => d.btc));

  document.getElementById('m2slAnalysis').innerHTML = generateAnalysis('m2sl') + `<br><br><strong>Korelasi M2SL dan BTC:</strong> ${corrM2}`;
  document.getElementById('walclAnalysis').innerHTML = generateAnalysis('walcl') + `<br><br><strong>Korelasi WALCL dan BTC:</strong> ${corrWALCL}`;
}

async function generatePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Analisis M2SL, WALCL vs Bitcoin", 10, 10);
  doc.setFontSize(10);
  doc.text("Periode: " + document.getElementById("startDate").value + " s.d. " + document.getElementById("endDate").value, 10, 20);

  const m2Text = document.getElementById('m2slAnalysis').innerText;
  const walclText = document.getElementById('walclAnalysis').innerText;

  doc.text(m2Text, 10, 30);
  doc.addPage();
  doc.text(walclText, 10, 10);

  doc.save("analisis-makro-bitcoin.pdf");
}

// Auto-render saat halaman pertama kali dibuka
window.addEventListener("load", render);
