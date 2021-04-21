import { TAFFY } from "/js/lib/taffydb/taffy-module.js"

// TODO: Multiple stratify fields
// TODO: Selectable processing
// MAYBE: Less direct link to TaffyDB, maybe define special field types and use them
//  ...or go the opposite way, and just interface directly with TAFFY.
//  ...maybe useful to just have a couple of shorthand methods, but may not be clean.
export class Data {
  constructor(data, specialFields) {
    this.data = new TAFFY(data)
    this.allData = new TAFFY(data)
    this.specialFields = specialFields 

    // this.tField = tField
    // this.sField = sField
  }

  // get(tValue, sValue) {
  //   const query = {}
  //   if (this.tField && tValue != null) {
  //     query[this.tField] = tValue
  //   }
  //   if (this.sField && sValue != null) {
  //     query[this.sField] = sValue
  //   }
  //   return tValue && sValue ? this.data(query).first() : this.data(query).get()
  // }

  // tValues() {
  //   return this.data().distinct(this.tField)
  // }

  distinct(field) { 
    return this.data().distinct(field)
  }

  queryOne(query) {
    return this.data(query).first()
  }
}