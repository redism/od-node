import _ from 'lodash'
import path from 'path'
import mkdirp from 'mkdirp'
import Debug from 'debug'
import uuid from 'uuid/v4'
import { ensure } from 'od-js'
import { copyFile, moveFile } from '../utils'

const driverPrototype = {
  init: async function () {
    const storagePath = path.join(this._basePath, this._name)

    this._debug(`Creating storage path : ${storagePath}`)
    await new Promise((resolve, reject) => {
      mkdirp(storagePath, (err) => err ? reject(err) : resolve())
    })
  },
  /**
   * 이미지를 저장하고 생성된 이미지 아이디를 반환한다.
   *
   * @param obj {object|string|array} 이미지 경로 또는 multer 를 통하여 받아진 객체
   * @param [options] {object}
   * @return {Promise.<string>}
   */
  save: async function (obj, options = {}) {
    let imagePath
    if (_.isString(obj)) { // path
      imagePath = obj
    } else if (_.isArray(obj)) {
      return this.save(obj[ 0 ])
    } else if (_.isObject(obj)) {
      imagePath = obj.path
    }

    // const { contentType = 'image/jpeg', ext = '.jpg' } = options
    let { originalname, ext } = options
    ext = ext || (originalname ? path.extname(originalname) : null) || '.jpg'

    this._ensure.nonEmptyString(imagePath, this._paramError('Invalid image path'))

    const imageId = uuid()
    const finalImagePath = path.join(this._basePath, this._name, `${imageId}${ext}`)
    if (this._removeOriginal) {
      await moveFile(imagePath, finalImagePath)
    } else {
      await copyFile(imagePath, finalImagePath)
    }

    return imageId
  },
}

export default function createLocalStorageDriver (options, definition) {
  // TODO: sanitize options
  const { path, removeOriginal = true } = options
  const { name } = definition

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
      value: name => { return { error: ({ value }) => `Invalid [${name}] - ${value} / ${typeof value}` } },
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
    _removeOriginal: {
      configurable: false,
      writable: false,
      value: removeOriginal,
    },
  })
}
