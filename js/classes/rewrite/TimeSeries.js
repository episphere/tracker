export class TimeSeries {
  constructor(element, data, state, tField, yField, sField, opts = {
    tTickFormat: v => v,
    yTickFormat: v => v,
    tParse: v => new Date(v)
  }) {

    this.element = element 
    this.data = data 
    this.state = state
    this.tField = tField
    this.yField = yField
    this.sField = sField
    Object.assign(this, opts)
   
    if (typeof element.id == undefined) {
      throw new Exception("Element must have ID")
    }

    this.tValues = d3.group(data, d => tParse(tField))
    
    this.nodes() = {}
  }

  createBase() {
    const state = this.state 

    const svg = d3.create("svg")
      .attr("id", `${this.element.id}-base`)
      .attr("width", this.size[0])
      .attr("height", this.size[1])

    
  }


  updateData(data) {
    // TODO: Update tValues
    // TODO: Update scales
  }
}