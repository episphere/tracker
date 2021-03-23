// TODO: Only works when x is a valid date string, generalise!
// TODO: Speed up date/string conversion using map cache
// TODO: Fix bug where selection doesn't occur between points
// TODO: Speedup by only changing necessary colors on highlight
// TODO: Fix gradient issue
// TODO: Add color key to plot
// TODO: Auto margin based off label size
export class TimeSeries {
  constructor(id, yField, sField, tField, state, {
    coloringMap = new Map(),
    interactiveColor,
    hoverProximity = 30,
    drawNowLine = false,
    xTickFormat = v => v,
    yTickFormat = v => v,
    size = [480, 480],
    margin = {top: 20, right: 20, bottom: 20, left: 30},
  } = {}) {
    
    this.id = id
    this.state = state
    this.yField = yField
    this.sField = sField
    this.tField = tField
    this.state = state
    this.coloringMap = coloringMap
    this.size = size
    this.margin = margin
    this.interactiveColor = interactiveColor
    this.hoverProximity = hoverProximity
    this.drawNowLine = drawNowLine
    this.xTickFormat = xTickFormat
    this.yTickFormat = yTickFormat
    this.nodes = {}
    this.tValues = state.dataset().distinct(this.tField).map(d => new Date(d))
    this.seriesData = state.dataset().distinct(sField).map(d => state.dataset({[sField]: d}).get())
    
    // TODO: Better handling of incomplete lines
    // const remove = []
    // for (const series of this.seriesData) {
    //   for (const row of series) {
    //     if 
    //   }
    // }
    
    this.seriesData.forEach(series => series.forEach(row => row._t = new Date(row[tField])))

    const element = d3.select(`#${id}`)
    const base = this.createBase() 
    element.append(_ => base.node())
  }

  updateInteraction() {
    const state = this.state

    this.nodes.paths.selectAll("path")
      .attr("stroke", (d, i) => this.interactiveColor(d[0], i))
  }

  updateLabels() {
    const state = this.state

    const showText = this.seriesData.filter(s => state.selected.has(s[0][this.sField]))

    this.nodes.labels
      .selectAll("text")
      .data(showText)
      .join("text")
        .attr("x", this.size[0] - this.margin.right + 3)
        .attr("y", d => this.scaleY(d[d.length-1][this.yField]) + 3)
        .text(d => d[0][this.sField])
  }

  updatePlot() {
    const state = this.state

    this.scaleY = d3.scaleLinear()
      .domain(d3.extent(state.dataset().distinct(this.yField))).nice()
      .range([this.size[1] - this.margin.bottom, this.margin.top])  

    this.nodes.yAxis.call(d3.axisLeft(this.scaleY)
      .tickFormat(this.yTickFormat)) //d3.format(".3f")(d * 100))) // TODO: Make argument

    const line = d3.line()
      .x(d => this.scaleX(d._t))
      .y(d => this.scaleY(d[this.yField]))

    this.nodes.paths.selectAll("path")
      .data(this.seriesData)
      .join("path")
        .style("mix-blend-mode", "multiply")
        .attr('d', line)
        .attr("stroke", (d, i) => this.interactiveColor(d[0], i)) 

    if (this.drawNowLine) {
      this.nodes.nowLine
        .attr("x1", this.scaleX(new Date(state.tValue))-10)
        .attr("x2", this.scaleX(new Date(state.tValue))-10)
        .attr("y1", this.margin.top)
        .attr("y2", this.size[1] - this.margin.bottom)
    }

    this.updateInteraction()
  }

