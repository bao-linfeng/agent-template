<script setup lang="ts">
import { CheckIcon, CopyIcon } from '@lucide/vue'
import { Button } from '@repo/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { Spinner } from '@repo/ui/components/spinner'
import { useClipboard } from '@vueuse/core'
import { toast } from 'vue-sonner'

import type { ITotpSetup } from '@/services/types/user.type'

import { formatTotpSecret, qrCodeDataUrl } from '@/lib/two-factor'
import { t } from '@/plugins/i18n'
import { useEnableTotpMutation, useStartTotpSetupMutation } from '@/services/api/me.api'

import RecoveryCodesPanel from './recovery-codes-panel.vue'

/** Enrollment: password → scan the QR code and confirm a code → save the recovery codes. */
const open = defineModel<boolean>('open', { default: false })

type Step = 'password' | 'scan' | 'codes'

const step = shallowRef<Step>('password')
const password = shallowRef('')
const code = shallowRef('')
const setup = shallowRef<ITotpSetup | null>(null)
const qrCode = shallowRef('')
const recoveryCodes = shallowRef<string[]>([])

const start = useStartTotpSetupMutation()
const enable = useEnableTotpMutation()
const secret = computed(() => setup.value?.secret ?? '')
const { copy, copied, isSupported } = useClipboard({ source: secret })

// Every opening starts over; an unconfirmed secret simply expires on the server.
watch(open, (isOpen) => {
  if (!isOpen)
    return
  step.value = 'password'
  password.value = ''
  code.value = ''
  setup.value = null
  qrCode.value = ''
  recoveryCodes.value = []
})

async function submitPassword() {
  if (!password.value)
    return
  try {
    const result = await start.mutateAsync(password.value)
    qrCode.value = await qrCodeDataUrl(result.otpauthUri)
    setup.value = result
  }
  catch {
    return // Toasted by the global mutation handler (e.g. wrong password).
  }
  password.value = ''
  step.value = 'scan'
}

async function submitCode() {
  if (!/^\d{6}$/.test(code.value.trim()))
    return
  try {
    recoveryCodes.value = (await enable.mutateAsync(code.value.trim())).recoveryCodes
  }
  catch {
    code.value = ''
    return // Toasted (wrong code, expired setup).
  }
  step.value = 'codes'
  toast.success(t('settings.twoFactor.enabled'))
}
</script>

<template>
  <Dialog v-model:open="open">
    <!-- The recovery codes are shown only once: closing needs the explicit button. -->
    <DialogContent
      class="sm:max-w-md"
      @interact-outside="(event: Event) => step === 'codes' && event.preventDefault()"
      @escape-key-down="(event: Event) => step === 'codes' && event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>
          {{ step === 'codes' ? $t('settings.twoFactor.codesTitle') : $t('settings.twoFactor.setupTitle') }}
        </DialogTitle>
        <DialogDescription v-if="step === 'password'">
          {{ $t('settings.twoFactor.passwordStep') }}
        </DialogDescription>
        <DialogDescription v-else-if="step === 'scan'">
          {{ $t('settings.twoFactor.scanStep') }}
        </DialogDescription>
      </DialogHeader>

      <form v-if="step === 'password'" class="grid gap-4" novalidate @submit.prevent="submitPassword">
        <div class="grid gap-2">
          <Label for="mfa-setup-password">{{ $t('settings.security.currentPassword') }}</Label>
          <Input id="mfa-setup-password" v-model="password" type="password" autocomplete="current-password" />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="!password || start.isPending.value">
            <Spinner v-if="start.isPending.value" class="mr-2" />
            {{ $t('common.continue') }}
          </Button>
        </DialogFooter>
      </form>

      <form v-else-if="step === 'scan'" class="grid gap-4" novalidate @submit.prevent="submitCode">
        <img
          :src="qrCode"
          :alt="$t('settings.twoFactor.qrAlt')"
          class="mx-auto size-48 rounded-md border bg-white p-2"
        >
        <div class="grid gap-1">
          <p class="text-sm text-muted-foreground">
            {{ $t('settings.twoFactor.manualEntry') }}
          </p>
          <div class="flex items-center gap-2">
            <code class="flex-1 rounded bg-muted px-2 py-1 font-mono text-sm break-all">{{ formatTotpSecret(secret) }}</code>
            <Button v-if="isSupported" type="button" variant="ghost" size="icon" :title="$t('settings.twoFactor.copy')" @click="copy()">
              <CheckIcon v-if="copied" />
              <CopyIcon v-else />
            </Button>
          </div>
        </div>
        <div class="grid gap-2">
          <Label for="mfa-setup-code">{{ $t('settings.twoFactor.code') }}</Label>
          <Input
            id="mfa-setup-code"
            v-model="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            :placeholder="$t('settings.twoFactor.codePlaceholder')"
          />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="code.trim().length !== 6 || enable.isPending.value">
            <Spinner v-if="enable.isPending.value" class="mr-2" />
            {{ $t('settings.twoFactor.verifyAndEnable') }}
          </Button>
        </DialogFooter>
      </form>

      <template v-else>
        <RecoveryCodesPanel :codes="recoveryCodes" />
        <DialogFooter>
          <Button type="button" @click="open = false">
            {{ $t('settings.twoFactor.done') }}
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
