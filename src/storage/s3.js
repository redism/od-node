/* eslint-disable no-underscore-dangle */
import AWS from 'aws-sdk'
import Debug from 'debug'
import fs from 'fs'
import { _, ensure } from 'od-js'
import path from 'path'
import uuid from 'uuid/v4'

// http://docs.aws.amazon.com/cli/latest/userguide/cli-environment.html
//
// AWS_ACCESS_KEY_ID
// AWS_SECRET_ACCESS_KEY
// AWS_DEFAULT_REGION
const driverPrototype = {
  async init() {
    AWS.config.loadFromPath(this._awsCredFilePath)
    // const storagePath = path.join(this._basePath, this._name)
    //
    // this._debug(`Creating storage path : ${storagePath}`)
    // await new Promise((resolve, reject) => {
    //   mkdirp(storagePath, (err) => err ? reject(err) : resolve())
    // })
  },
  /**
   * 이미지를 저장하고 생성된 이미지 아이디를 반환한다.
   *
   * @param obj {object|string|array} 이미지 경로 또는 multer 를 통하여 받아진 객체
   * @param [options] {object}
   * @return {Promise.<string>}
   */
  async save(obj, options = {}) {
    let imagePath
    if (_.isString(obj)) {
      // path
      imagePath = obj
    } else if (_.isArray(obj)) {
      return this.save(obj[0])
    } else if (_.isObject(obj)) {
      imagePath = obj.path
    }

    let { fileName, contentType, ext } = options
    const {
      mimetype,
      originalname,
      asAttachment,
      uploadOptions: uo = {},
      removeOriginal = this._removeOriginal,
    } = options
    contentType = contentType || mimetype || 'image/jpeg'
    ext = ext || (originalname ? path.extname(originalname) : null) || '.jpg'
    fileName = fileName || originalname

    this._ensure.nonEmptyString(imagePath, this._paramError('Invalid image path'))

    const imageId = uuid()
    const dnName = fileName || `${imageId}${ext}`

    const s3 = new AWS.S3()
    const bucketName = this._bucketName
    const key = `${this._prefix}${imageId}${ext}`

    const uploadOptions = {
      Bucket: bucketName,
      ContentType: contentType,
      Key: key,
      ACL: 'public-read',
      Body: fs.createReadStream(imagePath),
    }

    if (asAttachment) {
      uploadOptions.ContentDisposition = `attachment; filename="${encodeURIComponent(dnName)}"`
    } else {
      uploadOptions.ContentDisposition = `inline; filename="${encodeURIComponent(dnName)}"`
    }

    await new Promise((resolve, reject) => {
      const s3UploadOptions = Object.assign(uploadOptions, uo)
      s3.putObject(s3UploadOptions, (err, data) => {
        err && reject(err)
        !err && resolve(data)
      })
    })

    if (removeOriginal) {
      await new Promise(resolve => {
        fs.unlink(imagePath, resolve)
      })
    }

    return imageId
  },
  async listBucket(maxSize = 1000) {
    return new Promise((resolve, reject) => {
      const s3 = new AWS.S3()
      s3.listObjects({ Bucket: this._bucketName, MaxKeys: maxSize }, (err, data) => {
        err && reject(err)
        !err && resolve(data)
      })
    })
  },
  async emptyBucket() {
    const data = await this.listBucket()
    if (data.Contents.length === 0) {
      return Promise.resolve()
    }

    const param = {
      Bucket: this._bucketName,
      Delete: {
        Objects: data.Contents.map(c => {
          return { Key: c.Key }
        }),
        Quiet: true,
      },
    }

    return new Promise((resolve, reject) => {
      const s3 = new AWS.S3()
      s3.deleteObjects(param, (err, data) => {
        err && reject(err)
        !err && resolve(data)
      })
    })
  },
  get bucketName() {
    return this._bucketName
  },
  async remove(imageId, { ext = '.jpg' } = {}) {
    const s3 = new AWS.S3()
    const bucketName = this._bucketName
    const key = `${this._prefix}${imageId}${ext}`
    return new Promise((resolve, reject) => {
      s3.deleteObject(
        {
          Bucket: bucketName,
          Key: key,
        },
        (err, data) => {
          err && reject(err)
          !err && resolve(data)
        }
      )
    })
  },
}

export default function createLocalStorageDriver(options, definition) {
  // TODO: sanitize options
  const { prefix = '', credential, bucket, removeOriginal = true } = options
  const { name } = definition

  return Object.create(driverPrototype, {
    _ensure: {
      configurable: false,
      writable: false,
      value: ensure,
    },
    _paramError: {
      configurable: false,
      writable: false,
      value: name => {
        return { error: ({ value }) => `Invalid [${name}] - ${value} / ${typeof value}` }
      },
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
    _removeOriginal: {
      configurable: false,
      writable: false,
      value: removeOriginal,
    },
    _bucketName: {
      configurable: false,
      writable: false,
      value: bucket,
    },
    _prefix: {
      // 해당 버킷내의 경로 prefix (디렉토리)
      configurable: false,
      writable: false,
      value: prefix,
    },
    _awsCredFilePath: {
      // aws access key, secret key 등을 담고 있는 json 파일의 경로
      configurable: false,
      writable: false,
      value: credential,
    },
  })
}
