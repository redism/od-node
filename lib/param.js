'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sanitizer = undefined;
exports.ensure = ensure;

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const ld = require('lodash');


const debug = (0, _debug2.default)('od.param');

// TODO: remove to the outside of the package
function ensure(expr, errorObject, errorData = {}) {
  if (!expr) {
    // if (errorObject && errorObject.value) { // To pass original value
    //   errorData.value = errorObject.value
    // }

    if (ld.isFunction(errorObject)) {
      errorObject = errorObject(errorData) || 'Undefined error';
    }

    let msg, code, status;
    if (ld.isString(errorObject)) {
      msg = errorObject;
      code = -1;
      status = 400;
    } else if (ld.isObject(errorObject)) {
      msg = errorObject.msg;
      code = errorObject.code;
      status = errorObject.status;
    } else {
      msg = 'Internal error. (No error signature specified)';
      code = -1042;
      status = 500;
    }

    const err = new Error(msg);
    err.code = code || -1;
    err.status = status || 500;
    err.message = msg;
    err.handled = true;
    throw err;
  }
}

function ensureOneOf(value, possibles, errorObject, errorData) {
  ensure(possibles.indexOf(value) >= 0, errorObject, errorData || { value, possibles });
}

function ensureNonEmptyString(value, errorObject, errorData) {
  ensure(ld.isString(value) && !ld.isEmpty(value), errorObject, errorData || { value });
}

function ensureBool(value, errorObject, errorData) {
  ensure(ld.isBoolean(value), errorObject, errorData || { value });
}

ensure.oneOf = ensureOneOf;
ensure.nonEmptyString = ensureNonEmptyString;
ensure.bool = ensureBool;

const signature = 'od.sanitizer';
const sanitizer = exports.sanitizer = options => {
  options = options || {};
  const defError = options.defError || 'Invalid param';
  const wrap = funcSanitize => {
    funcSanitize._sanitizer = signature;
    return funcSanitize;
  };
  const isSanitizer = fn => {
    return ld.isFunction(fn) && fn._sanitizer && fn._sanitizer === signature;
  };

  return {
    chain: (...sanitizers) => {
      if (sanitizers.length === 0) {
        return v => v;
      }

      const last = sanitizers[sanitizers.length - 1];
      let maxIndex = sanitizers.length - 1;
      let errorObject;

      if (isSanitizer(last)) {
        maxIndex++;
        errorObject = defError;
      } else {
        // assume it's error object
        errorObject = last;
      }

      return wrap(value => {
        let intermediateValue = value;
        for (let i = 0; i < maxIndex; i++) {
          try {
            intermediateValue = sanitizers[i](intermediateValue);
          } catch (ex) {
            ensure(false, errorObject, { value });
          }
        }
        return intermediateValue;
      });
    },
    anyOf: (...sanitizers) => {
      if (sanitizers.length === 0) {
        return v => v;
      }

      const last = sanitizers[sanitizers.length - 1];
      let maxIndex = sanitizers.length - 1;
      let errorObject;
      if (isSanitizer(last)) {
        maxIndex++;
        errorObject = defError;
      } else {
        // assume it's error object
        errorObject = last;
      }

      return wrap(value => {
        for (let i = 0; i < maxIndex; i++) {
          try {
            return sanitizers[i](value);
          } catch (ex) {}
        }
        ensure(false, errorObject, { value });
      });
    },
    mapExact: (valueToCheck, valueToRet, errorObject) => {
      return wrap(value => {
        ensure(value === valueToCheck, errorObject, { value });
        return valueToRet;
      });
    },
    binaryNumberToBool: errorObject => {
      return wrap(value => {
        const i = parseInt(value, 10);
        ensure.oneOf(i, [0, 1], errorObject, { value });
        return i === 1;
      });
    },
    linkString: errorObject => {
      return wrap(value => {
        const val = value.trim();
        ensureNonEmptyString(val, errorObject, { value });
        ensure(val.toLowerCase().startsWith('http'), errorObject, { value });
        return val;
      });
    },
    parseInt: () => {
      return wrap(value => parseInt(value, 10));
    },
    positiveInt: errorObject => {
      return wrap(value => {
        // const val = parseInt(value, 10)
        ensure(ld.isInteger(value), errorObject, { value });
        ensure(value >= 0, errorObject, { value });
        return value;
      });
    },
    positiveIntOrNull: (value, nullValue, errorObject) => {
      const val = parseInt(value, 10);
      ensure(ld.isNumber(val) && !ld.isNaN(val), errorObject);
      ensure(val >= 0 || val === nullValue, errorObject);
      return val >= 0 ? val : null;
    },
    datetime: errorObject => {
      return value => {
        let val;
        if (ld.isString(value)) {
          val = moment(value, 'YYYY-MM-DD HH:mm:ss');
        } else if (ld.isNumber(value)) {
          val = moment(new Date(value));
        } else if (ld instanceof Date) {
          val = moment(ld);
        }

        ensure(val.isValid(), errorObject);
        return val.format('YYYY-MM-DD HH:mm:ss');
      };
    }
  };
};