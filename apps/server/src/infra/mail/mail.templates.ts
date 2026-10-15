export interface RenderedMail {
  subject: string
  text: string
  html: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

/** Templates are plain functions so they stay type-checked; add new ones here. */
export const mailTemplates = {
  passwordReset(input: {
    nickname: string
    resetUrl: string
    expiresInMinutes: number
  }): RenderedMail {
    const nickname = escapeHtml(input.nickname)
    const resetUrl = escapeHtml(input.resetUrl)
    return {
      subject: '重置密码 / Reset your password',
      text: [
        `${input.nickname}，你好：`,
        '',
        `我们收到了重置密码的请求。请在 ${input.expiresInMinutes} 分钟内打开以下链接设置新密码：`,
        input.resetUrl,
        '',
        '如果这不是你本人的操作，请忽略本邮件，你的密码不会被修改。',
      ].join('\n'),
      html: `<p>${nickname}，你好：</p>
<p>我们收到了重置密码的请求。请在 ${input.expiresInMinutes} 分钟内点击下方链接设置新密码：</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>如果这不是你本人的操作，请忽略本邮件，你的密码不会被修改。</p>`,
    }
  },

  passwordChanged(input: { nickname: string }): RenderedMail {
    const nickname = escapeHtml(input.nickname)
    return {
      subject: '密码已修改 / Your password was changed',
      text: `${input.nickname}，你好：\n\n你的账号密码刚刚被修改，所有设备已退出登录。如果不是你本人操作，请立即联系管理员。`,
      html: `<p>${nickname}，你好：</p><p>你的账号密码刚刚被修改，所有设备已退出登录。如果不是你本人操作，请立即联系管理员。</p>`,
    }
  },
}
