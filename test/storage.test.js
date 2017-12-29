import path from 'path'
import { storageDefiner } from '../src/storage/definition'
import { rmrf } from '../src/utils'

const imagePath = path.join(__dirname, 'res/test.jpg')

describe('storage', () => {
  describe('local', () => {
    beforeEach(async () => {
      await rmrf(path.join(__dirname, './images/localImages'))
    })

    it('upload', async () => {
      const storageOption = {
        type: 'local',
        options: {
          path: path.join(__dirname, './images'),
          removeOriginal: false,
        },
      }
      const defineStorage = storageDefiner(storageOption)
      const { name, driver } = defineStorage('localImages').build()
      await driver.init()
      const r = await driver.save(imagePath)

      expect(name).toEqual('localImages')
      expect(typeof r).toEqual('string')
      expect(r.length).toBeGreaterThan(0)
    })
  })

  describe('s3', () => {
    let driver = null
    beforeAll(async () => {
      const storageOption = {
        type: 's3',
        options: {
          credential: path.join(__dirname, './res/aws-cred.json'),
          bucket: 'gcb-testcase',
          removeOriginal: false,
        },
      }
      const defineStorage = storageDefiner(storageOption)
      const r = defineStorage('s3Images').build()
      driver = r.driver
      await driver.init()
      await driver.emptyBucket()
    })

    it('upload image using s3', async () => {
      const r = await driver.save(imagePath)

      expect(typeof r).toEqual('string')
      expect(r.length).toBeGreaterThan(0)
    })
  })
})
