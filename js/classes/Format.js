export class Format {

  static format(data, fieldTypes, inPlace = false) {
    return data.map(row => {
      row = inPlace ? row : {...row}
      for (const [field, type] of Object.entries(fieldTypes)) {
        Format.typeConversions[type](row, field)
      }
      return row
    })
  }

  static typeConversions = {
    "number": (row, field) => {
      const numericValue = parseFloat(row[field])
      if (!isNaN(numericValue)) {
        row[field] = numericValue
      }
    }
  }
}