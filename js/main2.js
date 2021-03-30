import { DynamicState } from "./classes/DynamicState.js"
import { TimeSeries } from "./classes/rewrite/TimeSeries.js"
import { Format } from "./classes/Format.js"
import { Scatter } from "./classes/rewrite/ScatterPlot.js"
import { Spider } from "./classes/SpiderPlot.js"


const URL = "https://data.cdc.gov/resource/muzy-jte6.json?$limit=10000&$where=mmwryear='2021' or mmwryear='2020'"
//const URL = "./data/test_data.json"

const populationDataPromise = d3.json("./data/population_2019.json")
const mainDataPromise = d3.json(URL)

Promise.all([populationDataPromise, mainDataPromise]).then(datas => {
  const popData = datas[0]
  const rawData = datas[1]

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
    //console.log(row["jurisdiction_of_occurrence"], populationMap.get(row["jurisdiction_of_occurrence"]))//[0].POP)
    const pop = populationMap.get(row["jurisdiction_of_occurrence"])[0].POP
    for (const field of numericFields.values()) {
      row[field] = row[field] / pop
    }
  })

  const state = new DynamicState()
  state.defineProperty("selected", new Set())
  state.defineProperty("focus", null)

  window.timeSeries = new TimeSeries(
    document.getElementById("time-series"), 
    data, state, "week_ending_date", "alzheimer_disease_g30", "jurisdiction_of_occurrence",
    {size: [720, 320], tTickFormat: v => v.toISOString().slice(0, 10), drawNowLine: true}
  )
  state.addListener((p, v) => timeSeries.stateChange(p, v))

  window.scatter = new Scatter(
    document.getElementById("scatter"), 
    data, state, "week_ending_date", "all_cause", "alzheimer_disease_g30", 
    "jurisdiction_of_occurrence"
  )
  state.addListener((p, v) => scatter.stateChange(p, v))

  window.spider = new Spider(
    document.getElementById("spider"), 
    data, state, "week_ending_date", "jurisdiction_of_occurrence",
    [...numericFields.values()]
  )
  state.addListener((p, v) => spider.stateChange(p, v))

  const xSelect = createSelect("X Axis", numericFields, ([...numericFields.values()])[0],
  function() {
      scatter.setXField(this.value)
    }
  )
  const ySelect = createSelect("Y Axis", numericFields, ([...numericFields.values()])[1],
    function() {
      timeSeries.setYField(this.value)
      scatter.setYField(this.value)
    }
  )

  const controlsTop = document.getElementById("controls-top")
  controlsTop.appendChild(xSelect)
  controlsTop.appendChild(ySelect)

  const tSlider = createSlider(`date-slider`, "Date:", scatter.tValues, scatter.tValue,
    function(v) {
      scatter.setTValue(scatter.tValues[v])
      timeSeries.setTValue(timeSeries.tValues[v])
      spider.setTValue(timeSeries.tValues[v])
      //spider.setTValue(timeSeries.tValues[v])
    },
    v => v.toISOString().slice(0, 10)
  )

  const controlsBottom = document.getElementById("controls-bottom")
  controlsBottom.appendChild(tSlider)
})

