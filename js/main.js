import { TimeSeries } from "./classes/TimeSeries.js"
import { ScatterPlot } from "./classes/ScatterPlot.js"
import { DynamicState } from "./classes/DynamicState.js"
import { ParallelPlot } from "./classes/ParallelPlot.js"

// fetch("https://data.cdc.gov/resource/muzy-jte6.json?$limit=10000&$where=mmwryear='2021'").then(data => {
//   console.log(data.json())
// })

const URL = "https://data.cdc.gov/resource/muzy-jte6.json?$limit=10000&$where=mmwryear='2021'"
d3.json(URL).then(data => {

  // TODO: Use some better function for this + unhardcode numerics
  const numeric = ["all_cause", "natural_cause", "influenza_and_pneumonia_j09_j18", "alzheimer_disease_g30"]
  data.forEach(row => {
    numeric.forEach(field => row[field] = parseFloat(row[field]))
  })

  // TODO: Remove dependence on TAFFY
  const dataset = TAFFY(data.filter(row => row.jurisdiction_of_occurrence != "United States"))
  setUp(dataset)

  const state = new DynamicState()
  state.defineProperty("dataset", dataset)
  state.defineProperty("tValue", defaults.T_VALUE)
  state.defineProperty("coloring", defaults.COLORING_MAP.get(defaults.COLORING))
  state.defineProperty("tracesEnabled", defaults.TRACES_ENABLED)
  state.defineProperty("selected", new Set())
  state.defineProperty("focus", null)

  const timeSeries = new TimeSeries(
    "time-series", defaults.Y_FIELD, defaults.S_FIELD, defaults.T_FIELD, state,
    {
      coloringMap: defaults.COLORING_MAP, 
      interactiveColor: defaults.INTERACTIVE_LINE_COLOR, 
      xTickFormat: v => new Date(v).toISOString().slice(0, 10),
      size: [820, 240],
      margin: {left: 40, right: 130, bottom:20, top:30}
    }
  )

  state.addListener((p, v) => timeSeries.stateChange(p, v))


  const scatter = new ScatterPlot(
    "scatter", defaults.X_FIELD, defaults.Y_FIELD, defaults.S_FIELD, defaults.T_FIELD, state,
    {
      interactiveColor: defaults.INTERACTIVE_COLOR, 
      size: [360, 360],
      trimStd: 5,
      margin: {left: 40, right: 20, bottom:20, top:10}
    }
  )

  state.addListener((p, v) => scatter.stateChange(p, v))

  const parallel = new ParallelPlot(
    "pcp", defaults.S_FIELD, defaults.T_FIELD, [...defaults.Y_FIELD_MAP.values()], state,
    {
      interactiveColor: defaults.INTERACTIVE_COLOR, 
      size: [360, 360]
    }
  )

  state.addListener((p, v) => parallel.stateChange(p, v))
  
  const xSelect = createSelect("X Axis", [...defaults.Y_FIELD_MAP.entries()], defaults.X_FIELD,
  function() {
      scatter.setXField(this.value)
    }
  )
  const ySelect = createSelect("Y Axis", [...defaults.Y_FIELD_MAP.entries()], defaults.Y_FIELD,
    function() {
      scatter.setYField(this.value)
    }
  )

  const controlsTop = document.getElementById("controls-top")
  controlsTop.appendChild(xSelect)
  controlsTop.appendChild(ySelect)

  const tValues = scatter.state.dataset().distinct(defaults.T_FIELD)
  const tSlider = createSlider(`date-slider`, "Date:", tValues, defaults.T_VALUE,
    function(v) {
      scatter.state.tValue = tValues[v]
    }
  )

  const controlsBottom = document.getElementById("controls-bottom")
  controlsBottom.appendChild(tSlider)
})