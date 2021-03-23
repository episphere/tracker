import { DynamicState } from "./DynamicState.js"
import { filterOutliers, clamp, lightenRGB, getAngle, isNumber } from "../helper.js"

// TODO: Remove hard coded constants
export class ScatterPlot {
  constructor(id, xField, yField, sField, tField, state, {
      bubbleField = null,
      viewTraces = false,
      interactiveColor,
      trimStd = -1,
      proportionalResize = false,
      size = [480, 480],
      margin = {top: 20, right: 20, bottom: 20, left: 30}
    } = {}) {

    // TODO: Unhardcode stuff

    this.id = id
    this.state = state
    this.xField = xField
    this.yField = yField
    this.sField = sField
    this.tField = tField
    this.state = state
    this.bubbleField = bubbleField
    this.viewTraces = viewTraces
    this.size = size
    this.targetSize = size.map(d => d)
    this.margin = margin
    this.interactiveColor = interactiveColor
    this.trimStd = trimStd
    this.proportionalResize = proportionalResize
    this.nodes = {}
    this.tValues = state.dataset().distinct(this.tField)

    const element = d3.select(`#${id}`)
    
    const base = this.createBase() 

    this.updateAll()
    
    element.append(_ => base.node())
  }

  pointMouseOver(_, d) {
    this.state.focus = d[this.sField]
  }

  pointMouseLeave(_, d) {
    this.state.focus = null
  }

  pointMouseClick(e, d) {
    const sValue = d[this.sField]
    if (this.state.selected.has(sValue)) {
      this.state.selected.delete(sValue)
      this.state.selected = this.state.selected
    } else {
      this.state.selected = this.state.selected.add(sValue)
    }
    e.stopPropagation()
  }

  blankClick(_, d) {
    this.state.selected = new Set()
  }

  /**
   * Update the graph to reflect the current interactive state.
   */
  updateInteraction() {
    const state = this.state

    const selectedRows = state.dataset({[this.tField]: state.tValue}).get()
      .filter(d => state.selected.has(d[this.sField]) || state.focus == d[this.sField])

    this.updateLabels(selectedRows)

    this.nodes.points.selectAll(".point")
      //.attr("fill", (d, i) => this.interactiveColor(d, i))
      .attr("fill", (d, i) => this.interactiveColor(d, i))

    for (const row of selectedRows) {
      this.nodes.points.select(`#${state.id}-point-${row[this.sField]}`).raise()
    }
  }

  updateTraces() {
    const state = this.state 

    this.nodes.traces.selectAll("*").remove()

    if (!this.viewTraces) {
      return 
    }

    for (const selectedState of state.selected) {
      const tIndex = this.tValues.indexOf(state.tValue)

      const stateRows = []
      for (var i = Math.max(0, tIndex-4); i <= tIndex; i++) {
        const thisT = this.tValues[i]
        stateRows.push(state.dataset({[this.tField]: thisT, [this.sField]: selectedState}).first())
      }

      this.nodes.traces.append("path")
        .datum(stateRows)
        .attr("d", d => d3.line()(
          d.map(row => [this.scaleX(row[this.xField]), this.scaleY(row[this.yField])])))
        .attr("stroke", (d, i) => this.interactiveColor(d[d.length-1], i))
        .attr("fill", "none")

      const onionPoints = this.nodes.traces.append("g")

      onionPoints.selectAll("circle")
        .data(stateRows.slice(0,4))
        .join("circle")
          .attr("cx", d => this.scaleX(d[this.xField]))
          .attr("cy", d => this.scaleY(d[this.yField]))
          .attr("fill", (d, i) => lightenRGB(this.interactiveColor(d, i), (4-i)/5))
          .attr("r", 3)
    }
  }

  // TODO: Support labels of any length (formatting hard coded for 2 characters right now)
  updateLabels(selectedRows) {
    const state = this.state
    
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

    this.nodes.labels.selectAll("text")
      .data(selectedRows)
      .join("text")
        .attr("x", d => positionText(d, this.xField, this.scaleX, 3, [-17, 5]))
        .attr("y", d => positionText(d, this.yField, this.scaleY, 3, [-20, 5]))
        .text(d => d[this.sField])
  }

  

  /**
   * Update the plot's points.
   */
  updatePoints() {
    const state = this.state

    var rows = state.dataset({[this.tField]: state.tValue}).get()
    var rows = rows.filter(row => isNumber(row[this.xField]) && isNumber(row[this.yField]))
    console.log(rows)

    const scaleContains = (scale, d) => d >= scale.domain()[0] && d <= scale.domain()[1]
    
    const inPoints = []
    const outPoints = []

    for (const row of rows) {
      if (scaleContains(this.scaleX, row[this.xField]) && 
          scaleContains(this.scaleY, row[this.yField])) {
        inPoints.push(row) 
      } else {
        outPoints.push(row) 
      }
    }

    this.updateOutPoints(outPoints)

    this.nodes.inPoints.selectAll(".point")
      .data(inPoints)
      .join("circle")
        .attr("class", "point")
        .attr("id", d => `${state.id}-point-${d[this.sField]}`)
        .attr("cx", d => this.scaleX(d[this.xField]))
        .attr("cy", d => this.scaleY(d[this.yField]))
        .attr("r", d => this.bubbleField ? this.bubbleScale(d[this.bubbleField]) : 5)
        .attr("fill", (d,i) => this.interactiveColor(d,i))
        .on("mouseover", (_,d) => this.pointMouseOver(_,d))
        .on("mouseleave", (_, d) => this.pointMouseLeave(_,d))
        .on("click", (_, d) => this.pointMouseClick(_, d))


    this.updateInteraction()
    this.updateTraces() // TODO: Find a way to draw traces below SELECTED points
  }

