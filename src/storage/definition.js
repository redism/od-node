import { sanitizer as Sanitizer } from 'overdosed-js'

const sanitizer = Sanitizer()

const validStorageConfig = sanitizer.object({
  name: sanitizer.nonEmptyString(),
})

export function storageDefiner (options = {}) {
  validStorageConfig(options)

  return function defineStorage (name) {
    return Object.create(null, {
      /**
       * 설정에 따라 드라이버를 포함한 객체를 반환한다.
       */
      build: {
        configurable: true,
        writable: false,
        value: function () {
          const driver = ((storageConfig, definition) => {
            const { type, options } = storageConfig
            switch (type) {
              case 'local':
                return require('./local').default(options, definition)
              default:
                throw new Error(`Unknown storage type : ${type}`)
            }
          })(options)
          return { name, driver }
        },
      },
    })
  }
}
