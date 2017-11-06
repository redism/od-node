import _ from 'lodash'
import Knex from 'knex'
import { ensure, sanitizer as Sanitizer } from 'od-js'
import { isForeignKeyError } from './mysql'

const knex = Knex({ client: 'mysql' })
const sane = Sanitizer()

export function handlerDefiner (options) {
  return function defineHandler (name) {
    const d = {
      name,
      handler: null,
      options: {},
      endpoint: {},
    }

    return Object.create(null, {
      name: {
        configurable: false,
        writable: false,
        value: function (v) {
          d.name = v
          return this
        },
      },
      handler: {
        configurable: false,
        writable: false,
        value: function (v) {
          d.handler = v
          return this
        },
      },
      multer: {
        configurable: false,
        writable: false,
        value: function (v) {
          d.options.multer = v
          return this
        },
      },
      endpoint: {
        configurable: false,
        writable: false,
        value: function (method, url) {
          d.endpoint = { method, url }
          return this
        },
      },
      build: {
        configurable: false,
        writable: false,
        value: () => d,
      },
    })
  }
}

const noop = v => v

export function handlerMaker (options = {}) {
  let {
    name,
    tableName,
    preprocessor = {},
    sanitizer = {},
  } = options

  ensure.nonEmptyString(name, 'handlerMaker requires name option.')
  ensure.nonEmptyString(tableName, 'handlerMaker requires tableName option.')

  // ensure(isSanitizer(sanitizer.id), 'handlerMaker requires sanitizer.id option.')
  // ensure(isSanitizer(sanitizer.ids), 'handlerMaker requires sanitizer.ids option.')
  // ensure(isSanitizer(sanitizer.add), 'handlerMaker requires sanitizer.add option.')
  // ensure(isSanitizer(sanitizer.get), 'handlerMaker requires sanitizer.get option.')
  // ensure(isSanitizer(sanitizer.modify), 'handlerMaker requires sanitizer.modify option.')

  if (_.isFunction(preprocessor)) {
    preprocessor = { common: preprocessor }
  }

  const addPreprocessor = preprocessor.add || noop
  const getPreprocessor = preprocessor.get || noop
  const modifyPreprocessor = preprocessor.modify || noop
  const removePreprocessor = preprocessor.remove || noop

  async function getHandlerByHandlerMaker (context, id) {
    await Promise.resolve(preprocessor.common(context))
    await Promise.resolve(getPreprocessor(context))

    id = sanitizer.id(id || context.getParam('id'))
    const conn = context.getMySQLConnection()
    const q = knex(tableName).select().where('id', id).toString()
    const [ row ] = await conn.query(q)

    context.ensure(row, '해당 데이터를 찾을 수 없습니다.')
    return sanitizer.get(row)
  }

  async function addHandlerByHandlerMaker (context) {
    await Promise.resolve(preprocessor.common(context))
    await Promise.resolve(addPreprocessor(context))

    const conn = context.getMySQLConnection()

    const data = context.getParamObject(sanitizer.add)
    const sql = knex(tableName).insert(data).toString()
    try {
      const { insertId } = await conn.query(sql)
      return getHandlerByHandlerMaker(context, insertId)
    } catch (ex) {
      if (isForeignKeyError(ex)) {
        context.ensure(false, `Foreign key error occurred while inserting ${name}`)
      }
      context.ensure(false, `Unknown error occurred while inserting ${name} - ${ex.message}`)
    }
  }

  async function modifyHandlerByHandlerMaker (context, id, data) {
    await Promise.resolve(preprocessor.common(context))
    await Promise.resolve(modifyPreprocessor(context))

    id = sanitizer.id(id || context.getParam('id'))
    data = data ? sanitizer.modify(data) : context.getParamObject(sanitizer.modify)

    const conn = context.getMySQLConnection()
    const q = knex(tableName).update(data).where('id', id).toString()
    const { affectedRows } = await conn.query(q)
    context.ensure(affectedRows === 1, `Cannot find data of id [${id}]`)
    return getHandlerByHandlerMaker(context, id)
  }

  const idSanitizer = sane.anyOf(
    sane.array(sanitizer.id),
    sanitizer.id,
  )
  const removeHandlerByHandlerMaker = async function removeHandlerByHandlerMaker (context, id) {
    await Promise.resolve(preprocessor.common(context))
    await Promise.resolve(removePreprocessor(context))

    id = idSanitizer(id || context.getParam('id'))
    const conn = context.getMySQLConnection()
    let q
    if (_.isArray(id)) {
      q = knex(tableName).whereIn('id', id).del().toString()
    } else {
      q = knex(tableName).where('id', id).del().toString()
    }
    const { affectedRows } = await conn.query(q)

    return { num: affectedRows }
  }

  return {
    add: addHandlerByHandlerMaker,
    get: getHandlerByHandlerMaker,
    modify: modifyHandlerByHandlerMaker,
    remove: removeHandlerByHandlerMaker,
    route: (app, prefix) => {
      if (!prefix.endsWith('/')) {
        prefix += '/'
      }

      app.defineHandler(`add${name}`, d =>
        d.handler(addHandlerByHandlerMaker)
          .endpoint('post', `${prefix}`)
      )

      app.defineHandler(`get${name}`, d =>
        d.handler(getHandlerByHandlerMaker)
          .endpoint('get', `${prefix}:id`)
      )

      app.defineHandler(`modify${name}`, d =>
        d.handler(modifyHandlerByHandlerMaker)
          .endpoint('post', `${prefix}:id`)
      )

      app.defineHandler(`remove${name}`, d =>
        d.handler(removeHandlerByHandlerMaker)
          .endpoint('delete', `${prefix}:id`)
      )

      app.defineHandler(`removeMulti${name}`, d =>
        d.handler(removeHandlerByHandlerMaker)
          .endpoint('delete', `${prefix}`)
      )
    },
  }
}