  updateOutPoints(outPoints) {
    const state = this.state

    const triSize = 6
    const triPoints = [[triSize/2, triSize*1.5], [triSize, 0], [0, 0]]
    
    this.nodes.outPoints.selectAll("polygon")
      .data(outPoints)
      .join("polygon") 
        .attr("points", _ => triPoints)
        .attr("class", "point point-part")

    this.nodes.outPoints.selectAll("circle")
      .data(outPoints)
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
          [this.scaleX(d[this.xField]), 
            this.scaleY(d[this.yField])],
          [clamp(this.scaleX(d[this.xField]), this.scaleX.range()), 
            clamp(this.scaleY(d[this.yField]), this.scaleY.range())],
        ]
        const angle = getAngle([line[1][0] - line[0][0], line[1][1] - line[0][1]])
        return `translate(${line[1][0]}, ${line[1][1]}) rotate(${angle+90}) translate(${-triSize/2}, ${0})`
      })
  }

  /**
   * Update all mutable elements of the plot.
   */
  updateAll() {
    const state = this.state

    const xValues = filterOutliers(state.dataset().distinct(this.xField), this.trimStd)
    const yValues = filterOutliers(state.dataset().distinct(this.yField), this.trimStd)

    if (this.proportionalResize) {
      const xRange = d3.extent(xValues)
      const yRange = d3.extent(yValues)
      const xLength = xRange[1] - xRange[0]
      const yLength = yRange[1] - yRange[0]
      const proportion = yLength / xLength
      console.log(proportion, this.targetSize)
      if (proportion <= 1) {
        this.size[1] = this.targetSize[0] * proportion
        this.nodes.svg.attr("height", this.size[1])
        this.nodes.xAxis.attr("transform", `translate(0,${this.size[1] - this.margin.bottom})`)
      } 
      if (proportion >= 1) {
        this.size[0] = this.targetSize[1] / proportion
        this.nodes.svg.attr("width", this.size[0])
        this.nodes.yAxis.attr("transform", `translate(${this.margin.left}, 0)`)
      }
    }
    

    this.scaleX = d3.scaleLinear()
      .domain(d3.extent(xValues)) 
      .range([this.margin.left, this.size[0] - this.margin.right])
    this.scaleY =  d3.scaleLinear()
      .domain(d3.extent(yValues)) 
      .range([this.size[1] - this.margin.bottom, this.margin.top])

    this.nodes.xAxis.call(d3.axisBottom(this.scaleX)
      .ticks(this.size[0] / 80)
      .tickSizeOuter(0)
    )
    this.nodes.yAxis.call(d3.axisLeft(this.scaleY))

    this.updatePoints()
  }

  /**
   * Create the immutable elements of the plot, including the nodes which will contain mutable 
   * elements.
   */
  createBase() {
    const state = this.state

    var svg = d3.create("svg")
      .attr("id", `${this.id}-svg`)
      .attr("width", this.size[0])
      .attr("height", this.size[1])
      .on("click", (_, d) => this.blankClick(_, d))
    this.nodes.svg = svg

    this.nodes.xAxis = svg.append("g")
      .attr("id", `${this.id}-xAxis`)
      .attr("transform", `translate(0,${this.size[1] - this.margin.bottom})`)

    this.nodes.yAxis= svg.append("g")
      .attr("id", `${this.id}-yAxis`)
      .attr("transform", `translate(${this.margin.left},0)`)

    this.nodes.points = svg.append("g")
      .attr("id", `${this.id}-points`)

    this.nodes.inPoints = this.nodes.points.append("g")
      .attr("id", `${this.id}-points-in`)

    this.nodes.outPoints = this.nodes.points.append("g")
      .attr("id", `${this.id}-points-out`)
      .attr("pointer-events", "none")

    this.nodes.traces = svg.append("g")
      .attr("id", `${this.id}-traces`)

    this.nodes.labels = svg.append("g")
      .attr("id", `${this.id}-labels`)
      .attr("font-family", "monospace")
      .attr("font-size", 10)
      .attr("text-anchor", "left")
      .attr("fill", "black")
      .style("pointer-events", "none")

    return svg
  }

  getState() {
    return this.state
  }

  setColoring(coloring) {
    this.state.coloring = coloring
  }

  setInteractiveColor(interactiveColor) {
    this.interactiveColor = interactiveColor
  }

  setBubbleField(field) {
    const state = this.state
    this.bubbleField = field

    if (field) {
      this.bubbleScale = d3.scaleLinear()
        .domain(d3.extent(state.dataset().distinct(this.bubbleField)))
        .range([3, 15]) // TODO: Un-hardcode
    }

    this.updatePoints()
  }

  setXField(field) {
    this.xField = field
    this.updateAll()
  }

  setYField(field) {
    this.yField = field
    this.updateAll()
  }

  setViewTraces(value) {
    this.viewTraces = value
    this.updateTraces()
  }

  stateChange(property, value) {
    if (property == "focus") {
      this.nodes.points.select(`#${this.id}-point-${value}`).raise()
      this.updateInteraction()
    } else if (property == "selected" || property == "coloring") {
      this.updateInteraction()
      this.updateTraces()
    } else if (property == "tValue") {
      this.updatePoints()
    }
  }
}