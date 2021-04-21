import { Data } from "/js/components/Data.js"
import { Plot } from "/js/components/Plot.js"
import { TAFFY } from "/js/lib/taffydb/taffy-module.js"

// TODO: Move data handling into Data object

// TODO: Support TopoJSON format
export class MapPlot extends Plot {

  constructor(element, geoData, opts = {}) {
    super(element, opts, {
      data: null, 
      tField: null,
      v1Field: null,
      sField: null, 
      geoKeyProperty: null,
      showLabels: true, 
      projection: "Mercator",
      defaultColor: "steelblue",
      valueColorScheme: "Cividis",
      coloring: null,
      width: 640,
      height: null, 
    })

    if (this.data != null) {
      // MAYBE: Support raw data
    }
    this.geoData = geoData 
    this.nodes = {}

    this.state.defineProperty("tValue", this.data.distinct(this.tField)[0])
    this.state.defineProperty("selected", new Set())
    this.state.defineProperty("focus", new Set())

    this.coloring = this.inferColoring()
    this.geoKeyProperty = this.geoKeyProperty != null ? this.geoKeyProperty : this.sField

    // TODO: Verify geoData is in correct GeoJSON format (must be top level "FeatureCollection",
    // maybe use library to expand and generalise this)

    this.createBase()
  }

  inferColoring() {
    if (this.coloring != null) {
      return coloring
    } else if (this.v1Field != null) {
      return this.createValueColoring()
    } else {
      return {f: () => this.baseColor}
    }
  }

  createValueColoring() {
    const colorScale = d3.scaleSequential()
      .domain(d3.extent(this.data.distinct(this.v1Field)))
      .interpolator(d3[`interpolate${this.valueColorScheme}`])

    return {f: (d) => colorScale(d[this.v1Field]) }
  }

  createBase() {

    const path = d3.geoPath()
    const projection = d3["geo" + this.projection]()
    if (this.width == null) {
      path.projection(projection.fitHeight(this.height, this.geoData))
      const bounds = path.bounds(this.geoData)
      this.width = bounds[1][0] - bounds[0][0]
    } else if (this.height == null) {
      path.projection(projection.fitWidth(this.width, this.geoData))
      const bounds = path.bounds(this.geoData)
      this.height = bounds[1][1] - bounds[0][1]
    } else if (this.width != null && this.height != null) {
      path.projection(projection.fitSize([this.width, this.height]))
    } else {
      throw "MapPlot width or height must be defined"
    }

    this.nodes.base = d3.create("svg")
      .attr("width", this.width)
      .attr("height", this.height)

    const combinedData = []
    for (const geoRow of this.geoData.features) {
      const combinedRow = {}
      combinedRow.data = this.data.queryOne(
        {[this.tField]: this.state.tValue, [this.sField]: geoRow.properties[this.geoKeyProperty]})
      combinedRow.geo = geoRow
      combinedData.push(combinedRow)
    }

    this.nodes.paths = this.nodes.base.append("g")
      .attr("id", "geo")
      
    this.nodes.paths.selectAll("path")
      .data(combinedData)
      .join("path")
        .attr("d", d => path(d.geo))
        .attr("fill", (d, i) => this.coloring.f(d.data, i))
        .attr("stroke", "white")
        .on("click", (e, d) => this.areaClick(e, d))
        .on("mouseleave", (e, d) => this.areaLeave(e, d))
        .on("mouseover", (e, d) => this.areaOver(e, d))
      

    this.element.append(this.nodes.base.node())
  }

  updateInteraction() {
    // this.nodes.paths.selectAll("path")
    //   .attr("fill", (d, i) => this.interactiveColor(d.data, i))
    this.nodes.paths.selectAll("path")
      .attr("stroke-width", (d, i, node) => {
        const focused = this.checkFocused(d.data, i, false)
        if (focused) {
          d3.select(node[i]).raise()
        }
        return focused ? 3 : 1
      })
      .attr("stroke", (d, i) => {
        return this.checkFocused(d.data, i, false) ? "pink" : "white"
      })
  }

  stateChanged(property, value) {
    super.stateChanged(property, value)
    this.updateInteraction()
  }

  // --- Event listeners ---

  areaClick(_, d) {
    this.state.selected = this.state.selected.add(d.data[this.sField])
  }

  areaOver(_, d) {
    this.state.focus = new Set([d.data[this.sField]])
  }

  areaLeave(_, d) {
    this.state.focus = new Set()
  }
}