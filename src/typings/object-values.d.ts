declare module 'object-values' {
  function objectValues <T> (o: { [key: string]: T }): T[]

  export = objectValues
}
