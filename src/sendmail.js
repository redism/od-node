import nodemailer from 'nodemailer'

/**
 * Create E-mail sender using G-mail STMP with less secure app setting.
 *
 * - Personal
 * https://myaccount.google.com/lesssecureapps
 *
 * - Domain Setting
 * https://admin.google.com/overdosed.co.kr/AdminHome?pli=1&fral=1#ServiceSettings/notab=1&service=securitysetting&subtab=lesssecureappsaccess
 *
 *
 * const sender = gmailSender('master@overdosed.co.kr', 'password', 'Master of overdosed')
 * sender.sendText('user@someDomain.com', 'Hello?', 'TEXT!!')
 *
 * @param account {string} such as "user@overdosed.co.kr"
 * @param password {string}
 * @param [from] {string} default from mail option.
 */
export function gmailSender (account, password, from) {
  const transporter = nodemailer.createTransport(`smtps://${account}:${password}@smtp.gmail.com`)

  const defaultMailOptions = { from: from ? `"${from}" <${account}>` : account }

  return Object.create(null, {
    sendText: {
      configurable: true,
      writable: false,
      value: (to, subject, text, html) => {
        return new Promise((resolve, reject) => {
          transporter.sendMail(Object.assign(defaultMailOptions, {
            to,
            subject,
            text,
            html,
          }), (err, info) => err ? reject(err) : resolve(info))
        })
      },
    },
  })
}
