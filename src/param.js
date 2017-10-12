const ld = require('lodash')
import Debug from 'debug'
import moment from 'moment'

const debug = Debug('od.param')

// TODO: remove to the outside of the package
export function ensure (expr, errorObject, errorData = {}) {
  if (!expr) {
    // if (errorObject && errorObject.value) { // To pass original value
    //   errorData.value = errorObject.value
    // }

    if (ld.isFunction(errorObject)) {
      errorObject = errorObject(errorData) || 'Undefined error'
    }

    let msg, code, status
    if (ld.isString(errorObject)) {
      msg = errorObject
      code = -1
      status = 400
    } else if (ld.isObject(errorObject)) {
      msg = errorObject.msg
      code = errorObject.code
      status = errorObject.status
    } else {
      msg = 'Internal error. (No error signature specified)'
      code = -1042
      status = 500
    }

    const err = new Error(msg)
    err.code = code || -1
    err.status = status || 500
    err.message = msg
    err.handled = true
    throw err
  }
}

function ensureOneOf (value, possibles, errorObject, errorData) {
  ensure(possibles.indexOf(value) >= 0, errorObject, errorData || { value, possibles })
}

function ensureNonEmptyString (value, errorObject, errorData) {
  ensure(ld.isString(value) && !ld.isEmpty(value), errorObject, errorData || { value })
}

function ensureBool (value, errorObject, errorData) {
  ensure(ld.isBoolean(value), errorObject, errorData || { value })
}

ensure.oneOf = ensureOneOf
ensure.nonEmptyString = ensureNonEmptyString
ensure.bool = ensureBool

const signature = 'od.sanitizer'
export const sanitizer = (options) => {
  options = options || {}
  const defError = options.defError || 'Invalid param'
  const wrap = funcSanitize => {
    funcSanitize._sanitizer = signature
    return funcSanitize
  }
  const isSanitizer = fn => {
    return ld.isFunction(fn) && fn._sanitizer && fn._sanitizer === signature
  }

  return {
    object: (obj, errorObject = defError) => {
      ensure(ld.isObject(obj), 'Invalid usage of sanitizer.object')
      for (let prop in obj) {
        if (obj.hasOwnProperty(prop)) {
          ensure(isSanitizer(obj[ prop ]), `Invalid usage of sanitizer.object, [${prop}] is not a sanitizer`)
        }
      }

      return wrap(value => {
        let converted = {}
        ensure(ld.isObject(value), errorObject, { value })
        for (let prop in value) {
          if (value.hasOwnProperty(prop)) {
            converted[ prop ] = obj[ prop ](value[ prop ], errorObject)
          }
        }
        return converted
      })
    },
    chain: (...sanitizers) => {
      if (sanitizers.length === 0) {
        return v => v
      }

      const last = sanitizers[ sanitizers.length - 1 ]
      let maxIndex = sanitizers.length - 1
      let errorObject

      if (isSanitizer(last)) {
        maxIndex++
        errorObject = defError
      } else { // assume it's error object
        errorObject = last
      }

      return wrap(value => {
        let intermediateValue = value
        for (let i = 0; i < maxIndex; i++) {
          try {
            intermediateValue = sanitizers[ i ](intermediateValue)
          } catch (ex) {
            ensure(false, errorObject, { value })
          }
        }
        return intermediateValue
      })
    },
    anyOf: (...sanitizers) => {
      if (sanitizers.length === 0) {
        return v => v
      }

      const last = sanitizers[ sanitizers.length - 1 ]
      let maxIndex = sanitizers.length - 1
      let errorObject
      if (isSanitizer(last)) {
        maxIndex++
        errorObject = defError
      } else { // assume it's error object
        errorObject = last
      }

      return wrap(value => {
        for (let i = 0; i < maxIndex; i++) {
          try {
            return sanitizers[ i ](value)
          } catch (ex) {
          }
        }
        ensure(false, errorObject, { value })
      })
    },
    mapExact: (valueToCheck, valueToRet, errorObject = defError) => {
      return wrap(value => {
        ensure(value === valueToCheck, errorObject, { value })
        return valueToRet
      })
    },
    binaryNumberToBool: (errorObject = defError) => {
      return wrap(value => {
        const i = parseInt(value, 10)
        ensure.oneOf(i, [ 0, 1 ], errorObject, { value })
        return i === 1
      })
    },
    nonEmptyString: (errorObject = defError) => {
      return wrap(value => {
        ensure.nonEmptyString(value, errorObject, { value })
        return value
      })
    },
    linkString: (errorObject = defError) => {
      return wrap(value => {
        const val = value.trim()
        ensureNonEmptyString(val, errorObject, { value })
        ensure(val.toLowerCase().startsWith('http'), errorObject, { value })
        return val
      })
    },
    parseInt: () => {
      return wrap(value => parseInt(value, 10))
    },
    positiveInt: (errorObject = defError) => {
      return wrap(value => {
        // const val = parseInt(value, 10)
        ensure(ld.isInteger(value), errorObject, { value })
        ensure(value >= 0, errorObject, { value })
        return value
      })
    },
    positiveIntOrNull: (value, nullValue, errorObject = defError) => {
      const val = parseInt(value, 10)
      ensure(ld.isNumber(val) && !ld.isNaN(val), errorObject)
      ensure(val >= 0 || val === nullValue, errorObject)
      return (val >= 0 ? val : null)
    },
    datetime: (errorObject = defError) => {
      return value => {
        let val
        if (ld.isString(value)) {
          val = moment(value, 'YYYY-MM-DD HH:mm:ss')
        } else if (ld.isNumber(value)) {
          val = moment(new Date(value))
        } else if (ld instanceof Date) {
          val = moment(ld)
        }

        ensure(val.isValid(), errorObject)
        return val.format('YYYY-MM-DD HH:mm:ss')
      }
    },
  }
}

