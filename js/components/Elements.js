import { MapPlot } from "/js/components/MapPlot.js"
import { DynamicState } from "/js/classes/DynamicState.js"
import { Dash } from "/js/components/Dash.js"
import { Data } from "/js/components/Data.js"
import { TimeSeriesPlot } from "/js/components/TimeSeriesPlot.js"

class QuantElement extends HTMLElement {
  /**
   * Convert NamedNodeMap with HTML attributes into JS object. A case insensitive match is made 
   * between the attribute names and the property names, the case will reflect the propertyName in
   * the returned object. 
   * @param {NamedNodeMap} attributes  HTML attributes
   * @param {String[]} propertyNames Desired names of properties
   */
  parseAttributes(attributes, propertyNames) {
    const propertyNameMap = new Map(propertyNames.map(propertyName =>
      [propertyName.toLowerCase(), propertyName]))
    
    const attributeObj = {}
    for (const attribute of attributes) {
      var propertyName = propertyNameMap.get(attribute.name)
      propertyName = propertyName ? propertyName : attribute.name
      attributeObj[propertyName] = attribute.value
    }

    return attributeObj
  }
}

class DashElement extends QuantElement {
  constructor() {
    super()

    const shadowRoot = this.attachShadow({mode: "open"})
    shadowRoot.innerHTML = `<slot></slot>`

    this.attributeObj = this.parseAttributes(this.attributes, 
      ["sField", "sFields", "tField", "v1Field", "visibleSValues"])

    this.fields = []
    for (const property of Object.keys(this.attributeObj)) {
      if (property.toLowerCase().endsWith("field")) {
        this.fields.push(property)
      }
    }

    this.attributeObj.visibleSValues = this.attributeObj.visibleSValues.split("|")
    this.attributeObj.visibleSValues = this.attributeObj.visibleSValues.map(d => d.split(","))

    this.attributeObj.sFields = this.attributeObj.sFields.split(",")

    this.state = new DynamicState()
    for (const field of this.fields) {
      this.state.defineProperty(field, this.attributeObj[field])
    }

    this.dataPromise = d3.json(this.attributeObj.data).then(rawData => {
  
      // TODO: Remove this!
      rawData.forEach(row => row["all_cause"] = parseFloat(row["all_cause"]))
      rawData.forEach(row => row["week_ending_date"] = new Date(row["week_ending_date"]))
      rawData = rawData.filter(row => row["jurisdiction_of_occurrence"] != "United States")

      const data = new Data(rawData, this.fields)
      return data
    })
    
    //const dash = new Dash(this.attributeObj.data)

    // TODO: Mutation observer to prevent re-running on original children when a new child is added
    shadowRoot.firstElementChild.addEventListener("slotchange", e => {
      for (const childElement of e.target.assignedElements()) {
        childElement.activate(this)
      }
    })
  }
}
customElements.define("quant-dash", DashElement)

class PlotElement extends QuantElement {
  constructor() {
    super()
  }

  activate(activator, propertyNames) {
    // MAYBE: Do we need this method? What should be here? 
    
    if (!this.activated) {
      this.activated = true

      this.attachShadow({mode: "open"})

      this.opts = this.parseAttributes(this.attributes, propertyNames)
      if (activator != null) {
        this.opts.state = activator.state
        this.opts = Object.assign({...activator.attributeObj}, this.opts)
      }

      return true
    }

    return false
  }

  connectedCallback() {
    setTimeout(() => this.activate())
  }
}

class TimeSeriesElement extends PlotElement {
  activate(activator) {
    const activate = super.activate(activator, 
      ["tField", "sField", "v1Field", "tTickFormat", "layerDuration", "layerFrom", "drawPoints"])


    if (activate) {
      if (this.opts.tTickFormat) {
        this.opts.tTickFormat = new Function("d", this.opts.tTickFormat)
      }
      if (this.opts.drawPoints != null) {
        this.opts.drawPoints = this.opts.drawPoints == "true"
      }

      if (activator == null) {
        // Activating self
      } else {
        // Activated by dash

        activator.dataPromise.then(data => {
          this.plot = new TimeSeriesPlot(this.shadowRoot, data, this.opts)
        })
      }
    }
  }
}
customElements.define("quant-time-series", TimeSeriesElement)

class MapElement extends PlotElement {

  activate(activator) {
    const activate = super.activate(activator, 
      ["geoData", "geoKeyProperty", "v1Field"])

    if (activate) {

      if (activator == null) {
        // Activating self
      } else {
        // Activated by dash

        Promise.all([activator.dataPromise, d3.json(this.opts.geoData)]).then(datas => {
          this.opts.data = datas[0]
          this.plot = new MapPlot(this.shadowRoot, datas[1], this.opts)
        })
      }
    }
  }


  // activate(activator, state) {
  //   const activate = super.activate(activator, state, [
  //       "geoData",
  //       "vField",
  //       "tField",
  //       "sField",
  //       "geoKeyProperty"
  //     ])

  //   if (activate) {
  //     const shadowRoot = this.attachShadow({mode: "open"})
  //     Promise.all([d3.json(this.opts.geoData), d3.json(this.opts.data)]).then(data => {
  //       this.opts.data = data[1]
  //       this.plot = new MapPlot(shadowRoot, data[0], this.opts)
  //     })
  //     // const geoData = await d3.json(this.opts.geoData)
  //     // const data = await d3.json(this.opts.data)

  //   }
  // }

}
customElements.define("quant-map", MapElement)