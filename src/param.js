const ld = require('lodash')
import moment from 'moment'

export function ensure (expr, errorObject, errorData = {}) {
  if (!expr) {
    const origErrorObject = errorObject

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
    err._errorObject = origErrorObject
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
const wrap = funcSanitize => {
  funcSanitize._sanitizer = signature
  return funcSanitize
}
const isSanitizer = fn => {
  return ld.isFunction(fn) && fn._sanitizer && fn._sanitizer === signature
}

const objectSanitizer = function ({ defError }) {
  return (obj, errorObject = defError) => {
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
  }
}

const chainSanitizer = ({ defError }) => (...sanitizers) => {
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
        ensure(false, ex._errorObject || errorObject, { value })
      }
    }
    return intermediateValue
  })
}

const anyOfSanitizer = ({ defError }) => (...sanitizers) => {
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
}

const parseIntSanitizer = () => () => {
  return wrap(value => parseInt(value, 10))
}

const positiveIntSanitizer = ({ defError }) => (errorObject = defError) => {
  return wrap(value => {
    ensure(ld.isInteger(value), errorObject, { value })
    ensure(value >= 0, errorObject, { value })
    return value
  })
}

const nonEmptyStringSanitizer = ({ defError }) => (errorObject = defError) => {
  return wrap(value => {
    ensure.nonEmptyString(value, errorObject, { value })
    return value
  })
}

const mapExactSanitizer = ({ defError }) => (valueToCheck, valueToRet, errorObject = defError) => {
  return wrap(value => {
    ensure(value === valueToCheck, errorObject, { value })
    return valueToRet
  })
}

const binaryNumberToBoolSanitizer = ({ defError }) => (errorObject = defError) => {
  return wrap(value => {
    const i = parseInt(value, 10)
    ensure.oneOf(i, [ 0, 1 ], errorObject, { value })
    return i === 1
  })
}

const linkStringSanitizer = ({ defError }) => (errorObject = defError) => {
  return wrap(value => {
    const val = value.trim()
    ensureNonEmptyString(val, errorObject, { value })
    ensure(val.toLowerCase().startsWith('http'), errorObject, { value })
    return val
  })
}

const dateTimeSanitizer = ({ defError }) => (options, errorObject = defError) => {
  options = Object.assign({
    format: 'YYYY-MM-DD HH:mm:ss'
  }, options || {})

  return wrap(value => {
    let val
    if (ld.isString(value)) {
      val = moment(value, options.format)
    } else if (ld.isNumber(value)) {
      val = moment(new Date(value))
    } else if (ld instanceof Date) {
      val = moment(ld)
    }

    ensure(val.isValid(), errorObject)
    return val.format(options.format)
  })
}

function createSanitizedObject (options) {
  const s = {
    object: objectSanitizer(options),
    chain: chainSanitizer(options),
    anyOf: anyOfSanitizer(options),
    mapExact: mapExactSanitizer(options),
    binaryNumberToBool: binaryNumberToBoolSanitizer(options),
    nonEmptyString: nonEmptyStringSanitizer(options),
    linkString: linkStringSanitizer(options),
    parseInt: parseIntSanitizer(options),
    positiveInt: positiveIntSanitizer(options),
    dateTime: dateTimeSanitizer(options),
  }

  s.builder = () => {
    const builder = {}
    const list = []
    const addToBuilder = sanitizer => list.push(sanitizer)
    for (let san in s) {
      if (s.hasOwnProperty(san)) {
        ((san) => {
          Object.defineProperty(builder, san, {
            configurable: false,
            value: (...args) => {
              addToBuilder(s[ san ](...args))
              return builder
            }
          })
        })(san)
      }
    }
    builder.build = () => {
      return s.chain(...list)
    }
    return builder
  }

  return s
}

export const sanitizer = (options) => {
  options = Object.assign({
    defError: 'Invalid param'
  }, options || {})

  return createSanitizedObject(options)
}
