import request from 'request-promise-native'

class SlackNotifier {
  constructor (webHookUrl, options = {}) {
    const { author_name, author_link } = options

    this.webHookUrl = webHookUrl
    this.attachmentOptions = {
      author_link,
      author_name,
    }
  }

  async notifyException (ex, msg = '', { noStack = false, fields = [] }) {
    const url = this.webHookUrl

    try {
      if (!url) {
        return
      }

      if (!noStack) {
        fields.push({
          title: 'StackTrace',
          value: ex.stack,
          short: false,
        })
      }

      const attachment = {
        fallback: `Error occurred : ${msg || ''} - ${ex.toString()}`,
        color: '#ff0000',
        pretext: `[ERROR] ${msg || '개발자 메시지가 없습니다.'}`,
        title: 'Exception',
        text: ex.toString(),
        fields,
        ts: Math.floor(new Date() / 1000),
      }

      const json = {
        attachments: [Object.assign(attachment, this.attachmentOptions)],
      }

      await request({ method: 'POST', url, json })
    } catch (ex) {
      console.error('Error occurred while reporting to slack channel', ex)
    }
  }
}

export { SlackNotifier }
