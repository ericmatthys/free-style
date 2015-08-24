import objectValues = require('object-values')

/**
 * Increment through IDs for FreeStyle, which can't generate hashed IDs.
 */
let id = 0

/**
 * Valid CSS property names.
 */
export type PropertyName = string

/**
 * Valid CSS property values.
 */
export type PropertyValue = void | number | string | string[] | number[]

/**
 * CSS styles object.
 */
export interface Styles {
  [propertyName: string]: PropertyValue
}

type Properties = Array<[PropertyName, PropertyValue]>
type NestedStyles = Array<[PropertyName, UserStyles]>

interface ParsedUserStyles {
  properties: Properties
  nestedStyles: NestedStyles
}

/**
 * CSS properties that are valid unit-less numbers.
 */
const CSS_NUMBER: { [propertyName: string]: boolean } = {
  'box-flex': true,
  'box-flex-group': true,
  'column-count': true,
  'flex': true,
  'flex-grow': true,
  'flex-positive': true,
  'flex-shrink': true,
  'flex-negative': true,
  'font-weight': true,
  'line-clamp': true,
  'line-height': true,
  'opacity': true,
  'order': true,
  'orphans': true,
  'tab-zize': true,
  'widows': true,
  'z-index': true,
  'zoom': true,

  // SVG properties.
  'fill-opacity': true,
  'stroke-dashoffset': true,
  'stroke-opacity': true,
  'stroke-width': true
}

/**
 * CSS vendor prefixes.
 */
const VENDOR_PREFIXES = ['-webkit-', '-ms-', '-moz-', '-o-']

// Add vendor prefixes to all unit-less properties.
for (const property of Object.keys(CSS_NUMBER)) {
  for (const prefix of VENDOR_PREFIXES) {
    CSS_NUMBER[prefix + property] = true
  }
}

/**
 * Transform a JavaScript property into a CSS property.
 */
function hyphenate (propertyName: PropertyName): PropertyName {
  return propertyName
    .replace(/([A-Z])/g, '-$1')
    .replace(/^ms-/, '-ms-') // Internet Explorer vendor prefix.
    .toLowerCase()
}

/**
 * Check if a property name should pop to the top level of CSS.
 */
function isAtRule (propertyName: PropertyName): boolean {
  return propertyName.charAt(0) === '@'
}

/**
 * Check if a value is a nested style definition.
 */
