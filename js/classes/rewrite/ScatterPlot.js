import { filterOutliers, clamp, lightenRGB, getAngle, isNumber } from "../../helper.js"

export class Scatter {
  constructor(element, data, state, tField, xField, yField, sField, opts = {}) {

    opts = {
      ...{
        tValue: null,
        bubbleField: null,
        viewTraces: true,
        labelsVisible: true,
        maxLabelLength: 16,
        unit: false,
        tTickFormat: v => v,
        yTickFormat: v => v,
        tParse: v => new Date(v),
        xTransform: v => v,
        yTransform: v => v,
        coloring: null,
        size: [360, 360], // TODO: Default to element size
      },
      ...opts
    }

    if (Object.hasOwnProperty("id")) {
      throw "Element must have an ID"
    }

    this.element = element 
    this.state = state
    this.tField = tField
    this.xField = xField
    this.yField = yField
    this.sField = sField
    Object.assign(this, opts)

    // Set special fields: _t (parsed time), _s (formatted stratify field)
    this.data = data.map(row => {
      row._t = this.tParse(row[this.tField])
      row._s = row[this.sField].replace(/[\W_]+/g,"_")
      return row
    }) 

    this.id = this.element.id
    this.tValues = [...d3.group(data, d => d._t).keys()]
    if (this.tValue == null) {
      this.tValue = this.tValues[0]
    }
    this.updateNowData()
    this.selectedRows = this.nowData
        .filter(d => state.selected.has(d._s) || state.focus == d._s)
    

    this.nodes = {}
    this.margin =  {top: 0, right: 0, bottom: 0, left: 0} 
    this.coloringMap = new Map()

    this.nodes.base = d3.create("svg")
      .attr("id", `${this.id}-base`)
      .attr("width", this.size[0])
      .attr("height", this.size[1])
      .on("click", (e, d) => this.blankClick(e, d))
    
    element.append(this.nodes.base.node())

    this.createBase()
    this.updateXAxis()
    this.updateYAxis()
    this.setColoring(this.coloring == null ? this.#getDefaultColoring() : this.coloring)
    this.updatePoints()
    this.updateTraces()
  }

  createBase() {

    this.nodes.xAxis = this.nodes.base.append("g")
      .attr("id", `${this.id}-xAxis`)

    this.nodes.yAxis = this.nodes.base.append("g")
      .attr("id", `${this.id}-yAxis`)

    this.margin = {
      left: this.#calculateLeftMargin(), 
      bottom: this.#calculateBottomMargin(),
      top: 10, // TODO: Make automatic
      right: 0
    }

    this.nodes.points = this.nodes.base.append("g")
      .attr("id", `${this.id}-points`)

    this.nodes.inPoints = this.nodes.points.append("g")
      .attr("id", `${this.id}-points-in`)

    this.nodes.outPoints = this.nodes.points.append("g")
      .attr("id", `${this.id}-points-out`)
      .attr("pointer-events", "none")

    this.nodes.labels = this.nodes.base.append("g")
      .attr("id", `${this.id}-labels`)
      .attr("class", `scatter-labels`)
      .attr("text-anchor", "left")
      //.attr("fill", "black")
      .style("pointer-events", "none")

    this.nodes.axisLabels = this.nodes.base.append("g")
      .attr("id", `${this.id}-axisLabels`)
      .style("pointer-events", "none")
      .style("font-family", "sans-serif")
      .style("font-weight", "bold")
      .style("font-size", "11px")

    this.nodes.xAxisLabel = this.nodes.axisLabels.append("text")
      .attr("id", `${this.id}-x-axisLabel`)
      .attr("dominant-baseline", "text-after-edge")
      .attr("text-anchor", "end")
      .attr("fill", "grey")
      .attr("x", this.size[0] - this.margin.right)
      .attr("y", this.size[1] - this.margin.bottom)
    this.nodes.yAxisLabel = this.nodes.axisLabels.append("text")
      .attr("id", `${this.id}-y-axisLabel`)
      .attr("dominant-baseline", "text-before-edge")
      .attr("fill", "grey")
      .attr("x", this.margin.left + 5)
      .attr("y", this.margin.top)

    this.nodes.traces = this.nodes.base.append("g")
      .attr("id", `${this.id}-traces`)
  }

  updateXAxis() {
    const xValues = [...d3.group(this.data, d => d._x).keys()]

    this.nodes.xAxis
      .attr("transform", `translate(0,${this.size[1] -  this.margin.bottom})`)

    this.scaleX = d3.scaleLinear()
      .domain(d3.extent(xValues)) 
      .range([this.margin.left, this.size[0] - this.margin.right])

    this.nodes.xAxis.call(d3.axisBottom(this.scaleX)
      .ticks(this.size[0] / 80)
      .tickSizeOuter(0)
    )

    const shortLabel = this.xField.length > this.maxLabelLength ?
      this.xField.slice(0, this.maxLabelLength) + "..." : this.xField
    const lableWithUnit = this.unit ? shortLabel + ` (${this.unit})` : shortLabel
    this.nodes.xAxisLabel.text(lableWithUnit)
  }

  updateYAxis() {
    const yValues = [...d3.group(this.data, d => d._y).keys()]

    this.nodes.yAxis
      .attr("transform", `translate(${this.margin.left},0)`)

    this.scaleY =  d3.scaleLinear()
      .domain(d3.extent(yValues)) 
      .range([this.size[1] - this.margin.bottom, this.margin.top])

    this.nodes.yAxis.call(d3.axisLeft(this.scaleY))

    const shortLabel = this.yField.length > this.maxLabelLength ?
      this.yField.slice(0, this.maxLabelLength) + "..." : this.yField
    const lableWithUnit = this.unit ? shortLabel + ` (${this.unit})` : shortLabel
    this.nodes.yAxisLabel.text(lableWithUnit)
  }

  updatePoints() {
    const scaleContains = (scale, d) => d >= scale.domain()[0] && d <= scale.domain()[1]

    this.inPoints = []
    this.outPoints = []

    this.selectedRows = this.nowData
      .filter(d => this.state.selected.has(d._s) || this.state.focus == d._s)

    for (const row of this.nowData) {
      if (scaleContains(this.scaleX, row._x) && 
          scaleContains(this.scaleY, row._y)) {
            this.inPoints.push(row) 
      } else {
        this.outPoints.push(row) 
      }
    }

    //this.updateOutPoints()

    this.nodes.inPoints.selectAll(".point")
      .data(this.inPoints)
      .join("circle")
        .attr("class", "point")
        .attr("id", d => `${this.id}-point-${d._s}`)
        .attr("cx", d => this.scaleX(d._x))
        .attr("cy", d => this.scaleY(d._y))
        //.attr("r", d => this.bubbleField ? this.bubbleScale(d[this.bubbleField]) : 5)
        //.attr("fill", (d,i) => this.interactiveColor(d,i))
        .attr("r", 3)
        .attr("fill", (d, i) => this.interactiveColor(d, i))
        .on("mouseover", (_,d) => this.pointMouseOver(_,d))
        .on("mouseleave", (_, d) => this.pointMouseLeave(_,d))
        .on("click", (_, d) => this.pointMouseClick(_, d))

    this.updateLabels()
    this.updateTraces()
  }

  updateOutPoints() {

    const triSize = 6
    const triPoints = [[triSize/2, triSize*1.5], [triSize, 0], [0, 0]]
    
    this.nodes.outPoints.selectAll("polygon")
      .data(this.outPoints)
      .join("polygon") 
        .attr("points", _ => triPoints)
        .attr("class", "point point-part")

    this.nodes.outPoints.selectAll("circle")
      .data(this.outPoints)
      .join("circle")
        .attr("pointer-events", "visibleFill")
        .on("mouseover", (e, d) => this.pointMouseOver(e, d))
        .on("mouseleave", (e, d) => this.pointMouseLeave(e, d))
        .on("click", (e, d) => this.pointMouseClick(e, d))
        .attr("class", "point-part")
        .attr("cx", triSize/2)
        .attr("cy", triSize/2)
        .attr("r", triSize*0.75)
        .attr("fill", "none")

    this.nodes.outPoints.selectAll(".point-part")
      .attr("transform", d => {
        const line = [
          [this.scaleX(d._x), 
            this.scaleY(d._y)],
          [clamp(this.scaleX(d._x), this.scaleX.range()), 
            clamp(this.scaleY(d._y), this.scaleY.range())],
        ]
        const angle = getAngle([line[1][0] - line[0][0], line[1][1] - line[0][1]])
        return `translate(${line[1][0]}, ${line[1][1]}) rotate(${angle+90}) translate(${-triSize/2}, ${0})`
      })
  }

  updateInteraction() {
    const state = this.state

    this.selectedRows = this.nowData
      .filter(d => state.selected.has(d._s) || state.focus == d._s)

    this.updateLabels()

    this.nodes.points.selectAll(".point")
      .attr("fill", (d, i) => this.interactiveColor(d, i))

    for (const row of this.selectedRows) {
      this.nodes.points.select(`#${state.id}-point-${row._s}`).raise()
    }
  }

  updateLabels() {
    const positionText = (d, field, scale, dOffset = 0, cOffset = [0, 0]) => {
      const value = scale(d[field])
      const cValue = clamp(value, scale.range())

      var offset = 0 
      if (cValue < value) {
        offset = cOffset[0]
      } else if (cValue > value) {
        offset = cOffset[1]
      } else {
        offset = (this.bubbleField ? this.bubbleScale(d[this.bubbleField])*0.75 : 4) + dOffset
      }

      return cValue + offset
    }

    const textRows = this.labelsVisible ?
      this.selectedRows : this.nowData.filter(d => this.state.focus == d._s)
    this.nodes.labels.selectAll("text")
      .data(textRows)
      .join("text")
        .attr("x", d => positionText(d, this.xField, this.scaleX, 3, [-17, 5]))
        .attr("y", d => positionText(d, this.yField, this.scaleY, 3, [-20, 5]))
        .text(d => d[this.sField])
  }

  updateTraces() {
    const state = this.state 

    this.nodes.traces.selectAll("*").remove()

    if (!this.viewTraces) {
      return 
    }

    for (const selectedState of state.selected) {
      const tIndex = this.tValues.indexOf(this.tValue)

      const stateRows = []
      for (var i = tIndex; i >= Math.max(0, tIndex-4); i--) {
        const tData = d3.group(this.data, d => d._t).get(this.tValues[i])
        const row = d3.group(tData, d => d._s).get(selectedState)[0]
        if (isNaN(row._x) || isNaN(row._y)) {
          break
        } 
        stateRows.push(row)
      }


      if (stateRows.length > 0) {
        this.nodes.traces.append("path")
        .datum(stateRows)
        .attr("d", d => d3.line()(
          d.map(row => [this.scaleX(row._x), this.scaleY(row._y)])))
        .attr("stroke", (d, i) => this.interactiveColor(d[d.length-1], i))
        .attr("fill", "none")

        const onionPoints = this.nodes.traces.append("g")

        onionPoints.selectAll("circle")
          .data(stateRows.slice(1,5))
          .join("circle")
            .attr("cx", d => this.scaleX(d._x))
            .attr("cy", d => this.scaleY(d._y))
            .attr("fill", (d, i) => lightenRGB(this.interactiveColor(d, i), (1/5) + i/5))
            .attr("r", 3)
      }
    }
  }

  updateNowData() {
    this.data.forEach(row => {
      row._x = this.xTransform(row[this.xField], row)
      row._y = this.yTransform(row[this.yField], row)
    })
    this.nowData = this.data.filter(d => d._t.toString() == this.tValue.toString()
      && !isNaN(d[this.xField]) && !isNaN(d[this.yField]))
  }


  stateChange(property, value) {
    if (property == "focus") {
      this.nodes.points.select(`#${this.id}-point-${value}`).raise()
      this.updateInteraction()
    } else if (property == "selected") {
      this.updateInteraction()
      this.updateTraces()
    }
  }


  interactiveColor(d, i) {
    const state = this.state

    if (d._s == state.focus ||
      state.selected.has(d._s) ||
      state.selected.size == 0 && state.focus == null) {
        return this.coloring.f(d, i)
    } else {
      return "rgb(240, 240, 240)"
    }
  }


  pointMouseOver(e, d) {
    this.state.focus = d._s
  }

  pointMouseLeave(e, d) {
    this.state.focus = null
  }

  pointMouseClick(e, d) {
    const sValue = d._s
    if (this.state.selected.has(sValue)) {
      this.state.selected.delete(sValue)
      this.state.selected = this.state.selected
    } else {
      this.state.selected = this.state.selected.add(sValue)
    }
    e.stopPropagation()
  }

  blankClick(e, d) {
    this.state.selected = new Set()
  }


  setColoring(coloring) {

    this.coloring = coloring
    if (this.coloringMap.has(coloring.id)) {
      // TODO: Implement
    } else {
      
    }

  }

  setBubbleField(field) {
    this.bubbleField = field

    if (field) {
      this.bubbleScale = d3.scaleLinear()
        .domain(d3.extent(this.data, d => d[this.bubbleField]))
        .range([3, 15]) // TODO: Un-hardcode
    }

    this.updatePoints()
  }

  setTValue(tValue) {
    this.tValue = tValue
    this.updateNowData()
    this.updatePoints()
    this.updateInteraction()
  }

  setXField(field) {
    this.xField = field
    this.updateNowData()
    this.updateXAxis()
    this.updatePoints()
  }

  setYField(field) {
    this.yField = field
    this.updateNowData()
    this.margin.left = this.#calculateLeftMargin()
    this.updateYAxis()
    this.updatePoints()
  }

  setLabelsVisible(visible) {
    this.labelsVisible = visible
    this.updateLabels()
  }

  setAxisLabelsVisible(visible) {
    this.nodes.axisLabels.attr("visibility", visible ? "visible" : "hidden")
  }


  #getDefaultColoring() {
    const sColorMap = new Map()
    const sValues = [...d3.group(this.data, d => d._s).keys()]
    
    const colorScale = d3.scaleSequential()
      .domain([0, sValues.length])
      .interpolator(d3.interpolateRainbow) 

    for (const [i, sValue] of sValues.entries()) {
      sColorMap.set(sValue, colorScale(i))
    }

    return {id: "default", name: "Default", f: function(d, i) {return sColorMap.get(d._s)}}
  }

  #calculateLeftMargin() {
    // TODO: Implement
    return 30
  }

  #calculateBottomMargin() {
    // TODO: Implement
    return 30
  }
}