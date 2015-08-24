import test = require('blue-tape')
import { create } from './free-style'

test('free style', (t) => {
  t.test('output hashed classes', t => {
    const Style = create()

    const className = Style.registerStyle({
      color: 'red'
    })

    t.equal(Style.getStyles(), `.${className}{color:red;}`)

    t.end()
  })

  t.test('multiple values', t => {
    const Style = create()

    const className = Style.registerStyle({
      background: [
        'red',
        'linear-gradient(to right, red 0%, green 100%)'
      ]
    })

    t.equal(
      Style.getStyles(),
      `.${className}{background:red;background:linear-gradient(to right, red 0%, green 100%);}`
    )

    t.end()
  })

  t.test('dash-case property names', t => {
    const Style = create()

    const className = Style.registerStyle({
      backgroundColor: 'red'
    })

    t.equal(Style.getStyles(), `.${className}{background-color:red;}`)

    t.end()
  })

  t.test('nest @-rules', t => {
    const Style = create()

    const className = Style.registerStyle({
      color: 'red',
      '@media (min-width: 500px)': {
        color: 'blue'
      }
    })

    t.equal(
      Style.getStyles(),
      `.${className}{color:red;}@media (min-width: 500px){.${className}{color:blue;}}`
    )

    t.end()
  })

  t.test('do not append "px" to whitelisted properties', t => {
    const Style = create()

    const className = Style.registerStyle({
      flexGrow: 2,
      WebkitFlexGrow: 2
    })

    t.equal(Style.getStyles(), `.${className}{-webkit-flex-grow:2;flex-grow:2;}`)

    t.end()
  })

  t.test('merge duplicate styles', t => {
    const Style = create()

    const className1 = Style.registerStyle({
      background: 'blue',
      color: 'red'
    })

    const className2 = Style.registerStyle({
      color: 'red',
      background: 'blue'
    })

    t.equal(className1, className2)
    t.equal(Style.getStyles(), `.${className1}{background:blue;color:red;}`)

    t.end()
  })

  t.test('merge duplicate nested styles', t => {
    const Style = create()

    const className = Style.registerStyle({
      color: 'red',
      '.foo': {
        color: 'red'
      }
    })

    t.equal(
      Style.getStyles(),
      `.${className},.${className} .foo{color:red;}`
    )

    t.end()
  })

  t.test('merge @-rules', t => {
    const Style = create()
    const mediaQuery = '@media (min-width: 600px)'

    const className1 = Style.registerStyle({
      [mediaQuery]: {
        color: 'red'
      }
    })

    const className2 = Style.registerStyle({
      [mediaQuery]: {
        color: 'blue'
      }
    })

    t.equal(
      Style.getStyles(),
      `@media (min-width: 600px){.${className1}{color:red;}.${className2}{color:blue;}}`)

    t.end()
  })

  t.test('utils', t => {
    const Style = create()

    t.test('url', t => {
      t.equal(Style.url('http://example.com'), 'url("http://example.com")')

      t.end()
    })

    t.test('join', t => {
      t.equal(
        Style.join('a', { b: true, noop: false }, null, ['c', 'd']),
        'a b c d'
      )

      t.end()
    })
  })
})
