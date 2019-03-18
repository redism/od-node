import _ from 'lodash'
import { stringify } from 'csv'

export const NodeUtils = {
  /**
   * 주어진 rows 를 정해진 방식에 맞추어 csv 파일로 추출한다.
   *
   * const kExportSettings = [
   *   [ '사용자번호', v => v.uid ],
   *   [ '가입일', v => Utils.getAdminDateString(v.userJoinedAt) ],
   *   [ '이름', v => v.userName ],
   *   [ '글', v => v.numArticle.toLocaleString() ],
   *   [ '최근 접속일', v => Utils.getAdminDateString(v.lastSeenAt) ],
   * ]
   *
   * @param res {object} express res object
   * @param rules {array} rules see listUsers.js for example.
   * @param fileName {string} 파일명
   * @param rows {array} 실제 추출할 데이터 rows
   * @param rowPostProcessor {function} row 에 대한 post processor
   * @return {Promise<void>}
   */
  async exportCSV(res, rules, fileName, rows, rowPostProcessor) {
    const lineHeader = rules.map(item => item[0])

    res.setHeader('content-type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`)
    const stringifier = stringify()

    stringifier.pipe(res)

    stringifier.write(lineHeader)
    _(rows)
      .map(rowPostProcessor)
      .forEach(snapshot => {
        const line = rules.map(item => item[1](snapshot))
        stringifier.write(line)
      })

    stringifier.end()
  },
}
