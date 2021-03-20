Array.prototype.sum = function () {
  return this.reduce((a, b) => {
    return a + b;
  }, 0)
}

Array.prototype.includes = function(e) {
  return this.indexOf(e) !== -1
}

// TODO: remove dates and rawData parms from here, its just a mess
// maybe create a storage object somewhere
const initMultiSelect = (name, db) => {
  let select = document.querySelector(`select[name="${name}"]`);
  Array.from(db.getCollection(name)).sort().forEach(e => {
    let option = document.createElement('option');
    option.setAttribute('value', e);
    // option.setAttribute('disabled', 0);
    option.text = e;
    select.appendChild(option)
  })

  new lc_select(`select[name="${name}"]`, {
    enable_search: name !== "doses",
    wrap_width: '100%',
    // min_for_search: 2,
    // max_opts: 1,
    autofocus_search: true,
    addit_classes : ['multiselect'],
    on_change : (new_value, target_field) => {
      db.getFilters()[name] = new_value;
      updateChart(db);
    },
    labels : [
        'căutare',
        'adaugă',
        'alege',
        '.. nema ..',
    ],
  });
}

const datasetFrom = (dates, inputData, filters, label, hidden) => {
  array = [];
  dates.forEach(date => {
    let value = inputData
      .filter(e => e['Data vaccinării'] === date)
      .map(e => {
        if (filters.doses.length === 0 || filters.doses.length === 2) {
          return e['Doze administrate']
        } else {
          return e[filters.doses[0]]
        }
      })
      .sum()
    array.push(value)
  })

  if (filters.cumulative) {
    let tempArray = []
    let i = 0
    for (e of array) {
      let newValue = e;
      if (i !== 0) {
        newValue += tempArray[i - 1]
      }
      tempArray.push(newValue)
      i += 1
    }
    array = tempArray;
  }

  return {
    label: label,
    data: array,
    hidden: hidden,
    fill: false,
  }
}

const updateChart = (db) => {
  let filters = db.getFilters();
  let hidden = filters.hidden;
  if (chart !== undefined) {
    // the hidden state can be either directly on the dataset or in its
    // _meta attribute so we check for both
    hidden = chart.data.datasets.map(e => {
      let firstVal = e._meta[Object.keys(e._meta)[0]].hidden;
      return firstVal === null ? e.hidden : firstVal;
    })
    chart.destroy();
  }

  let dataCity = db.getData();

  if (filters.cities.length === 0 && filters.centers.length === 0) {
    if (filters.counties.length > 0) {
      dataCity = dataCity.filter(e => filters.counties.includes(e['Județ']))
    }
  }
  if (filters.centers.length === 0) {
    if (filters.cities.length > 0) {
      dataCity = dataCity.filter(e => filters.cities.includes(e['Localitate']))
    }
  }
  if (filters.centers.length > 0) {
    dataCity = dataCity.filter(e => filters.centers.includes(e['Nume centru']))
  }
  if (filters.categories.length > 0) {
    // console.log(Array.from(db.collections.categories).sort())
    if (filters.categories.includes('Categoria I')) {
      let items = Array.from(db.collections.categories).filter(e => e.startsWith('Categoria I '))
      items.forEach(e => filters.categories.push(e))
    }
    if (filters.categories.includes('Categoria II')) {
      let items = Array.from(db.collections.categories).filter(e => e.startsWith('Categoria II-'))
      items.forEach(e => filters.categories.push(e))
    }
    if (filters.categories.includes('Categoria III')) {
      let items = Array.from(db.collections.categories).filter(e => e.startsWith('Categoria III-'))
      items.forEach(e => filters.categories.push(e))
    }
    ['Categoria II-a', 'Categoria II-b', 'Categoria III-a', 'Categoria III-b', 'Categoria III-c'].forEach(cat => {
      if (filters.categories.includes(cat)) {
        let items = Array.from(db.collections.categories).filter(e => e.startsWith(cat))
        items.forEach(e => filters.categories.push(e))
      }
    })
    // console.log(filters.categories)
    dataCity = dataCity.filter(e => filters.categories.includes(e['Grupa de risc']))
  }

  let dataPB = dataCity
    .filter(e => e['Produs'] == 'Pfizer - BIONTech')

  let dataM = dataCity
    .filter(e => e['Produs'] == 'Moderna')

  let dataAZ = dataCity
    .filter(e => e['Produs'] == 'Astra-Zeneca')

  updateUIFilter(db);

  let ctx = document.getElementById('myChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array.from(db.getDates()),
        datasets: [
          datasetFrom(db.getDates(), dataCity, filters, 'Total', hidden[0]),
          datasetFrom(db.getDates(), dataPB, filters, 'Pfizer - BIONTech', hidden[1]),
          datasetFrom(db.getDates(), dataM, filters, 'Moderna', hidden[2]),
          datasetFrom(db.getDates(), dataAZ, filters, 'Astra-Zeneca', hidden[3]),
        ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        colorschemes: {
          scheme: 'tableau.Tableau10'
        }
      }
    }
  });
}

const updateUIFilter = (db) => {
  let cities = document.querySelector(`select[name="cities"]`);
  let centers = document.querySelector(`select[name="centers"]`);

  selectableCities = db.getSelectableCities()
  for (let c of cities.children) {
    if (selectableCities.indexOf(c.value) !== -1) {
      c.removeAttribute('disabled')
    } else {
      c.setAttribute('disabled', true)
    }
  }

  selectableCenters = db.getSelectableCenters()
  for (let c of centers.children) {
    if (selectableCenters.indexOf(c.value) !== -1) {
      c.removeAttribute('disabled')
    } else {
      c.setAttribute('disabled', true)
    }
  }
}

const toggleCumulative = (event) => {
  db.filters.cumulative = event.checked;
  updateChart(db)
}

const init = async () => {
  const response = await fetch('data/latest.json');
  const responseJson = await response.json();
  let rawData = responseJson['ag-grid'];

  db.update(rawData);

  initMultiSelect('counties', db)
  initMultiSelect('cities', db)
  initMultiSelect('centers', db)
  initMultiSelect('categories', db)
  initMultiSelect('doses', db)

  updateChart(db)

  document.querySelector('#content').style.display = 'block';
  document.querySelector('#loader').remove();
}

let db = new Db();
let chart = undefined; // should you be writing this?
document.addEventListener("DOMContentLoaded", init)
