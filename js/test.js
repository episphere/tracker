import { DynamicState } from "./classes/DynamicState.js"
import { TimeSeries } from "./classes/rewrite/TimeSeries.js"
import { Format } from "./classes/Format.js"
import { MapPlot } from "./classes/MapPlot.js"


const URL = "https://data.cdc.gov/resource/muzy-jte6.json?$limit=10000&$where=mmwryear='2021' or mmwryear='2020'"
//const URL = "../data/test_data2.json"

const populationDataPromise = d3.json("../data/population_2019.json")
const geoDataPromise = d3.json("../data/us_geo.json")
const mainDataPromise = d3.json(URL)

Promise.all([populationDataPromise, geoDataPromise, mainDataPromise]).then(datas => {
  const popData = datas[0]
  const geoData = datas[1]
  const rawData = datas[2]

  const numericFields = new Map([
    ["covid_19_u071_underlying_cause_of_death", "COVID-19 Deaths"],
  ])
  const fieldConfig = {};
  ([...numericFields.keys()]).forEach(field => fieldConfig[field] = "number")
  var data = Format.format(rawData, fieldConfig)


  // const included = new Set(["Virginia", "Maryland"])
  // const included = new Set()
  // const grouped = d3.group(data, d => d.jurisdiction_of_occurrence)
  // for (const [key, values] of grouped) {
  //   if (values[values.length - 1]["covid_19_u071_underlying_cause_of_death"]) {
  //     included.add(key)
  //   }
  // }
  
  // data = data.filter(d => included.has(d.jurisdiction_of_occurrence))
  data = data.filter(d => d.jurisdiction_of_occurrence != "United States")

  const state = new DynamicState()
  state.defineProperty("selected", new Set())
  state.defineProperty("focus", null)
  state.defineProperty("yField", "covid_19_u071_underlying_cause_of_death")

  const coloring = getDefaultColoring(data, "jurisdiction_of_occurrence")

  window.timeSeries = new TimeSeries(
    document.getElementById("time-series"), 
    data, state, "week_ending_date", "covid_19_u071_underlying_cause_of_death", "jurisdiction_of_occurrence",
    {size: [720, 260], tTickFormat: v => v.toISOString().slice(0, 10), drawNowLine: false, 
    fieldMap: numericFields}
  )
  state.addListener((p, v) => timeSeries.stateChange(p, v))

  // window.map = new MapPlot(
  //   document.getElementById("map"),
  //   geoData, data, state, "week_ending_date", "covid_19_u071_underlying_cause_of_death", "jurisdiction_of_occurrence", 
  // )
  // state.addListener((p, v) => map.stateChange(p, v))
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