/**
 * Simple class which links a collection of properties to a collection of listeners. When any one
 * of the variables in the state is changed, all of the listeners are called. 
 */
export class DynamicState {

  constructor() {
    this.properties = {}
    this.listeners = []
  }

  /**
   * Define a new property. When this property is updated (through this class) then all of the 
   * listeners will fire.
   * @param {string} property - The name of the property.
   * @param {*} value 
   */
  defineProperty(property, value) {
    Object.defineProperty(this, property, {
      set: function(value) { this._setProperty(property, value) },
      get: function() { return this.properties[property] }
    })
    this._setProperty(property, value)
  }

  /**
   * Add a listener, will fire when any of the defined properties are changed.
   * @param {function} f - Will be called with two arguments: property name and updated value.
   */
  addListener(f) {
    this.listeners.push(f)
  }

  _setProperty(property, value) {
    this.properties[property] = value

    for (const listener of this.listeners) {
      listener(property, value)
    }
  }
}