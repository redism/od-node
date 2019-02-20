import fs from 'fs'
import rimraf from 'rimraf'

/**
 * 파일 복사를 수행합니다.
 *
 * @param oldPath {string}
 * @param newPath {string}
 * @return {Promise}
 */
export function copyFile(oldPath, newPath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(oldPath)
    const writeStream = fs.createWriteStream(newPath)

    readStream.on('error', reject)
    writeStream.on('error', reject)

    readStream.on('close', function onClose() {
      resolve()
    })

    readStream.pipe(writeStream)
  })
}

/**
 * 파일을 이동합니다. 만약 실패할 경우 복사를 수행합니다.
 *
 * @param oldPath {string}
 * @param newPath {string}
 * @return {Promise}
 */
export function moveFile(oldPath, newPath) {
  return new Promise((resolve, reject) => {
    fs.rename(oldPath, newPath, function renameCallback(err) {
      if (err) {
        if (err.code === 'EXDEV') {
          resolve(copyFile(oldPath, newPath))
        } else {
          reject(err)
        }
      }
      resolve()
    })
  })
}

export async function rmrf(path) {
  return new Promise((resolve, reject) => {
    rimraf(path, err => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}
