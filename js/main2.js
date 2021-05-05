import { DynamicState } from "./classes/DynamicState.js"
import { TimeSeries } from "./classes/rewrite/TimeSeries.js"
import { Format } from "./classes/Format.js"
import { Scatter } from "./classes/rewrite/ScatterPlot.js"
import { Spider } from "./classes/SpiderPlot.js"
import { MapPlot } from "./classes/MapPlot.js"

// TODO: This whole approach is deprecated, get rid of it as soon as rewrite complete

const URL = "https://data.cdc.gov/resource/muzy-jte6.json?$limit=10000&$where=mmwryear='2021' or mmwryear='2020'"
//const URL = "./data/test_data.json"

const populationDataPromise = d3.json("./data/population_2019.json")
const geoDataPromise = d3.json("./data/us_geo.json")
const mainDataPromise = d3.json(URL)

Promise.all([populationDataPromise, geoDataPromise, mainDataPromise]).then(datas => {
  const popData = datas[0]
  const geoData = datas[1]
  const rawData = datas[2]

  function applyTransform(transform, data, field) {
    for (const [i, row] of data.entries()) {
      const v = transform.f(row, i, field, data)
      if (v != null) {
        row[field + "#" + transform.id] = v
      }
    }
  }

  // TODO: Hide labels

  const populationMap = d3.group(popData, d => d.NAME)



  const numericFields = new Map([
    ["all_cause", "all_cause"],
    ["alzheimer_disease_g30", "alzheimer_disease_g30"],
    ["diseases_of_heart_i00_i09", "diseases_of_heart_i00_i09"],
    ["natural_cause", "natural_cause"],
    ["malignant_neoplasms_c00_c97", "malignant_neoplasms_c00_c97"],
    ["influenza_and_pneumonia_j09_j18", "influenza_and_pneumonia_j09_j18"],
    ["other_diseases_of_respiratory", "other_diseases_of_respiratory"],
    ["symptoms_signs_and_abnormal", "symptoms_signs_and_abnormal"],
    ["covid_19_u071_underlying_cause_of_death", "covid_19_u071_underlying_cause_of_death"]
  ])
  const fieldConfig = {};
  ([...numericFields.values()]).forEach(field => fieldConfig[field] = "number")

  var data = Format.format(rawData, fieldConfig)
  data = data.filter(d => d.jurisdiction_of_occurrence != "United States" && d.jurisdiction_of_occurrence != "New York City")
  data.forEach(row => {
    row.pop = populationMap.get(row["jurisdiction_of_occurrence"])[0].POP

    // for (const field of numericFields.values()) {
    //   row[field] = row[field] * (100000 / row.pop)
    // }
  })


  const transforms = new Map()
  transforms.set("log", {id: "log", f: ((d,i,field,data) => {
    return d[field] > 0 ? Math.log(d[field]) : null
  })})
  transforms.set("per100k", {id: "per100k", f: ((d,i,field,data) => {
    return 100000 * d[field] / d.pop
  })})
  transforms.set("raw", {id: "raw", f: ((d, i, field, data) =>  d[field])})

  for (const numericField of numericFields) {
    applyTransform(transforms.get("log"), data, numericField[0])
    applyTransform(transforms.get("per100k"), data, numericField[0])
    applyTransform(transforms.get("raw"), data, numericField[0])
  }

  const state = new DynamicState()
  state.defineProperty("selected", new Set())
  state.defineProperty("focus", null)
  state.defineProperty("yField", "covid_19_u071_underlying_cause_of_death")

  window.scatter = new Scatter(
    document.getElementById("scatter"), 
    data, state, "week_ending_date", "all_cause", "covid_19_u071_underlying_cause_of_death", 
    "jurisdiction_of_occurrence", {
      size: [300, 300], unit: "deaths per 100k", transform: transforms.get("per100k")
    }
  )
  state.addListener((p, v) => scatter.stateChange(p, v))

  const coloring = getDefaultColoring(data, "jurisdiction_of_occurrence")
  window.map = new MapPlot(
    document.getElementById("map"),
    geoData, data, state, "week_ending_date", "covid_19_u071_underlying_cause_of_death", "jurisdiction_of_occurrence", 
    { transform: transforms.get("per100k"), tValue: scatter.tValue}
  )
  state.addListener((p, v) => map.stateChange(p, v))

  window.timeSeries = new TimeSeries(
    document.getElementById("time-series"), 
    data, state, "week_ending_date", "covid_19_u071_underlying_cause_of_death", "jurisdiction_of_occurrence",
    {size: [720, 260], tTickFormat: v => v.toISOString().slice(0, 10), drawNowLine: true, 
      yTooltipFormat: v => v.toFixed(2),unit: "deaths per 100k",  transform: transforms.get("per100k"),
    tValue: scatter.tValue}
  )
  state.addListener((p, v) => timeSeries.stateChange(p, v))

  window.spider = new Spider(
    document.getElementById("spider"), 
    data, state, "week_ending_date", "jurisdiction_of_occurrence",
    [...numericFields.values()], {size: [360, 300], transform: transforms.get("per100k"), tValue: scatter.tValue},
  )
  state.addListener((p, v) => spider.stateChange(p, v))

  const xSelect = createSelect("X", numericFields, ([...numericFields.values()])[0],
  function() {
      scatter.setXField(this.value)
    }
  )
  const ySelect = createSelect("Y", numericFields, 'covid_19_u071_underlying_cause_of_death',
    function() {
      timeSeries.setYField(this.value)
      scatter.setYField(this.value)
      map.setYField(this.value)
    }
  )

  const xTransformSelect = createSelect("Xt", [...transforms.keys()].map(d => [d, d]), "per100k",
    function() {
      //scatter.setXField(this.value)
    }
  )

  const yTransformSelect = createSelect("Yt", [...transforms.keys()].map(d => [d, d]), "per100k",
    function() {
      //scatter.setXField(this.value)
      const transform = transforms.get(this.value)
      timeSeries.setTransform(transform)
      scatter.setTransform(transform)
      map.setTransform(transform)
    }
  )

  const labelCheck = createCheckbox("Labels", function(e) {
    scatter.setLabelsVisible(this.checked)
    map.setLabelsVisible(this.checked)
    timeSeries.setLabelsVisible(this.checked)
  }, true)
  const axisLabels = createCheckbox("Axis Labels", function(e) {
    scatter.setAxisLabelsVisible(this.checked)
    timeSeries.setAxisLabelsVisible(this.checked)
  }, true)

  const controlsTop = document.getElementById("controls-top")
  controlsTop.appendChild(xSelect)
  controlsTop.appendChild(ySelect)
  // controlsTop.appendChild(xTransformSelect)
  // controlsTop.appendChild(yTransformSelect)
  // controlsTop.appendChild(labelCheck)
  controlsTop.appendChild(axisLabels)

  const tSlider = createSlider(`date-slider`, "Date:", scatter.tValues, scatter.tValue,
    function(v) {
      scatter.setTValue(scatter.tValues[v])
      timeSeries.setTValue(timeSeries.tValues[v])
      spider.setTValue(timeSeries.tValues[v])
      map.setTValue(map.tValues[v])
    },
    v => v.toISOString().slice(0, 10)
  )

  const controlsBottom = document.getElementById("controls-bottom")
  controlsBottom.appendChild(tSlider)

  const stratifySelect = document.getElementById("stratify-select")
  const sValues = new Set()
  for (const row of data) {
    sValues.add(row["jurisdiction_of_occurrence"])
  }
  for (const sValue of sValues) {
    const option = document.createElement("option")
    option.innerText = sValue
    option.value = sValue.replace(/[\W_]+/g,"_")
    stratifySelect.appendChild(option)
  }
  // stratifySelect.addEventListener("onchange", () => {
  //   console.log("Beep")
  // })
  stratifySelect.onchange = () => {
    const selected = new Set()
    for (const option of stratifySelect.options) {
      if (option.selected) {
        selected.add(option.value)
      }
    }
    state.selected = selected
  }

  state.addListener((p, v) => {
    if (p == "selected") {

      for (const option of stratifySelect.options) {
        if (v.has(option.value)) {
          option.selected = true
        } else {
          option.selected = false
        }
      }
      
    }
  })
})

function getDefaultColoring(data, sField) {
  const sColorMap = new Map()
  const sValues = [...d3.group(data, d => d[sField]).keys()].map(d => d.replace(/[\W_]+/g,"_"))
  
  const colorScale = d3.scaleSequential()
    .domain([0, sValues.length])
    .interpolator(d3.interpolateRainbow) 

  for (const [i, sValue] of sValues.entries()) {
    sColorMap.set(sValue, colorScale(i))
  }

  return {id: "default", name: "Default", f: function(d, i) {return sColorMap.get(d._s)}}
}

