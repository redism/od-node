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
  // it('upload image using s3', async () => {
  //   console.log(1)
  // })
})
