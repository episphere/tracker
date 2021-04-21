import {DynamicState} from "/js/classes/DynamicState.js"
import "https://d3js.org/d3.v6.min.js"
import { TAFFY } from "/js/lib/taffydb/taffy-module.js"
//import "https://github.com/typicaljoe/taffydb/raw/master/taffy.js"

// TODO: Named colorings
export class Plot {
  constructor(element, opts, defaults) {

    this.element = element

    defaults.state = null
    opts = Object.assign(defaults, opts)
    Object.assign(this, opts)

    if (opts.state == null) {
      this.state = new DynamicState()
    } else {
      this.state = opts.state
    }

    if (this.sField != null && this.sFields == null) {
      this.sFields = [this.sField]
    }

    this.state.addListener((p, v) => this.stateChanged(p, v))
  }

  stratify() {
    for (const row of this.data.data().get()) {
      row._s = this.sFields.map(field => row[field]).join("#")
    }
  }

  filterSValues() {
    if (this.visibleSValues != null) {
      // TODO: Handle partial queries (especailly important as we add the extra sField)
      const query = []
      for (const sKeys of this.visibleSValues) {
        const subQuery = {}
        for (const [i,sField] of this.sFields.entries()) {
          subQuery[sField] = sKeys[i] 
        }
        query.push(subQuery)
      }
      // MAYBE: Better way to do this?
      this.data.data = TAFFY(this.data.data(query).get())
    }
  }

  stateChanged(property, value) {
    // Default state changed behaviour
  }

  checkFocused(d, i, noneFocused = true) {
    return this.state.focus.has(d[this.sField])  ||
      this.state.selected.has(d[this.sField]) ||
      noneFocused && this.state.selected.size == 0 && this.state.focus.size == 0
  }

  interactiveColor(d, i) {
    if (this.checkFocused(d, i)) {
        return this.coloring.f(d, i)
    } else {
      return "rgb(240, 240, 240)"
    }
  }

  // Work with sFields, not sField!
  createUniqueColoring() {
    const sColorMap = new Map()
    
    // const sValues = this.data.data().distinct(...this.sFields).map(d => d.join("#"))
    // Alternative to TAFFYDB distinct() ^ because it (for some reason) re-orders fields
    // let sValues = new Set()
    // for (const row of this.data.data().get()) {
    //   sValues.add(this.sFields.map(field => row[field]).join("#"))
    // }
    // sValues = [...sValues]
    const sValues = this.data.data().distinct("_s")
    
    const colorScale = d3.scaleSequential()
      .domain([0, sValues.length])
      .interpolator(d3.interpolateRainbow) 

    for (const [i, sValue] of sValues.entries()) {
      sColorMap.set(sValue, colorScale(i))
    }

    return {id: "default", name: "Default", 
      f: d => {return sColorMap.get(d._s)}}
  }

}