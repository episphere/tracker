
// NOTE: Doesn't support lines with points at different times 
export class TimeSeries {
  constructor(element, data, state, tField, yField, sField, opts = {}) {

    opts = {
      ...{
        drawNowLine: false,
        hoverProximity: 20,
        maxLabelLength: 16,
        unit: null,
        transform: null,
        tTickFormat: v => v,
        yTickFormat: v => v,
        tParse: v => new Date(v),
        fieldMap: null,
        coloring: null,
        size: [720, 360], // TODO: Default to element size
      },
      ...opts,
    }

    if (Object.hasOwnProperty("id")) {
      throw "Element must have an ID"
    }

    this.element = element 
    this.state = state
    this.tField = tField
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
    this.tValue = this.tValues[0] // TODO: Configure
    this.seriesData = [...d3.group(data, d => d[this.sField]).values()]
    
    this.nodes = {}
    this.margin =  {top: 0, right: 0, bottom: 0, left: 0} 
    this.coloringMap = new Map()


    this.nodes.base = d3.create("svg")
      .attr("id", `${this.id}-base`)
      .attr("width", this.size[0])
      .attr("height", this.size[1])
      .on("mousemove", e => this.mouseMoved(e))
      .on("mouseleave",  e => this.mouseLeft(e))
      .on("click",  e => this.mouseClicked(e))
    
    element.append(this.nodes.base.node())

    this.createBase()
    this.updateYAxis()
    this.updateXAxis()
    this.setColoring(this.coloring == null ? this.#getDefaultColoring() : this.coloring)
    this.updateData()
    this.updateNowLine()
    this.setTransform(this.transform)

  }

  updateData() {

    const line = d3.line()
      .defined(d => !isNaN(d[this.yField]))
      .x(d => this.scaleX(d._t))
      .y(d => this.scaleY(d[this.yField]))

    // TODO: Add dashes to undefined segments of line

    // this.nodes.paths.selectAll("path")
    //   .data(this.seriesData)
    //   .join("path")
    //     .style("mix-blend-mode", "multiply")
    //     .attr("d", line)
    //     .attr("stroke", (d, i) => this.interactiveColor(d, i))

    this.nodes.paths.selectAll("path").remove()
    for (const series of this.seriesData) {
  
      this.nodes.paths.append("path")
        .attr("id", `${this.id}-path-${series[0]._s}`)
        .datum(series.filter(line.defined()))
        //.style("mix-blend-mode", "multiply")
        .attr("d", line)
        .attr("stroke-width", 0.8)
        .style("stroke-dasharray", ("3, 3"))
        .attr("stroke", (d, i) => this.interactiveColor(d, i))
        

      this.nodes.paths.append("path")
        .attr("id", `${this.id}-path-${series[0]._s}`)
        .datum(series)
        //.style("mix-blend-mode", "multiply")
        .attr("d", line)
        .attr("stroke", (d, i) => this.interactiveColor(d, i))
    }
  }

  updateInteraction() {
    for (const selectedState of this.state.selected) {
      this.nodes.paths.select(`#${this.id}-path-${selectedState}`).raise()
    }
    this.nodes.paths.selectAll("path")
      .attr("stroke", (d, i) =>  this.interactiveColor(d, i))
  }

  updateLabels() {
    // TODO: Label outlines, bring to top on hover 

    const state = this.state

    const showText = this.seriesData.filter(s => state.selected.has(s[0]._s))

    const textPositions = this.seriesData.filter(s => state.selected.has(s[0]._s)).map(s => {
      var x = -1
      var y = -1
      for (var i = s.length-1; i >= 0; i--) {
        if (!isNaN(s[i][this.yField])) {
          x = this.scaleX(s[i]._t) + 3
          y = this.scaleY(s[i][this.yField])
          break
        }
      }
      return {text: s[0][this.sField], x: x, y: y}
    })

    this.nodes.labels
      .selectAll("text")
      .data(textPositions)
      .join("text")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .text(d => d.text)
  }

  updateYAxis() {

    this.scaleY = d3.scaleLinear()
      .domain(d3.extent([...d3.group(this.data, d => d[this.yField]).keys()]))
      .range([this.size[1] - this.margin.bottom, this.margin.top]) 
      .nice()
      
    this.nodes.yAxis
      .attr("transform", `translate(${this.margin.left},0)`)

    this.nodes.yAxis.call(d3.axisLeft(this.scaleY)
      .tickFormat(this.yTickFormat)) 

    const label = this.fieldMap != null ? this.fieldMap.get(this.yField) : this.yField
    const shortLabel = label.length > this.maxLabelLength ?
      label.slice(0, this.maxLabelLength) + "..." : label
    const lableWithUnit = this.unit ? shortLabel + ` (${this.unit})` : shortLabel
    this.nodes.yAxisLabel.text(lableWithUnit)
      .attr("x", this.margin.left + 5)
      .attr("y", this.margin.top)
  }

  updateXAxis() {

    this.nodes.xAxis
      .attr("transform", `translate(0,${this.size[1] -  this.margin.bottom})`)

    this.scaleX = d3.scaleUtc()
      .domain(d3.extent(this.tValues))
      .range([ this.margin.left, this.size[0] -  this.margin.right])
      .nice()

    this.nodes.xAxis.call(d3.axisBottom(this.scaleX)
      .tickSizeOuter(0)
      .tickFormat(this.tTickFormat)
      .ticks(this.size[0] / 120))

  }

  updateNowLine() {
    if (this.drawNowLine) {
      this.nodes.nowLine
        .attr("x1", this.scaleX(this.tValue))
        .attr("x2", this.scaleX(this.tValue))
        .attr("y1", this.margin.top)
        .attr("y2", this.size[1] - this.margin.bottom)
    }
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
      right: this.#calculateRightMargin()
    }

    this.nodes.paths = this.nodes.base.append("g")
      .attr("id", `${this.id}-paths`)
      .attr("fill", "none")
      .attr("stroke-width", 1.3)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")

    this.nodes.colors = this.nodes.base.append("g")
      .attr("id", `${this.id}-colors`)

    this.nodes.dot = this.nodes.base.append("g")
      .attr("class", "ts-dot")
      .attr("visibility", "hidden")
      .style("pointer-events", "none")    
    this.nodes.dot.append("circle")
      .attr("r", 2.5)
    this.nodes.dot.append("text")
      .attr("y", -3)
      .attr("x", 3)

    this.nodes.tooltip = d3.select(this.element).append("div")
      .style("opacity", 0)
      .attr("class", "tooltip")
      .style("background-color", "rgba(255, 255, 255, .7)")
      .style("border", "solid")
      .style("border-width", "1px")
      .style("border-radius", "2px")
      .style("padding", "5px")
      .style("position", "absolute")
      .style("font-size", ".6em")

    this.nodes.labels = this.nodes.base.append("g")
      .attr("id", `${this.id}-labels`)
      .attr("class", "ts-labels")
      .style("pointer-events", "none")
      .attr("text-anchor", "left")
      .attr("dominant-baseline", "middle")

    this.nodes.axisLabels = this.nodes.base.append("g")
      .attr("id", `${this.id}-axisLabels`)
      .style("pointer-events", "none")
      .style("font-family", "sans-serif")
      .style("font-weight", "bold")
      .style("font-size", "11px")
      .attr("fill", "grey")

    this.nodes.yAxisLabel = this.nodes.axisLabels.append("text")

    this.nodes.nowLine = this.nodes.base.append("line")
      .attr("stroke", "grey")
      .style("stroke-dasharray", ("3, 3"))
  }


