import { Plot } from "/js/components/Plot.js"
import { Data } from "/js/components/Data.js"
import {lightenRGB} from "/js/helper.js"

// MAYBE: Generalize to line plot.
// TODO: Date format argument, need date formatting library
// TODO: Support generic filter
// TODO: Look into Voronoi
export class TimeSeriesPlot extends Plot {
  constructor(element, data, opts = {}) {
    super(element, opts, {
      tField: null,
      v1Field: null ,
      sField: null,
      sFields: null,
      coloring: null, 
      defaultColor: "steelblue",
      layerDuration: null,
      layerFrom: "start",
      visibleSValues: null,
      hoverRadius: 30,
      drawPoints: false,
      tTickFormat: d => d,
      yTickFormat: d => d, 
      margin: {left: 30, right: 30, bottom: 30, top: 30},
      width: 640,
      height: 480
    })

    this.data = data

    this.updateTValues(this.tField)
    
    this.filterSValues()

    // TODO: Temporary default of days, implement proper parsing and support other periods of time.
    this.layerDuration = parseInt(this.layerDuration.split(0, this.layerDuration.length-1))
      * 86400000

    this.projectTimes()
    this.stratify()

    this.seriesData = []
    for (const [key, value] of d3.group(data.data().get(), d => d._s)) {
      this.seriesData.push({key: key, rows: value})
    }

    this.coloring = this.inferColoring()

    this.state.defineProperty("tValue", this.tValues)
    this.state.defineProperty("selected", new Set())
    this.state.defineProperty("focus", new Set())

    this.nodes = {}

    this.createBase()
  }

  updateDelaunay() {
    this.delaunay = d3.Delaunay.from(this.data.data().get(), 
      d => this.scaleT(d._projT), d => this.scaleY(d[this.v1Field]))
  }

  updateTValues(field) {
    this.tValues = new Set() 
    const rows = this.data.data().get()
    for (const row of rows) {
      this.tValues.add(row[field].getTime())
    }
    this.tValues = [...this.tValues]
    // for (const row of rows) {
    //   row._tIndex = this.tValues.indexOf(row[field].getTime())
    // }
    this.tValues = this.tValues.sort().map(d => new Date(d))
  }

  projectTimes() {

    let range = []
    if (this.layerFrom == "end") {
      const latestDate = this.tValues[this.tValues.length-1]
      range = [latestDate - this.layerDuration, latestDate.getTime()]
      console.log(latestDate)

      for (const row of this.data.data().get()) {
        const t = row[this.tField].getTime()
        row._projT = new Date(range[1] - ( range[1] - t ) % (range[1] - range[0]))
        row._projI = - Math.floor((range[1] - t ) / (range[1] - range[0]))
      }
    } else {
      const firstDate = this.tValues[0]
      range = [firstDate.getTime(), firstDate.getTime() + this.layerDuration]
      console.log(range)

      for (const row of this.data.data().get()) {
        const t = row[this.tField].getTime()
        row._projT = new Date(range[0] + (t - range[0]) % (range[1] - range[0]))
        row._projI = Math.floor((t - range[0]) / (range[1] - range[0]))
      }
    }

    console.log(this.data.data().get())
    
    this.sFields.push("_projI")
    this.projRange = range

    this.updateTValues("_projT")
  }

  createBase() {

    this.nodes.base = d3.create("svg")
      .attr("id", "plot")
      .attr("width", this.width)
      .attr("height", this.height)
      .on("mousemove", e => this.mouseMoved(e))
      .on("mouseleave",  e => this.mouseLeft(e))
      .on("click",  e => this.mouseClicked(e))
    
    this.nodes.xAxis = this.nodes.base.append("g")
      .attr("id", "tAxis")

    this.nodes.yAxis = this.nodes.base.append("g")
      .attr("id", "yAxis")

    // TODO: Calculate margin 

    this.nodes.paths = this.nodes.base.append("g")
      .attr("id", "paths")
      .attr("fill", "none")
      .attr("stroke-width", 1.5)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")

    if (this.drawPoints) {
      this.nodes.points = this.nodes.base.append("g")
        .attr("id", "points")
    }
      
    this.nodes.dot = this.nodes.base.append("g")
      .attr("class", "ts-dot")
      .attr("visibility", "hidden")
      .style("pointer-events", "none")    
    this.nodes.dot.append("circle")
      .attr("r", 2.5)
    this.nodes.dot.append("text")
      .attr("y", -3)
      .attr("x", 3)

    // TODO: Colors
    // TODO: Labels
    // TODO: Axis labels
    // TODO: Now line

    this.updateYAxis() 
    this.updateTAxis()
    this.updateData()
    this.updateDelaunay()

    this.element.append(this.nodes.base.node())
  }

