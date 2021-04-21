import { DynamicState } from "/js/classes/DynamicState.js"
import { Data } from "/js/components/Data.js";

export class Dash {
  constructor(dataUri, opts) {
    //this.data = data // new Data(data)

    this.dataPromise = d3.json(dataUri).then(data => {
      this.data = new Data(data, [])
    })

    Object.assign(this, opts)

    this.state = new DynamicState()
    this.plots = []
  }

  addPlot(plot) {
    
  }
}