  interactiveColor(d, i) {
    const state = this.state
    if (d.length < 1) {
      return "none"
    }

    if (d[0]._s == state.focus ||
      state.selected.has(d[0]._s) ||
      state.selected.size == 0 && state.focus == null) {
        return `url(#color-${this.coloring.id}-${d[0]._s})`
    } else {
      return "rgb(240, 240, 240)"
    }
  }


  mouseMoved(e) {
    e.preventDefault()

    // TODO: Better line proximity detector
    
    // TODO: Why does d3.pointer now give an offset relative to the HTML body margin (?)
    //const pointer = d3.pointer(e, this.nodes.base)
   
    const pointer = [e.offsetX, e.offsetY]
    const xm = this.scaleX.invert(pointer[0])
    const ym = this.scaleY.invert(pointer[1])

    const i = d3.bisectCenter(this.tValues, xm)
    const s = d3.least(this.seriesData, series => Math.abs(series[i][this.yField] - ym))
    const p = [this.scaleX(this.tValues[i]), this.scaleY(s[i][this.yField])]

    if (Math.abs(p[1] - pointer[1]) < this.hoverProximity) {
      this.state.focus = s[i]._s
      // this.nodes.dot.select("text").text(s[i][this.sField]);
      this.nodes.dot.attr("transform", `translate(${p[0]},${p[1]})`)
      this.nodes.dot.attr("visibility", "visible")

      this.nodes.tooltip.style("opacity", 1)
      this.nodes.tooltip.html(s[i][this.sField] + ": " + s[i][this.yField])
      this.nodes.tooltip.style("left", `${p[0] + 10}px`)
      this.nodes.tooltip.style("top", `${p[1] - 10}px`)
      //this.nodes.tooltip.style("border-color", this.coloring.f(s[i]))
      this.nodes.tooltip.style("border-color", "grey") 
    } else {
      this.state.focus = null
      this.nodes.dot.attr("visibility", "hidden")
      this.nodes.tooltip.style("opacity", 0)
    }
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
  }

