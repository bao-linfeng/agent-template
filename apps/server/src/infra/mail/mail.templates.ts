export interface RenderedMail {
  subject: string
  text: string
  html: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

/** Server-time agnostic timestamp for mails, e.g. `2026-10-31 03:45 UTC`. */
function formatUtc(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
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

  verificationCode(input: {
    code: string
    expiresInMinutes: number
  }): RenderedMail {
    return {
      subject: `${input.code} 是你的注册验证码 / Your verification code`,
      text: [
        '你好：',
        '',
        `你正在注册账号，验证码为：${input.code}`,
        `验证码 ${input.expiresInMinutes} 分钟内有效，请勿告诉他人。`,
        '',
        '如果这不是你本人的操作，请忽略本邮件。',
      ].join('\n'),
      html: `<p>你好：</p>
<p>你正在注册账号，验证码为：</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${escapeHtml(input.code)}</p>
<p>验证码 ${input.expiresInMinutes} 分钟内有效，请勿告诉他人。</p>
<p>如果这不是你本人的操作，请忽略本邮件。</p>`,
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

  /** Security notice for every change of an admin's two-factor authentication. */
  twoFactorChanged(input: {
    nickname: string
    change: 'enabled' | 'disabled' | 'reset'
  }): RenderedMail {
    const nickname = escapeHtml(input.nickname)
    const { subject, body } = {
      enabled: {
        subject: '两步验证已开启 / Two-factor authentication enabled',
        body: '你的账号刚刚开启了两步验证，其他设备已退出登录。今后登录时需要输入身份验证器中的验证码。',
      },
      disabled: {
        subject: '两步验证已关闭 / Two-factor authentication disabled',
        body: '你的账号刚刚关闭了两步验证，今后登录只需要密码。',
      },
      reset: {
        subject: '两步验证已被重置 / Two-factor authentication reset',
        body: '管理员重置了你账号的两步验证，所有设备已退出登录。登录后可以在设置中重新开启。',
      },
    }[input.change]
    const warning = '如果不是你本人操作，请立即修改密码并联系管理员。'
    return {
      subject,
      text: `${input.nickname}，你好：\n\n${body}${warning}`,
      html: `<p>${nickname}，你好：</p><p>${body}${warning}</p>`,
    }
  },

  accountDeletionScheduled(input: {
    nickname: string
    scheduledAt: Date
  }): RenderedMail {
    const nickname = escapeHtml(input.nickname)
    const scheduledAt = formatUtc(input.scheduledAt)
    return {
      subject: '账号注销申请已受理 / Your account is scheduled for deletion',
      text: [
        `${input.nickname}，你好：`,
        '',
        `你的账号已申请注销，所有设备已退出登录。账号及其全部数据将于 ${scheduledAt} 后被永久删除。`,
        '在此之前，你可以在登录页使用邮箱和密码撤销注销。',
        '',
        '如果这不是你本人的操作，请尽快撤销注销并修改密码。',
      ].join('\n'),
      html: `<p>${nickname}，你好：</p>
<p>你的账号已申请注销，所有设备已退出登录。账号及其全部数据将于 <strong>${scheduledAt}</strong> 后被永久删除。</p>
<p>在此之前，你可以在登录页使用邮箱和密码撤销注销。</p>
<p>如果这不是你本人的操作，请尽快撤销注销并修改密码。</p>`,
    }
  },

  accountDeletionCancelled(input: { nickname: string }): RenderedMail {
    const nickname = escapeHtml(input.nickname)
    return {
      subject: '账号注销已撤销 / Your account deletion was cancelled',
      text: `${input.nickname}，你好：\n\n你的账号注销申请已撤销，账号和数据会继续保留。如果不是你本人操作，请立即修改密码。`,
      html: `<p>${nickname}，你好：</p><p>你的账号注销申请已撤销，账号和数据会继续保留。如果不是你本人操作，请立即修改密码。</p>`,
    }
  },

  accountDeleted(input: { nickname: string }): RenderedMail {
    const nickname = escapeHtml(input.nickname)
    return {
      subject: '账号已注销 / Your account has been deleted',
      text: `${input.nickname}，你好：\n\n你的账号及其数据已被永久删除。此邮箱现在可以重新注册。感谢你的使用。`,
      html: `<p>${nickname}，你好：</p><p>你的账号及其数据已被永久删除。此邮箱现在可以重新注册。感谢你的使用。</p>`,
    }
  },

  accountExportReady(input: {
    nickname: string
    expiresAt: Date
  }): RenderedMail {
    const nickname = escapeHtml(input.nickname)
    const expiresAt = formatUtc(input.expiresAt)
    return {
      subject: '你的数据导出已就绪 / Your data export is ready',
      text: `${input.nickname}，你好：\n\n你申请的个人数据导出已生成，请登录后在账号设置中下载。文件保留至 ${expiresAt}，之后会被自动删除。`,
      html: `<p>${nickname}，你好：</p><p>你申请的个人数据导出已生成，请登录后在账号设置中下载。文件保留至 <strong>${expiresAt}</strong>，之后会被自动删除。</p>`,
    }
  },
}