function isNestedStyle (value: any): boolean {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Generate a hash value from a string.
 */
function hash (str: string, seed?: number): number {
  let value = seed || 0x811c9dc5

  for (let i = 0; i < str.length; i++) {
    value ^= str.charCodeAt(i)
    value += (value << 1) + (value << 4) + (value << 7) + (value << 8) + (value << 24)
  }

  return value >>> 0
}

/**
 * Convert a hash to a string.
 */
function hashToString (hash: number): string {
  return hash.toString(32)
}

/**
 * Generate a hash string from a string.
 */
function hashString (str: string): string {
  return hashToString(hash(str))
}

/**
 * Transform a style string to a CSS string.
 */
function styleStringToString (name: PropertyName, value: string | number | void) {
  return value == null ? '' : `${name}:${value};`
}

/**
 * Transform a style into a CSS string.
 */
function styleToString (name: PropertyName, value: PropertyValue): string {
  if (Array.isArray(value)) {
    return (<Array<any>> value).map(function (value) {
      return styleStringToString(name, value)
    }).join('')
  }

  return styleStringToString(name, <string | number | void> value)
}

/**
 * Categorize user styles.
 */
function parseUserStyles (styles: UserStyles): ParsedUserStyles {
  const properties: Properties = []
  const nestedStyles: NestedStyles = []

  // Sort keys before adding to styles.
  for (const key of Object.keys(styles).sort()) {
    const value = styles[key]

    if (isNestedStyle(value)) {
      nestedStyles.push([key.trim(), value])
    } else {
      properties.push([hyphenate(key.trim()), value])
    }
  }

  return { nestedStyles, properties }
}

/**
 * Stringify an array of property tuples.
 */
function stringifyProperties (properties: Array<[PropertyName, PropertyValue]>) {
  return properties.map(p => styleToString(p[0], p[1])).join('')
}

/**
 * Interpolate CSS selectors.
 */
function interpolate (selector: string, parentSelector: string) {
  if (selector.indexOf('&') > -1) {
    return selector.replace(/&/g, parentSelector)
  }

  return `${parentSelector} ${selector}`
}

/**
 * Recursively register styles on a container instance.
 */
function registerUserStyles (container: Container, styles: UserStyles): string {
  const styleInstances: [string, Style][] = []

  let currentHash: number = 0

  function stylize (container: Container, styles: UserStyles, selector: string) {
    const { properties, nestedStyles } = parseUserStyles(styles)
    const styleString = stringifyProperties(properties)
    const style = container.add(new Style(styleString))

    styleInstances.push([selector, style])

    currentHash = hash(selector, currentHash)
    currentHash = hash(styleString, currentHash)

    for (const [name, value] of nestedStyles) {
      if (isAtRule(name)) {
        stylize(container.add(new AtRule(name)), value, selector)
      } else {
        stylize(container, value, interpolate(name, selector))
      }
    }
  }

  stylize(container, styles, '&')

  const currentClassName = hashToString(currentHash)
  const currentSelector = '.' + currentClassName

  for (const [selector, style] of styleInstances) {
    style.add(new Selector(interpolate(selector, currentSelector)))
  }

  return currentClassName
}

/**
 * User styles object.
 */
export type UserStyles = any

/**
 * Cacheable interface.
 */
export interface ICacheable {
  id: string
}

/**
 * Common interface all style classes conform to.
 */
export interface IStyle extends ICacheable {
  getStyles (): string
}

/**
 * Change listeners are registered to react to CSS changes.
 */
export interface ChangeListenerFunction <T> {
  (type?: string, style?: T): any
}

/**
 * Implement a cache/event emitter.
 */
export class Cache <T extends ICacheable> {

  private _cache: { [id: string]: T } = {}
  private _cacheCount: { [id: string]: number } = {}
  private _listeners: Array<ChangeListenerFunction<T>> = []

  values (): T[] {
    return objectValues(this._cache)
  }

  empty () {
    for (const key of Object.keys(this._cache)) {
      const item = this._cache[key]
      let len = this.count(item)

      while (len--) {
        this.remove(item)
      }
    }
  }

  add <U extends T> (style: U): U {
    const count = this._cacheCount[style.id] || 0

    this._cacheCount[style.id] = count + 1

    if (count === 0) {
      this._cache[style.id] = style
      this.emitChange('add', style)
    }

    return <U> this._cache[style.id]
  }

  count (style: T): number {
    return this._cacheCount[style.id] || 0
  }

  has (style: T): boolean {
    return this.count(style) > 0
  }

  remove (style: T): void {
    const count = this._cacheCount[style.id]

    if (count > 0) {
      this._cacheCount[style.id] = count - 1

      if (count === 1) {
        delete this._cache[style.id]
        this.emitChange('remove', style)
      }
    }
  }

  addChangeListener (fn: ChangeListenerFunction<T>): void {
    this._listeners.push(fn)
  }

  removeChangeListener (fn: ChangeListenerFunction<T>): void {
    const listeners = this._listeners
    const index = listeners.indexOf(fn)

    if (index > -1) {
      listeners.splice(index, 1)
    }
  }

  emitChange (type: string, style: T): void {
    for (const listener of this._listeners) {
      listener(type, style)
    }
  }

}

/**
 * Selector is a dumb class made to represent nested CSS selectors.
 */
export class Selector implements ICacheable {

  id: string

  constructor (public selector: string) {
    this.id = `s${hashString(selector)}`
  }

}

/**
 * The style container registers a style string with selectors.
 */
export class Style extends Cache<Selector> implements IStyle {

  id: string
  selector: string
  className: string

  constructor (public style: string) {
    super()

    this.id = `n${hashString(style)}`
  }

  getStyles (): string {
    const { style } = this

    return style ? `${this.values().map(x => x.selector).join(',')}{${style}}` : ''
  }

}

/**
 * Container classes hold other style instances.
 */
export class Container extends Cache<Style | Container> implements IStyle {

  id: string

  getStyles (): string {
    return this.values()
      .map(style => style.getStyles())
      .join('')
  }

  registerStyle (styles: UserStyles) {
    return registerUserStyles(this, styles)
  }

}

/**
 * Implements `@`-rule logic for style output.
 */
export class AtRule extends Container {

  id: string

  constructor (public rule: string) {
    super()

    this.id = `a${hashString(rule)}`
  }

  getStyles (): string {
    return `${this.rule}{${super.getStyles()}}`
  }

}

/**
 * The FreeStyle class implements the API for everything else.
 */
export class FreeStyle extends Container {

  id: string

  constructor () {
    super()

    this.id = hashToString(++id)
  }

  url (url: string): string {
    return 'url("' + encodeURI(url) + '")'
  }

  join (...classList: Array<string | Object | void | string[]>) {
    const classNames: string[] = []

    for (const value of classList) {
      if (typeof value === 'string') {
        classNames.push(value)
      } else if (Array.isArray(value)) {
        classNames.push(this.join.apply(this, value))
      } else if (value != null) {
        for (const key of Object.keys(value)) {
          if ((<any> value)[key]) {
            classNames.push(key)
          }
        }
      }
    }

    return classNames.join(' ')
  }
}

/**
 * Exports a simple function to create a new instance.
 */
export function create () {
  return new FreeStyle()
}
