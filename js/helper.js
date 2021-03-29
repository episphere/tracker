export function filterOutliers(values, nStd = 2) {
  if (nStd < 0) {
    return values
  }

  const std = d3.deviation(values)
  const mean = d3.mean(values)
  return  values.filter(d => d > mean - std*nStd && d < mean + std*nStd)
}

export function clamp(value, range, offset=[0, 0]) {
  range.sort((a, b) => a - b)
  return  Math.max(range[0]-offset[0], Math.min(range[1]+offset[1], value)) 
}

export function lightenRGB(rgbStr, amount) {
  try {
    var rgb = rgbStr.split("rgb(")[1].split(")")[0].split(",").map(d => parseInt(d))
    rgb = rgb.map(d => d + (255-d)*amount)
    return `rgb(${rgb.map(d => Math.round(d)).join(",")})`
  } catch (e) {
    logger.warn("ligtenRGB not compatible with non RGB color strings")
    return rgbStr
  }
}

export function getAngle(point) {
  var angle = Math.atan2(point[1], point[0])
  var degrees = 180 * angle / Math.PI
  return (360 + Math.round(degrees)) % 360
}

export function isNumber(value) {
  return (typeof value == "number") && !isNaN(value)
}

/**
 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
 * 
 * @param {String} text The text to be rendered.
 * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
 * 
 * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
 */
export function getTextWidth(text, font) {
  // re-use canvas object for better performance
  var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
  var context = canvas.getContext("2d");
  context.font = font;
  var metrics = context.measureText(text);
  return metrics.width;
}
