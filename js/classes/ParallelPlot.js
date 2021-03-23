// TODO: Focused and selected labels
// TODO: Self interactivity
export class ParallelPlot {
  constructor(id, sField, tField, fields, state, {
    interactiveColor = (d, i) => state.coloring(d, i),
    size = [480, 480],
    margin = {top: 20, right: 20, bottom: 20, left: 30}
  } = {}) {

    this.id = id
    this.sField = sField
    this.tField = tField 
    this.state = state
    this.fields = fields
    this.size = size
    this.margin = margin
    this.interactiveColor = interactiveColor
    this.nodes = {}
    this.yScale = d3.scalePoint(fields, [margin.top, size[1] - margin.bottom])

    const base = this.createBase()
    this.updateAll()

    const element = d3.select(`#${id}`)
    element.append(_ => base.node())
  }

  updateInteraction() {
    const state =  this.state
    
    this.nodes.lines.selectAll("path")
      .attr("stroke", (d, i) => this.interactiveColor(d, i))

    this.nodes.lines.selectAll("path")
      .filter(d => state.selected.has(d[this.sField]) || state.focus == d[this.sField])
      .raise()

    this.nodes.axes.raise()
  }

  updateLabels() {
    const state = this.state

    const showText = this.rows.filter(row => state.selected.has(row[this.sField]))

    const lastField = this.fields[this.fields.length-1]
    const lastFieldScale = this.xScales.get(this.fields[this.fields.length-1])

    this.nodes.labels
      .selectAll("text")
      .data(showText)
      .join("text")
        .attr("x", d => lastFieldScale(d[lastField]) - 7)
        .attr("y", this.size[1] - this.margin.bottom + 10)
        .text(d => d[this.sField])
  }

  updateAll() {
    const state = this.state
    
    const rows = state.dataset({[this.tField]: state.tValue}).get()
    this.rows = rows

    const xScales = new Map()
    for (const field of this.fields) {
      const scale = d3.scaleLinear(
        d3.extent(rows, d => d[field]),
        [this.margin.left, this.size[0] - this.margin.right]
      )
      xScales.set(field, scale)
    }
    this.xScales = xScales

    const axes = this.nodes.axes
    axes.selectAll(".pcp-axis").remove()
    for (const field of this.fields) {
      const axis = g => g
        .call(d3.axisBottom(xScales.get(field))
          .ticks(this.size[0] / 80)
          .tickSizeOuter(0))
          //.tickFormat(plot.pcpTickFormat))

      axes.append("g")
        .attr("transform", _ => `translate(0,${this.yScale(field)})`)
        .attr("class", "pcp-axis")
        .call(axis)
    }

    const line = d3.line()
      .defined(([, value]) => value != null)
      .x(([key, value]) => this.xScales.get(key)(value))
      .y(([key]) => this.yScale(key))

    this.nodes.lines.selectAll("path")
      .data(this.rows)
      .join("path")
        .attr("d", d => line(d3.cross(this.fields, [d], (key, d) => [key, d[key]])))

    this.updateInteraction()
    this.updateLabels()
  }

  createBase() {
    const state = this.state

    this.nodes.svg = d3.create("svg")
      .attr("id", `${this.id}-svg`)
      .attr("width", this.size[0])
      .attr("height", this.size[1])

    const fields = [...defaults.Y_FIELD_MAP.values()]
    state.fields = fields

    this.yScale = d3.scalePoint(fields, [this.margin.top, this.size[1] - this.margin.bottom])

    this.nodes.lines = this.nodes.svg.append("g")
      .attr("fill", "none")
      .attr("stroke-width", 1.8)
      .attr("stroke-opacity", 0.5)
    
    this.nodes.axes = this.nodes.svg.append("g")
      .attr("id", `${this.id}-axes`)
    
    this.nodes.axes.selectAll("g")
      .data(fields)
      .join("g")
        .call(g => g.append("text")
          .attr("x", this.margin.left)
          .attr("y", d => this.yScale(d) - 5)
          .attr("text-anchor", "start")
          .attr("fill", "currentColor")
          .attr("font-size", "8pt")
          .text(d => d))
        .call(g => g.selectAll("text")
          .clone(true).lower()
          .attr("fill", "none")
          .attr("stroke-width", 5)
          .attr("stroke-linejoin", "round")
          .attr("stroke", "white"))

    
    this.nodes.labels = this.nodes.svg.append("g")
      .attr("id", `${this.id}-labels`)
      .style("pointer-events", "none")
      .attr("font-family", "monospace")
      .attr("font-size", 10)
      .attr("text-anchor", "left")
      .attr("fill", "black")

    return this.nodes.svg
  }

  stateChange(property, value) {
    if (property == "focus" || property == "coloring") {
      this.updateInteraction()
    } else if (property == "tValue") {
      this.updateAll()
    } else if (property == "selected") {
      this.updateLabels()
    } 
  }
}