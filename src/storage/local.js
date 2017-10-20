import _ from 'lodash'
import mkdirp from 'mkdirp'
import path from 'path'
import Debug from 'debug'
import uuid from 'uuid/v4'
import { ensure } from 'overdosed-js'
import { moveFile } from '../utils'

const driverPrototype = {
  init: async function () {
    const storagePath = path.join(this._basePath, name)

    this._debug(`Creating storage path : ${storagePath}`)
    await new Promise((resolve, reject) => {
      mkdirp(storagePath, (err) => err ? reject(err) : resolve())
    })
  },
  /**
   * 이미지를 저장하고 생성된 이미지 아이디를 반환한다.
   *
   * @param obj {object|string|array} 이미지 경로 또는 multer 를 통하여 받아진 객체
   * @return {Promise.<string>}
   */
  save: async function (obj) {
    let imagePath
    if (_.isString(obj)) { // path
      imagePath = obj
    } else if (_.isArray(obj)) {
      return this.save(obj[ 0 ])
    } else if (_.isObject(obj)) {
      imagePath = obj.path
    }

    this._ensure.nonEmptyString(imagePath, this._paramError('Invalid image path'))

    const imageId = uuid()
    const finalImagePath = path.join(this._basePath, name, `${imageId}.jpg`)
    await moveFile(imagePath, finalImagePath)

    return imageId
  },
}

export default function createLocalStorageDriver (options, definition) {

  // TODO: sanitize options
  const { name, path } = options

  return Object.create(driverPrototype, {
    // TODO: how to pass along _ensure, _paramError, _sanitizer, ....
    _ensure: {
      configurable: false,
      writable: false,
      value: ensure,
    },
    _paramError: {
      configurable: false,
      writable: false,
      value: name => {return { error: ({ value }) => `Invalid [${name}] - ${value} / ${typeof value}` }}
    },
    _debug: {
      configurable: false,
      writable: false,
      value: Debug(`od:localStorage:${name}`),
    },
    _name: {
      configurable: false,
      writable: false,
      value: name,
    },
    _basePath: {
      configurable: false,
      writable: false,
      value: path,
    },
  })
}