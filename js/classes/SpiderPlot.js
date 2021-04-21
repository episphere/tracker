export class Spider {
  // TODO: Make height automatic
  // TODO: Selected at top
  // TODO: Should we update the scales each time?
  
  constructor(element, data, state, tField, sField, nFields, opts = {}) {
    
    opts = {
      ...{
        tValue: null,
        tParse: v => new Date(v),
        transform : null,
        vTransform: v => v,
        size: [360, 360],
        maxLabelLength: 10,
        coloring: null
      },
      ...opts
    }
    
    if (Object.hasOwnProperty("id")) {
      throw "Element must have an ID"
    }
    
    this.element = element 
    this.state = state
    this.tField = tField
    this.sField = sField 
    // TODO: Make transform adjustable
    this.nFields = nFields.map(field => field + (this.transform != null ? "#" + this.transform.id : "")) 
    console.log(this.nFields)
    Object.assign(this, opts)
    
    this.id = this.element.id
    this.shortFields = this.nFields.map(field => 
      field.length < this.maxLabelLength ? field : field.slice(0, this.maxLabelLength) + "...")
    this.fieldPairs = this.nFields.map((d, i) => [d, this.shortFields[i]])
    this.tValues = [...d3.group(data, d => d._t).keys()]
    if (this.tValue == null) {
      this.tValue = this.tValues[0]
    }
    this.data = data.map(row => {
      row._t = this.tParse(row[this.tField])
      row._s = row[this.sField].replace(/[\W_]+/g,"_")
      return row
    }) 
    this.nowData = this.data.filter(d => d._t.toString() == this.tValue.toString())
    
    this.nodes = {}
    this.coloringMap = new Map()
    
    this.nodes.base = d3.create("svg")
      .attr("id", `${this.id}-base`)
      .attr("width", this.size[0])
      .attr("height", this.size[1])
    
    element.append(this.nodes.base.node())
    
    this.setColoring(this.coloring == null ? this.getDefaultColoring() : this.coloring)
    this.createBase()
  }
  
  createBase() {
    this.nodes.rAxis = this.nodes.base.append("g")
      .attr("width", this.size[0])
      .attr("height", this.size[1])
      .attr("id", `${this.id}-rAxis`)
    
    const margin = this.calculateMargin()
    this.axisSize = [this.size[0] - margin.left - margin.right, this.size[1] - margin.top - margin.bottom]
    
    this.scales = []
    for (const field of this.nFields) {
      this.scales.push(d3.scaleLinear()
        .domain(d3.extent(this.data, d => d[field]))
        .range([0, this.axisSize[0]/2]))
    }
    
    const translate = `translate(${margin.left + this.axisSize[0]/2}, ${margin.top + this.axisSize[1]/2})`
    this.nodes.rAxis
      .attr("transform", translate)
      .call(this.radialAxis(this.scales)
        .fields(this.fieldPairs)
        .ticks(1)
      )
    
    this.nodes.polygons = this.nodes.base.append("g")
      .attr("id", `${this.id}-polygons`)
      .attr("transform", translate)
    this.scales = []
    this.directions = []
    for (const [i, field] of this.nFields.entries()) {
      this.scales.push(d3.scaleLinear()
        .domain(d3.extent(this.data, d => d[field]))
        .range([0, this.axisSize[0]/2]))
      this.directions.push(this.getRadialPoint(2 * Math.PI * i/this.nFields.length, 1))
    }

    
    this.updatePolygons()
    
    this.updateInteraction()
  }

  updatePolygons() {

    const sNowData = d3.group(this.nowData, d => d._s)
    const polygonData = []
    for (const rows of sNowData.values()) {
      const row = rows[0]
      const points = []
      for (const [i, field] of this.nFields.entries()) {
        const l = this.scales[i](this.vTransform(row[field], row))
        const direction = this.directions[i]
        points.push(direction.map(v => v*l))
      }
      points.push(points[0])
      polygonData.push({row: row, p: points})
    }

    const line = d3.line()
      .defined(d => !isNaN(d[0]) && !isNaN(d[1]))
      .x(d => d[0])
      .y(d => d[1])

    // this.nodes.polygons.selectAll("path")
    //   .data(polygonData)
    //   .join("path")
    //     .attr("id", d => `${this.id}-polygon-${d.row._s}`)
    //     .attr("d", d =>line(d.p))
    //     .attr("fill", "none")
    //     .attr("stroke", (d, i) => this.interactiveColor(d.row, i))
    //     .attr("stroke-width", 1.5)
    //     .each((d, i, s) => {
    //       const selection = this.nodes.polygons.select(`#${this.id}-polygon-${d.row._s}`)
    //       selection.selectAll("circle")
    //         .data(d.p.filter(d => !isNaN(d[0]) && !isNaN(d[1])))
    //         .join("circle")
    //           .attr("cx", d => {console.log(d); return d[0]})
    //           .attr("cy", d => d[1])
    //           .attr("r", 3)  
    //           .attr("fill", "black")
    //     })

    this.nodes.polygons.selectAll("g")
      .data(polygonData)
      .join("g")
        .attr("id", d => `${this.id}-polygon-${d.row._s}`)
        .each((d, i, s) => {
          const selection = this.nodes.polygons.select(`#${this.id}-polygon-${d.row._s}`)
          // selection.selectAll("circle")
          //   .data(d.p.filter(d => !isNaN(d[0]) && !isNaN(d[1])))
          //   .join("circle")
          //     .attr("cx", d => d[0])
          //     .attr("cy", d => d[1])
          //     .attr("r", (_, i) => this.interactiveColor(d.row, i))
          //     .attr("fill", "black")

          const lonePoints = []
          for (var i = 0; i < d.p.length; i++) {
            const iL = i == 0 ? d.p.length -1 : i-1
            const iR = (i+1) % d.p.length
            
            if (!isNaN(d.p[i][0]) && !isNaN(d.p[i][1]) 
                && (isNaN(d.p[iL][0]) || isNaN(d.p[iL][1])) 
                && (isNaN(d.p[iR][0]) || isNaN(d.p[iR][1]))) {
              lonePoints.push({row: d.row, p: d.p[i]})
            }
          }

          selection.selectAll("circle")
            .attr("class", "polygon")
            .data(lonePoints)
            .join("circle")
              .attr("cx", d => d.p[0])
              .attr("cy", d => d.p[1])
              .attr("r", 2)
              .attr("fill", (d, i) => this.interactiveColor(d.row, i))
              //.attr("fill", "black")

          selection.selectAll("path")
            .attr("class", "polygon")
            .data([d])
            .join("path")
              .attr("fill", "none")
              .attr("stroke", (d, i) => this.interactiveColor(d.row, i))
              .attr("stroke-width", 1.5)
              .attr("d", d =>line(d.p))
        })

    this.nodes.polygons


    // this.nodes.polygons.selectAll("*").remove()
    // for (const sData of sNowData.values()) {
    //   const values = this.nFields.map(field => sData[0][field])
    //   const rPolygon = this.nodes.polygons.append("g")
    //     .attr("id", `${this.id}-polygon-${sData[0]._s}`)
    //     .attr("class", "polygon")
        
    //     .datum(sData[0])
      //rPolygon.call(this.spiderPolygon(this.scales, values))
    //}
  }

  updateInteraction() {
    const state = this.state

    this.nodes.polygons.selectAll("path")
      .attr("stroke", (d, i) => this.interactiveColor(d.row, i))
    this.nodes.polygons.selectAll("circle")
      .attr("fill", (d, i) => this.interactiveColor(d.row, i))
    // this.nodes.polygons.selectAll(".polygon")
    //   .each(function(d) {
    //     const selection =  d3.select(this)
    //     selection.selectAll("path")
    //        .attr("stroke", (_, i) => interactiveColor(d, i, plot))
    //     selection.selectAll("circle")
    //       .attr("fill", (_, i) => interactiveColor(d, i, plot))
    // })
  }

  drawSort() {
    this.selectedRows = this.nowData
      .filter(d => this.state.selected.has(d._s) || this.state.focus == d._s)
    for (const row of this.selectedRows) {
      this.nodes.polygons.select(`#${this.id}-polygon-${row._s}`).raise()
    }
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

  setTValue(tValue) {
    this.tValue = tValue
    this.nowData = this.data.filter(d => d._t.toString() == this.tValue.toString())

    this.updatePolygons()
    this.updateInteraction()
    this.drawSort()

  }

  
  stateChange(property, value) {
    if (property == "focus") {
      this.drawSort()
      this.nodes.polygons.select(`#${this.id}-polygon-${value}`).raise()
      this.updateInteraction()
      
    } else if (property == "selected") {
      this.updateInteraction()
    }
  }
  
  
  calculateMargin() {
    this.nodes.rAxis.call(this.radialAxis(d3.scaleLinear().domain([0, 1]).range([0, this.size[0]/2]))
      .fields(this.fieldPairs)
      .ticks(1)
    )
    const box = this.nodes.rAxis.node().getBBox()
    const left = Math.abs(box.x) - this.size[0]/2
    const right = box.width - this.size[0] - left
    const top = Math.abs(box.y) - this.size[1]/2
    const bottom = box.height - this.size[1] - top

    return {left: left, right: right, top: top, bottom: bottom}
  }
  
  getDefaultColoring() {
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


  // --- 

  radialAxis(scales) {
    var fields = []
    var ticks = 0
    var rotation = 0
    var scales = scales
    var scale = null
    
    if (!Array.isArray(scales)) {
      scale = scales
      scales = []
    } 
    
    const angleToTextAlign = function(angle) {
      const C = "middle"
      const R = "start"
      const L = "end"
      const B = "text-after-edge"
      const T = "text-before-edge"
      const horiz = [C, R, R, R, C, L, L, L]
      const vert = [B, B, C, T, T, T, C, B]
      const textAlign = horiz.map((d, i) => [d, vert[i]])
      
      angle = (angle + Math.PI/8) % (2 * Math.PI)
      return textAlign[Math.floor(angle / (Math.PI/4))]
    }
    
    
    const axis = selection => {
      selection.selectAll("*").remove()
      
      if (scales != null && scales.length != fields.length) {
        throw `A list of scales has been supplied, but length (${scales.length} does not match the supplied list of fields ${fields.length}.` 
      }
      
      const rPoints = []
      for (var i = 1; i < ticks+1; i++) {
        const tPoints = []
        const range = scales[0].range()
        const r = (range[1]-range[0])*(i/ticks)
        for (var j = 0; j <= fields.length; j++) {
          tPoints.push([2 * Math.PI * j/fields.length + rotation, r]) 
        }
        rPoints.push(tPoints)
      }
          
      const radarLine = d3.lineRadial()
      const radialPaths = selection.append("g")
        .selectAll("path")
        .data(rPoints)
        .join("path")
          .attr("d", d => radarLine(d))
          .attr("fill", "none")
          .attr("stroke", "grey")
      
      const getRadialPoint = this.getRadialPoint
      const lPoints = rPoints[ticks-1].map(rPoint => {
        return this.getRadialPoint(rPoint[0], rPoint[1])
      })
      
      const straightPaths = selection.append("g")
        .selectAll("path")
        .data(lPoints)
        .join("path")
          .attr("d", d => d3.line()([[0,0], d]))
          .attr("fill", "none")
          .attr("stroke", "grey")
      
      const textPoints = rPoints[ticks-1].slice(0, fields.length).map((rPoint, i) => {
        const alignment = angleToTextAlign(rPoint[0])
        const lPoint = this.getRadialPoint(rPoint[0], rPoint[1] + 5)
        const label = fields[i][1]
        return {
          rPoint: rPoint, lPoint: lPoint, 
          label: label, fullLabel:  fields[i][0], 
          alignment: alignment, selectedField: null
        }
      })
      
      const labels = selection.append("g")
        .style("font-size", "11px")
        .attr("font-family", "monospace")
      var selectionI = 0
      var selectedIs = [0, 0]
      
      const fieldColor = d => d.selectedField == "y" ? "blue" : (d.selectedField == "x" ? "red" : "black")
      labels.append("g")
        .selectAll("text")
        .data(textPoints)
        .join("text")
          .attr("x", d => d.lPoint[0])
          .attr("y", d => d.lPoint[1])
          .attr("fill", fieldColor)
          .style("dominant-baseline", d => d.alignment[1])
          .style("text-anchor", d => d.alignment[0])
          // .on("mouseover", function ()  {
          //   d3.select(this).style("cursor", "pointer"); 
          //   d3.select(this).style("fill", "grey")
          // })
          // .on("mouseout", function ()  {
          //   d3.select(this).style("cursor", "default"); 
          //   d3.select(this).style("fill", fieldColor)
          // })
          // .on("click", (_, d) => {
          //   textPoints[selectedIs[selectionI]].selected = null
          //   this.state.yField = d.fullLabel
          //   d.selectedField = ["x", "y"][selectionI]
          //   selectionI = (selectionI + 1) % 2
            
          // })
          .text(d => d.label)
          .append("svg:title")
            .text(function(d, i) { return d.fullLabel});
      
      return selection
    }
    
    axis.fields = function(value) {
      if (!arguments.length) return fields
      if (scales.length == 0) {
        value.forEach(_ => scales.push(scale))
      }
      fields = value
      return axis
    }
    
    axis.ticks = function(value) {
      if (!arguments.length) return ticks
      ticks = value
      return axis 
    }
    
    axis.rotation = function(value) {
      if (!arguments.length) return rotation
      rotation = value
      return axis 
    }
    
    return axis
  }

  spiderPolygon(scales, values) {
    var scales = scales
    var scale = null
    var color = "pink"
    
    if (!Array.isArray(scales)) {
      scales = values.map(_ => scales)
      scale = scales
    } 
    
    const spider = selection => {
      const rPoints = []
      for (var i = 0; i < values.length; i++) {
        rPoints.push([2 * Math.PI * i/values.length, isNaN(values[i]) ? 0 : scales[i](values[i])])
      }
      rPoints.push(rPoints[0])
      
      const radarLine = d3.lineRadial()
      // const radialPaths = selection.append("path")
      //   .datum(rPoints)
      //   .join("path")
      //     .attr("d", d => radarLine(d))
      //     .attr("fill", color)
      //     .attr("fill-opacity", 0.3)
      
      const existingLines = []
      for (var i = 0; i < values.length; i++) {
        const i1 = i
        const i2 = (i+1) % values.length
        
        if (!isNaN(values[i1]) && !isNaN(values[i2])) {
          existingLines.push([
            this.getRadialPoint(rPoints[i1][0], rPoints[i1][1]),
            this.getRadialPoint(rPoints[i2][0], rPoints[i2][1])
          ])
        }
      }
      
      for (const existingLine of existingLines) {
        selection.append("path")
          .join("path")
            .attr("d", d3.line()(existingLine))
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
      }
      
      const lonePoints = []
      for (var i = 0; i < values.length; i++) {
        const iL = i == 0 ? values.length -1 : i-1
        const iR = (i+1) % values.length
        
        if (!isNaN(values[i]) && isNaN(values[iL]) && isNaN(values[iR])) {
          lonePoints.push(this.getRadialPoint(rPoints[i][0], rPoints[i][1]))
        }
      }
      
      selection.append("g")
        .selectAll("circle")
        .data(lonePoints)
        .join("circle")
          .attr("cx", d => d[0])
          .attr("cy", d => d[1])
          .attr("r", 2)
          .attr("fill", color)
      
      return selection
    }
    
    spider.color = function(value) {
      if (!arguments.length) return color
      this.color = value
      return spider
    }
    
    return spider
  }

  getRadialPoint(angle, radius, rotation = 0) {
    return [Math.cos(angle + rotation - Math.PI/2) * radius, Math.sin(angle + rotation - Math.PI/2) * radius]
  }
}