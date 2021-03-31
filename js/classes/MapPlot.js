export class MapPlot {

  constructor(element, geoData, state, opts = {}) {

    opts = {
      ... {
        size: [360, 220],
        coloring: null
      },
      ...opts 
    }

    if (Object.hasOwnProperty("id")) {
      throw "Element must have an ID"
    }

    this.element = element
    this.geoData = geoData.map(row => {
      row._s = row.name.replace(/[\W_]+/g,"_")
      return row
    })
    this.state = state
    Object.assign(this, opts)

    this.id = element.id

    this.nodes = {}
    this.coloringMap = new Map()

    this.areaCenterMap = new Map()
    for (const area of this.geoData) {
      const points = d3.merge(area.polygons).filter(d => !isNaN(d[0]) && !isNaN(d[1]))
      this.areaCenterMap.set(area._s, d3.polygonCentroid(points))
    }

    this.setColoring(this.coloring == null ? this.getDefaultColoring() : this.coloring)

    this.createBase()

    element.append(this.nodes.base.node())
  }

  createBase() {
    const flat = d3.merge(this.geoData.map(row => d3.merge(row.polygons.map(polygon => polygon))))
    const xExtent = d3.extent(flat, d => d[0])
    this.scaleFactor = this.size[0]  / (xExtent[1] - xExtent[0])

    this.nodes.base = d3.create("svg")
      .attr("id", `${this.id}-base`)
      .attr("width", this.size[0])
      .attr("height", this.size[1])
  
    const line = d3.line()
      .defined(d => !isNaN(d[0]) && !isNaN(d[1]))
      .x(d => d[0]*this.scaleFactor)
      .y(d => d[1]*this.scaleFactor)

    for (const row of this.geoData) {
      const area = this.nodes.base.append("g")
        .datum(row)
        .on("mouseover", (e, d) => this.state.focus = d._s)
        .on("mouseleave", (_, d) => this.state.focus = null)
        .on("click", (_, d) => this.state.selected = this.state.selected.add(d._s))
      
      for (const polygon of row.polygons) {
        area.append("path")
          .datum(row)
          .attr("d", line(polygon))
          .attr("fill", (d, i) => this.interactiveColor(d, i))
          .attr("stroke", "white")
      }
    }

    this.nodes.labels = this.nodes.base.append("g")
      .attr("id", `${this.id}-labels`)
      .attr("class", `scatter-labels`)
      //.attr("text-anchor", "left")
      .style("pointer-events", "none")
  }

  updateInteraction() {
    this.selectedAreas = this.geoData
      .filter(d => this.state.selected.has(d._s) || this.state.focus == d._s)

    this.nodes.base.selectAll("path")
      .attr("fill", (d, i) => this.interactiveColor(d, i))


    this.nodes.labels.selectAll("text")
      .data(this.selectedAreas)
      .join("text")
        .attr("x", d => this.areaCenterMap.get(d._s)[0]*this.scaleFactor)
        .attr("y", d => this.areaCenterMap.get(d._s)[1]*this.scaleFactor)
        .text(d => d.name)
  }


  interactiveColor(d, i) {
    if (d._s == this.state.focus ||
      this.state.selected.has(d._s) ||
      this.state.selected.size == 0 && this.state.focus == null) {
        return this.coloring.f(d, i)
    } else {
      return "rgb(240, 240, 240)"
    }
  }


  setColoring(coloring) {
    this.coloring = coloring
    if (this.coloringMap.has(coloring.id)) {
      // TODO: Implement
    } else {
      
    }
  }

  stateChange(property, value) {
    if (property == "focus") {
      this.updateInteraction()
    } else if (property == "selected") {
      this.updateInteraction()
    }
  }


  getScaleColoring() {
    
  }

  getDefaultColoring() {
    const sColorMap = new Map()
    const sValues = this.geoData.map(row => row._s)
    
    const colorScale = d3.scaleSequential()
      .domain([0, sValues.length])
      .interpolator(d3.interpolateRainbow) 

    for (const [i, sValue] of sValues.entries()) {
      sColorMap.set(sValue, colorScale(i))
    }

    return {id: "default", name: "Default", f: function(d, i) {return sColorMap.get(d._s)}}
  }
}