  createBase() {
    const state = this.state

    var svg = d3.create("svg")
      .attr("id", `${this.id}-svg`)
      .attr("width", this.size[0])
      .attr("height", this.size[1])
      .on("mousemove", e => this.mouseMoved(e))
      .on("mouseleave",  e => this.mouseLeft(e))
      .on("click",  e => this.mouseClicked(e))

    this.scaleX = d3.scaleUtc()
      .domain(d3.extent(this.tValues))
      .range([this.margin.left, this.size[0] - this.margin.right])

    for (const [i, coloring] of [...this.coloringMap.values()].entries()) {
      for (const [j, series] of this.seriesData.entries()) {
        svg.append("linearGradient")
          .attr("id", `coloring-${coloring.id}-${series[0][this.sField].replace(/[\W_]+/g,"_")}`)
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", 0)
          .attr("x2", this.size[0])
          .selectAll("stop")
            .data(series)
            .join("stop")
              .attr("offset", d => this.scaleX(d._t) / this.size[0])
              .attr("stop-color", coloring.f)
      }
    }

    this.nodes.xAxis = svg.append("g")
      .attr("id", `${this.id}-xAxis`)
      .attr("transform", `translate(0,${this.size[1] - this.margin.bottom})`)

    this.nodes.xAxis.call(d3.axisBottom(this.scaleX)
      //.ticks(SIZE[0] / 80)
      .tickSizeOuter(0)
      .tickFormat(this.xTickFormat))

    this.nodes.yAxis = svg.append("g")
      .attr("id", `${this.id}-yAxis`)
      .attr("transform", `translate(${this.margin.left},0)`)

    this.nodes.paths = svg.append("g")
      .attr("id", `${this.id}-paths`)
      .attr("fill", "none")
      .attr("stroke-width", 1.3)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")

    this.nodes.dot = svg.append("g")
      .attr("visibility", "hidden")
      .style("pointer-events", "none")
    this.nodes.dot.append("circle")
      .attr("r", 2.5)
    this.nodes.dot.append("text")
      .attr("font-family", "monospace")
      .attr("font-size", 10)
      .attr("text-anchor", "middle")
      .attr("y", -8)

    this.nodes.nowLine = svg.append("line")
      .attr("stroke", "grey")
      .style("stroke-dasharray", ("3, 3"))

    this.nodes.labels = svg.append("g")
      .attr("id", `${this.id}-labels`)
      .style("pointer-events", "none")
      .attr("font-family", "monospace")
      .attr("font-size", 10)
      .attr("text-anchor", "left")
      .attr("fill", "black")

    this.updatePlot()
    return svg
  }

  mouseMoved(e) {
    e.preventDefault()
    const state = this.state

    const pointer = d3.pointer(e, this.nodes.svg)
    const xm = this.scaleX.invert(pointer[0])
    const ym = this.scaleY.invert(pointer[1])

    const i = d3.bisectCenter(this.tValues, xm)
    const s = d3.least(this.seriesData, series => Math.abs(series[i][this.yField] - ym)) 
    const p = [this.scaleX(this.tValues[i]), this.scaleY(s[i][this.yField])]

    if (Math.abs(p[1] - pointer[1]) < this.hoverProximity) {
      state.focus = s[i][this.sField]
      this.nodes.dot.attr("transform", `translate(${p[0]},${p[1]})`);
      this.nodes.dot.select("text").text(s[i][this.sField]);
      this.nodes.dot.attr("visibility", "visible")
    } else {
      state.focus = null
      this.nodes.dot.attr("visibility", "hidden")
    }
  }

  mouseLeft(e) {
    const state  = this.state
    state.focus = null
    this.nodes.dot.attr("visibility", "hidden")
    this.updateInteraction()
  }

  mouseClicked(e) {
    const state = this.state
    if (state.focus) {
      if (this.state.selected.has(state.focus)) {
        this.state.selected.delete(state.focus)
        this.state.selected = this.state.selected
      } else {
        this.state.selected = this.state.selected.add(state.focus)
      }
    } else {
      state.selected = new Set()
    }
    this.updateInteraction()
  }

  setYField(yField) {
    this.yField = yField
    this.updatePlot()
  }

  stateChange(property, value) {
    if (property == "focus" || property == "tValue"  || property == "coloring") {
      this.updateInteraction()
    } else if (property = "selected") {
      this.updateLabels()
    }
  }
}