  mouseLeft(e) {
    this.state.focus = null
    this.updateInteraction()
    this.nodes.dot.attr("visibility", "hidden")
    this.nodes.tooltip.style("opacity", 0)
  }


  setColoring(coloring) {

    this.coloring = coloring
    if (this.coloringMap.has(coloring.id)) {
      // TODO: Implement
    } else {
      for (const series of this.seriesData) {
        this.nodes.colors.append("linearGradient")
          .attr("id", `color-${coloring.id}-${series[0]._s}`)
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", 0)
          .attr("x2", this.size[0])
          .selectAll("stop")
            .data(series)
            .join("stop")
              .attr("offset", d => this.scaleX(d._t) / this.size[0])
              .attr("stop-color", coloring.f)
      }

      this.coloringMap.set(coloring.id, coloring)
    }

  }

  setYField(yField) {
    this.yField = yField
    this.margin.left = this.#calculateLeftMargin()
    this.updateYAxis()
    this.updateXAxis()
    this.updateNowLine()
    this.updateLabels()
    this.updateData()
  }

  setTValue(tValue) {
    this.tValue = tValue
    this.updateNowLine()
  }

  setLabelsVisible(visible) {
    this.nodes.labels.attr("visibility", visible ? "visible" : "hidden")
  }

  setAxisLabelsVisible(visible) {
    this.nodes.axisLabels.attr("visibility", visible ? "visible" : "hidden")
  }

  setTransform(transform) {
    this.transform = transform 
    this.setYField(this.yField.split("#")[0] + (transform != null ? "#" + transform.id : ""))
  }


  stateChange(property, value) {
    if (property == "focus" || property == "tValue") {
      this.nodes.paths.select(`#${this.id}-path-${value}`).raise()
      this.updateInteraction()
    } else if (property = "selected") {
      this.updateInteraction()
      this.updateLabels()
    }
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

  #calculateRightMargin() {
    const tmpLabels = this.nodes.base.append("g")
      .attr("class", "ts-labels")
    const labels = [...d3.group(this.data, d => d[this.sField]).keys()]
    tmpLabels.selectAll("text")
      .data(labels)
      .join("text")
        .attr("x", 0)
        .attr("y", 0)
        .text(d => d)

    const width = tmpLabels.node().getBBox().width
    tmpLabels.remove()
    return width + 3
  }

  #calculateLeftMargin() {
    const scaleY = d3.scaleLinear()
      .domain(d3.extent([...d3.group(this.data, d => d[this.yField]).keys()]))
      .range([this.size[1], 0])  

    this.nodes.yAxis.call(d3.axisLeft(scaleY)
      .tickSizeOuter(0)
      .tickFormat(this.yTickFormat))

    return this.nodes.yAxis.node().getBBox().width + 5
  }

  #calculateBottomMargin() {
    const scaleX = d3.scaleUtc()
      .domain(d3.extent(this.tValues))
      .range([0, this.size[0]])
      .nice()

    this.nodes.xAxis.call(d3.axisBottom(scaleX)
      .tickSizeOuter(0)
      .tickFormat(this.xTickFormat))

    return this.nodes.xAxis.node().getBBox().height
  }
}