  updateYAxis() {
    this.scaleY = d3.scaleLinear()
      .domain(d3.extent(this.data.data().distinct(this.v1Field)))
      .range([this.height - this.margin.bottom, this.margin.top]) 
      .nice()
      
    this.nodes.yAxis
      .attr("transform", `translate(${this.margin.left},0)`)

    this.nodes.yAxis.call(d3.axisLeft(this.scaleY)
      .tickFormat(this.yTickFormat)) 

    // MAYBE: Re-add right side labels 

  }

  updateTAxis() {
    this.nodes.xAxis
      .attr("transform", `translate(0,${this.height -  this.margin.bottom})`)

    const tDomain = this.layerDuration != null ? this.projRange : d3.extent(this.tValues)

    this.scaleT = d3.scaleUtc()
      .domain(tDomain)
      .range([ this.margin.left, this.width -  this.margin.right])
      .nice()

    this.nodes.xAxis.call(d3.axisBottom(this.scaleT)
      .tickSizeOuter(0)
      .tickFormat(this.tTickFormat)
      .ticks(this.width / 120))
  }

  updateData() {
    const line = d3.line()
      .defined(d => !isNaN(d[this.v1Field]))
      .x(d => this.scaleT(d["_projT"]))
      .y(d => this.scaleY(d[this.v1Field]))

    this.nodes.paths.selectAll("path").remove()
    for (const series of this.seriesData.filter(d => d.rows.length > 0)) {

      const defRows = series.rows.filter(line.defined())
      if (defRows.length < 1) {
        continue
      }
      
      this.nodes.paths.append("path")
        .attr("id", `path-${this.s(series.key)}`)
        .datum({key: series.key, rows: defRows})
        .attr("d", d => line(d.rows))
        .attr("stroke-width", 0.8)
        .style("stroke-dasharray", ("3, 3"))
        .attr("stroke", (d, i) => this.interactiveColor(d.rows[0], i))


      this.nodes.paths.append("path")
        .attr("id", `path-${this.s(series.key)}`)
        .datum({key: series.key, rows: series.rows})
        //.style("mix-blend-mode", "multiply")
        .attr("d", d => line(d.rows))
        .attr("stroke", (d, i) => this.interactiveColor(d.rows[0], i))
    }

    if (this.drawPoints) {
      this.nodes.points.selectAll("circle")
        .data(this.data.data().get())
        .join("circle")
          .attr("r", 3)
          .attr("cx", d => this.scaleT(d._projT))
          .attr("cy", d => this.scaleY(d[this.v1Field]))
          .attr("fill", (d, i) => this.interactiveColor(d, i))
    }
  }


  inferColoring() {
    if (this.coloring != null) {
      return this.coloring
    } else if (this.sField != null) {
      return this.createUniqueColoring()
    } else {
      return {f: () => this.defaultColor}
    }
  }
  

  s(sValue) {
    return sValue.replace(/[\W_]+/g,"_")
  }
  
  
  stateChanged(property, value) {
    
  }


  // --- Event Listeners ---

  mouseMoved(e) {
    const pointer = [e.offsetX, e.offsetY]
    const row = this.data.data().get()[this.delaunay.find(...pointer)]
    const p = [this.scaleT(row._projT), this.scaleY(row[this.v1Field])]
    const d = Math.hypot(p[0] - pointer[0], p[1] - pointer[1])
    
    if (d < this.hoverRadius) {
      this.state.focus = row._s

      this.nodes.dot.select("text").text(row._s);
      this.nodes.dot.attr("transform", 
        `translate(${p[0]},${p[1]})`)
      this.nodes.dot.attr("visibility", "visible")
    } else {
      this.state.focus = null
      this.nodes.dot.attr("visibility", "hidden")
    }


    // const pointer = [e.offsetX, e.offsetY]
    // const xm = this.scaleT.invert(pointer[0])
    // const ym = this.scaleY.invert(pointer[1])

    // const i = d3.bisectCenter(this.tValues, xm)
    // console.log(xm, i)

    // const pointer = [e.offsetX, e.offsetY]
    // const xm = this.scaleT.invert(pointer[0])
    // const ym = this.scaleY.invert(pointer[1])

    // const i = d3.bisectCenter(this.tValues, xm)
    // console.log(this.tValues, this.seriesData, this.tValues[i])
    // const s = d3.least(this.seriesData, series => Math.abs(series.rows[i][this.v1Field] - ym))
    // const p = [this.scaleT(this.tValues[i]), this.scaleY(s[i][this.v1Field])]

    // if (Math.abs(p[1] - pointer[1]) < this.hoverProximity) {
    //   this.state.focus = s[i]._s
    //   this.nodes.dot.select("text").text(s[i]._s);
    //   this.nodes.dot.attr("transform", `translate(${p[0]},${p[1]})`)
    //   this.nodes.dot.attr("visibility", "visible")
    // } else {
    //   this.state.focus = null
    //   this.nodes.dot.attr("visibility", "hidden")
    // }
  }

  mouseLeft(e) {

  }

  mouseClicked(e) {

  }
}